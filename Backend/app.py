import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS  # type: ignore
from PIL import Image
import io
import hashlib
from gemini_service import GeminiService
from ml_service import MLService
from feedback_service import FeedbackService
from dotenv import load_dotenv

load_dotenv()

# --- Flask app ---
app = Flask(__name__)
CORS(app)

print("� BioNutriScan Backend - Clinical Vitamin Deficiency Detection")
print("✅ Backend initialized successfully")

# --- Initialize Services ---
ai_service = GeminiService()
ml_service = MLService()
feedback_service = FeedbackService()


# --- Prediction endpoint ---
@app.route("/predict", methods=["POST"])
def predict():
    """Main endpoint for vitamin deficiency analysis"""
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        
        # Read and process image
        image = Image.open(file.stream).convert("RGB")
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG')
        image_bytes = img_byte_arr.getvalue()
        
        # Generate image hash for feedback tracking
        image_hash = hashlib.sha256(image_bytes).hexdigest()[:16]
        
        # Step 1: Try to validate image (but don't fail if validation fails)
        process_log = []
        try:
            process_log.append({"step": "validation", "status": "started", "message": "Validating image..."})
            validation_result = ai_service.validate_image(image_bytes)
            if not validation_result["is_valid"]:
                # Check if it's a network/API error or actual invalid image
                message = validation_result.get("message", "")
                if "network" not in message.lower() and "unable" not in message.lower() and "error" not in message.lower():
                    # Actual invalid image (not human)
                    process_log.append({"step": "validation", "status": "failed", "message": message})
                    return jsonify({
                        "error": "Invalid image",
                        "message": message,
                        "process_log": process_log
                    }), 400
                else:
                    process_log.append({"step": "validation", "status": "skipped", "message": "Validation skipped due to API issue"})
            else:
                process_log.append({"step": "validation", "status": "success", "message": "Image validated successfully"})
        except Exception as e:
            process_log.append({"step": "validation", "status": "skipped", "message": f"Validation skipped: {str(e)}"})
        
        # FLOW: ML -> AL (Gemini) -> Feedback (High Priority)
        
        # Step 2: Run ML model prediction
        print("\n🤖 ML MODEL ANALYSIS:")
        print("━" * 60)
        process_log.append({"step": "ml_analysis", "status": "started", "message": "Running ML model prediction..."})
        ml_result = ml_service.predict(image_bytes)
        
        if ml_result.get("deficiencies"):
            ml_count = len(ml_result["deficiencies"])
            print(f"✅ ML prediction successful: {ml_count} deficiencies found")
            for i, deficiency in enumerate(ml_result["deficiencies"][:5], 1):
                vitamin = deficiency.get('vitamin', 'Unknown')
                likelihood = deficiency.get('likelihood', 0)
                print(f"   [{i}] {vitamin}: {likelihood:.1f}%")
            if ml_count > 5:
                print(f"   ... and {ml_count - 5} more")
            process_log.append({"step": "ml_analysis", "status": "success", "message": f"ML model detected {ml_count} deficiencies"})
        else:
            print("ℹ️  ML model found no deficiencies")
            process_log.append({"step": "ml_analysis", "status": "no_results", "message": "ML model found no deficiencies"})
        
        # Step 3: Run Gemini AI analysis (Analysis Layer)
        print("\n🧠 GEMINI AI ANALYSIS:")
        print("━" * 60)
        process_log.append({"step": "al_analysis", "status": "started", "message": "Running Gemini AI analysis..."})
        ai_result = ai_service.analyze_deficiencies(image_bytes)
        
        # Check if AI determined skin is normal
        ai_is_normal = ai_result.get("is_normal", False)
        
        if ai_result.get("deficiencies"):
            ai_count = len(ai_result["deficiencies"])
            print(f"✅ Analysis successful: {ai_count} deficiencies found")
            for i, deficiency in enumerate(ai_result["deficiencies"][:5], 1):
                vitamin = deficiency.get('vitamin', 'Unknown')
                likelihood = deficiency.get('likelihood', 0)
                severity = deficiency.get('severity', 'Unknown')
                print(f"   [{i}] {vitamin} ({severity}): {likelihood}% likelihood")
            if ai_count > 5:
                print(f"   ... and {ai_count - 5} more")
            process_log.append({"step": "al_analysis", "status": "success", "message": f"Gemini AI detected {ai_count} deficiencies"})
        else:
            if ai_is_normal:
                print("✅ Skin analysis: Normal and healthy")
                process_log.append({"step": "al_analysis", "status": "success", "message": "Gemini AI: Skin appears normal and healthy"})
            else:
                ai_explanation = ai_result.get("explanation", "No deficiencies detected")
                print(f"ℹ️  AI analysis: {ai_explanation}")
                process_log.append({"step": "al_analysis", "status": "no_results", "message": f"AI analysis: {ai_explanation}"})
        
        # Print recommendations summary
        dietary_count = len(ai_result.get('dietary_recommendations', []))
        lifestyle_count = len(ai_result.get('lifestyle_recommendations', []))
        supplements_count = len(ai_result.get('supplements', []))
        
        print(f"✅ Dietary recommendations: {dietary_count}")
        print(f"✅ Lifestyle recommendations: {lifestyle_count}")
        print(f"✅ Supplements: {supplements_count}")
        
        # Step 5: Cross-verify against historical feedback data
        print("\n🔍 CROSS-VERIFICATION:")
        print("━" * 60)
        process_log.append({"step": "cross_verification", "status": "started", "message": "Cross-verifying predictions against historical feedback..."})
        
        # Get results from both ML and AL
        ml_deficiencies = ml_result.get("deficiencies", [])
        ai_deficiencies = ai_result.get("deficiencies", [])
        
        # Combine and find the highest confidence deficiency from both sources
        all_deficiencies = []
        for d in ml_deficiencies:
            all_deficiencies.append({**d, "source": "ML Model"})
        for d in ai_deficiencies:
            all_deficiencies.append({**d, "source": "Gemini AI"})
        
        # Sort by likelihood (highest first)
        all_deficiencies.sort(key=lambda x: x.get("likelihood", 0), reverse=True)
        
        # Step 6: Feedback Layer (HIGH PRIORITY) - Prepare feedback-ready response with cross-verification
        print("\n📋 FEEDBACK LAYER:")
        print("━" * 60)
        process_log.append({"step": "feedback_layer", "status": "started", "message": "Preparing feedback-ready analysis with verification..."})
        
        # PRIORITY: Trust Gemini AI clinical analysis when it explicitly says skin is normal/healthy
        # Gemini AI provides detailed clinical description, so if it says healthy, trust it over ML model
        if ai_is_normal:
            # Gemini AI determined skin is normal - trust this clinical assessment
            print("✅ Result: Skin is Normal (Gemini AI Clinical Assessment)")
            print("ℹ️  No vitamin deficiencies detected by clinical analysis")
            if ml_deficiencies:
                print(f"⚠️  Note: ML model detected {len(ml_deficiencies)} potential deficiencies, but Gemini AI clinical assessment shows healthy skin")
            process_log.append({"step": "cross_verification", "status": "skipped", "message": "Skin is normal per Gemini AI clinical assessment"})
            process_log.append({"step": "feedback_layer", "status": "success", "message": "Result: Normal - Ready for feedback"})
            
            feedback_result = {
                "image_hash": image_hash,
                "disease": "Normal",
                "vitamin_deficiency": "None",
                "confidence": 95,
                "is_normal": True,
                "status": "Normal",
                "message": "Your skin appears healthy with no significant vitamin deficiencies detected.",
                "analysis_source": "Gemini AI Clinical Assessment",
                "ml_analysis": {
                    "deficiencies": ml_deficiencies,
                    "status": "Overridden by AI",
                    "is_normal": True,
                    "explanation": "ML predictions overridden by Gemini AI clinical assessment showing healthy skin"
                },
                "ai_analysis": ai_result,  # Full AI result with all fields
                "cross_verification": {
                    "status": "N/A",
                    "message": "Gemini AI clinical assessment: Skin is healthy - no deficiencies to verify"
                },
                "process_log": process_log,
                "feedback_enabled": True,
                "feedback_priority": "HIGH"
            }
        
        elif all_deficiencies:
            # Use the highest confidence deficiency from combined analysis
            primary_deficiency = all_deficiencies[0]
            vitamin_name = primary_deficiency["vitamin"]
            confidence = primary_deficiency["likelihood"]
            source = primary_deficiency.get("source", "Unknown")
            
            print(f"✅ Primary Result: {vitamin_name} Deficiency")
            print(f"ℹ️  Initial confidence: {confidence:.1f}% (from {source})")
            
            # Use AI deficiencies for recommendations, but ML for primary detection
            combined_deficiencies = all_deficiencies
            
            # Cross-verify the analysis against historical feedback
            cross_verification = feedback_service.cross_verify_analysis(
                disease=vitamin_name,
                deficiencies=combined_deficiencies,
                predicted_confidence=confidence
            )
            
            adjusted_confidence = cross_verification['overall_adjusted_confidence']
            adjustment_factor = cross_verification.get('adjustment_factor', 1.0)
            
            print(f"✅ Cross-verification complete")
            print(f"   Adjustment factor: {adjustment_factor:.2f}x")
            print(f"   Adjusted confidence: {adjusted_confidence:.1f}%")
            print(f"\n🎯 FINAL CONFIDENCE: {adjusted_confidence:.0f}%")
            print("━" * 60)
            
            process_log.append({
                "step": "cross_verification", 
                "status": "success", 
                "message": f"Verified {len(combined_deficiencies)} deficiencies - Adjusted confidence: {adjusted_confidence}%"
            })
            process_log.append({
                "step": "feedback_layer", 
                "status": "success", 
                "message": f"{source} Primary: {vitamin_name} - Verified confidence - Ready for feedback"
            })
            
            # Clean up vitamin name - remove duplicate "Deficiency" if present
            disease_name = vitamin_name if "Deficiency" in vitamin_name else f"{vitamin_name} Deficiency"
            
            # Merge deficiencies from both sources, avoiding duplicates
            merged_deficiencies = []
            seen_vitamins = set()
            
            # Add all deficiencies from combined list (already sorted by likelihood)
            # ONLY include deficiencies with likelihood > 0
            for d in combined_deficiencies:
                if d.get("likelihood", 0) <= 0:
                    continue  # Skip 0% likelihood deficiencies
                vitamin_key = d.get("vitamin", "").lower().replace(" deficiency", "")
                if vitamin_key not in seen_vitamins:
                    seen_vitamins.add(vitamin_key)
                    merged_deficiencies.append(d)
            
            # Generate supplements for merged deficiencies if not already present
            existing_supplements = ai_result.get("supplements", [])
            existing_supplement_names = {s.get("name", "").lower() for s in existing_supplements}
            
            # TABLE 4: AGE-BASED DOSAGE MULTIPLIERS FOR SUPPLEMENT RECOMMENDATIONS
            age_group = request.form.get("age_group", "Young Adult")
            age_multipliers = {
                "Infant": 0.10, "Toddler": 0.15, "Preschooler": 0.25,
                "Child": 0.40, "Adolescent": 0.70, "Young Adult": 1.00,
                "Adult": 1.00, "Mature Adult": 0.85, "Senior": 0.70
            }
            age_multiplier = age_multipliers.get(age_group, 1.00)

            # Supplement database for ML-detected deficiencies with age adjustment
            def get_age_adjusted_dosage(standard_dosage, multiplier):
                if multiplier == 1.0:
                    return standard_dosage
                # Simple heuristic to extract numeric part and scale it
                import re
                numbers = re.findall(r"(\d+(?:\.\d+)?)", standard_dosage)
                if not numbers:
                    return standard_dosage
                new_dosage = standard_dosage
                for n in set(numbers):
                    scaled = float(n) * multiplier
                    if scaled < 1:
                        scaled_str = f"{scaled:.2f}"
                    elif scaled < 10:
                        scaled_str = f"{scaled:.1f}"
                    else:
                        scaled_str = str(int(scaled))
                    new_dosage = new_dosage.replace(n, scaled_str)
                return f"{new_dosage} (Age Adjusted: {int(multiplier*100)}%)"

            supplement_db = {
                "vitamin e": {"name": "Vitamin E (Tocopherol)", "dosage": get_age_adjusted_dosage("15 mg daily", age_multiplier), "description": "Take with a meal containing healthy fats for better absorption", "brands": ["Solgar", "Nature Made", "NOW Foods"], "timeline": "8-12 weeks"},
                "vitamin c": {"name": "Vitamin C (Ascorbic Acid)", "dosage": get_age_adjusted_dosage("500-1000 mg daily", age_multiplier), "description": "Take with meals to reduce stomach upset", "brands": ["Nature Made", "Emergen-C", "Garden of Life"], "timeline": "4-6 weeks"},
                "vitamin d": {"name": "Vitamin D3", "dosage": get_age_adjusted_dosage("2000 IU daily", age_multiplier), "description": "Take with fatty foods for optimal absorption", "brands": ["Nature Made", "NOW Foods", "Garden of Life"], "timeline": "8-12 weeks"},
                "vitamin a": {"name": "Vitamin A (Retinol)", "dosage": get_age_adjusted_dosage("3000-5000 IU daily", age_multiplier), "description": "Take with food containing healthy fats", "brands": ["Solgar", "Nature's Bounty", "NOW Foods"], "timeline": "6-10 weeks"},
                "vitamin b12": {"name": "Vitamin B12 (Cobalamin)", "dosage": get_age_adjusted_dosage("1000 mcg daily", age_multiplier), "description": "Can be taken with or without food", "brands": ["Nature Made", "Jarrow Formulas", "Solgar"], "timeline": "6-8 weeks"},
                "vitamin b1": {"name": "Vitamin B1 (Thiamine)", "dosage": get_age_adjusted_dosage("50-100 mg daily", age_multiplier), "description": "Take with meals", "brands": ["Nature Made", "NOW Foods", "Solgar"], "timeline": "4-6 weeks"},
                "vitamin b2": {"name": "Vitamin B2 (Riboflavin)", "dosage": get_age_adjusted_dosage("25-50 mg daily", age_multiplier), "description": "Take with food for better absorption", "brands": ["NOW Foods", "Nature's Bounty", "Solgar"], "timeline": "4-6 weeks"},
                "vitamin b3": {"name": "Vitamin B3 (Niacin)", "dosage": get_age_adjusted_dosage("14-16 mg daily", age_multiplier), "description": "Take with meals to reduce flushing", "brands": ["Nature Made", "Solaray", "NOW Foods"], "timeline": "4-6 weeks"},
                "iron": {"name": "Iron (Ferrous Sulfate)", "dosage": get_age_adjusted_dosage("65 mg daily", age_multiplier), "description": "Take on empty stomach with vitamin C for better absorption", "brands": ["Feosol", "Nature Made", "Slow Fe"], "timeline": "8-12 weeks"},
                "zinc": {"name": "Zinc", "dosage": get_age_adjusted_dosage("15-30 mg daily", age_multiplier), "description": "Take with food to prevent stomach upset", "brands": ["NOW Foods", "Nature's Bounty", "Thorne"], "timeline": "4-8 weeks"},
                "biotin": {"name": "Biotin (Vitamin B7)", "dosage": get_age_adjusted_dosage("30-100 mcg daily", age_multiplier), "description": "Can be taken with or without food", "brands": ["Nature's Bounty", "Sports Research", "Natrol"], "timeline": "3-6 months"},
                "folate": {"name": "Folate (Vitamin B9)", "dosage": get_age_adjusted_dosage("400-800 mcg daily", age_multiplier), "description": "Take with food", "brands": ["Nature Made", "Solgar", "Garden of Life"], "timeline": "4-8 weeks"},
                "vitamin k": {"name": "Vitamin K", "dosage": get_age_adjusted_dosage("90-120 mcg daily", age_multiplier), "description": "Take with fatty foods", "brands": ["Thorne", "Life Extension", "NOW Foods"], "timeline": "2-4 weeks"},
            }
            
            # Add supplements ONLY for deficiencies with likelihood > 30% (significant deficiencies)
            # Limit to top 3 supplements
            merged_supplements = list(existing_supplements)
            supplement_count = len(merged_supplements)
            for d in merged_deficiencies[:3]:  # Top 3 deficiencies only
                if d.get("likelihood", 0) < 30:
                    continue  # Only add supplements for significant deficiencies
                if supplement_count >= 3:
                    break  # Max 3 supplements total
                vitamin_key = d.get("vitamin", "").lower().replace(" deficiency", "")
                if vitamin_key in supplement_db:
                    supp = supplement_db[vitamin_key]
                    if supp["name"].lower() not in existing_supplement_names:
                        merged_supplements.append(supp)
                        existing_supplement_names.add(supp["name"].lower())
                        supplement_count += 1
            
            # Update ai_analysis with merged deficiencies and supplements
            ai_result_with_merged = {**ai_result}
            ai_result_with_merged["deficiencies"] = merged_deficiencies
            ai_result_with_merged["supplements"] = merged_supplements[:3]  # Limit to max 3 supplements
            
            feedback_result = {
                "image_hash": image_hash,
                "disease": disease_name,
                "vitamin_deficiency": vitamin_name.replace(" Deficiency", ""),
                "confidence": adjusted_confidence,
                "confidence_before_verification": confidence,
                "confidence_after_verification": adjusted_confidence,
                "primary_analysis": f"{source} (Highest Confidence)",
                "analysis_source": source,
                "ml_analysis": {
                    "deficiencies": ml_deficiencies,
                    "status": "Combined Analysis",
                    "source": "ML Model"
                },
                "ai_analysis": ai_result_with_merged,  # Merged deficiencies and supplements from both sources
                "cross_verification": cross_verification,  # Full verification report
                "process_log": process_log,
                "feedback_enabled": True,
                "feedback_priority": "HIGH"
            }
        
        else:
            # Both models found no deficiencies
            print("✅ Result: No Deficiencies Found")
            print("ℹ️  Skin appears normal across all models")
            process_log.append({
                "step": "cross_verification", 
                "status": "skipped", 
                "message": "No deficiencies found by either model - no verification needed"
            })
            process_log.append({
                "step": "feedback_layer", 
                "status": "success", 
                "message": "No deficiencies detected by either model - Result is Normal - Ready for feedback"
            })
            
            feedback_result = {
                "image_hash": image_hash,
                "disease": "Normal",
                "vitamin_deficiency": "None",
                "confidence": 95,
                "is_normal": True,
                "status": "Normal",
                "message": "Your skin appears healthy with no significant vitamin deficiencies detected.",
                "analysis_source": "Combined Analysis (ML + Gemini AI)",
                "ml_analysis": {
                    "deficiencies": [],
                    "status": "Normal",
                    "is_normal": True,
                    "explanation": ml_result.get("explanation", "No deficiencies detected")
                },
                "ai_analysis": ai_result,
                "cross_verification": {
                    "status": "N/A",
                    "message": "No deficiencies detected - verification not applicable"
                },
                "process_log": process_log,
                "feedback_enabled": True,
                "feedback_priority": "HIGH"
            }
        
        return jsonify(feedback_result)
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Server error",
            "message": str(e)
        }), 500

# --- Health check ---
@app.route("/ping", methods=["GET"])
def ping():
    """Health check endpoint"""
    return {"status": "ok", "message": "Backend is running"}, 200



@app.route("/", methods=["GET"])
def root():
    """Root endpoint"""
    return {"status": "ok", "message": "Backend is running"}, 200


# --- Test API endpoint ---
@app.route("/test-api", methods=["GET"])
def test_api():
    """Test AI service availability"""
    try:
        ai_service.refresh_client()
        return jsonify({
            "status": "ok",
            "message": "AI service is available"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/test-gemini", methods=["GET"])
def test_gemini():
    """Test Gemini AI detection with a sample image"""
    try:
        # Create a simple test image (1x1 pixel)
        test_image = Image.new('RGB', (100, 100), color='red')
        img_byte_arr = io.BytesIO()
        test_image.save(img_byte_arr, format='JPEG')
        test_image_bytes = img_byte_arr.getvalue()
        
        # Try to analyze it
        result = ai_service.analyze_deficiencies(test_image_bytes)
        
        if result.get("deficiencies"):
            return jsonify({
                "status": "ok",
                "message": "Gemini AI is working",
                "deficiencies_detected": len(result.get("deficiencies", [])),
                "result": result
            })
        else:
            explanation = result.get("explanation", "Unknown error")
            return jsonify({
                "status": "error",
                "message": "Gemini AI returned no results",
                "explanation": explanation,
                "result": result
            }), 503
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# --- Feedback System Endpoints ---
@app.route("/submit-feedback", methods=["POST"])
def submit_feedback():
    """Submit feedback for an analysis with optional image"""
    try:
        image_hash = request.form.get("image_hash")
        analysis_result_str = request.form.get("analysis_result")
        is_accurate = request.form.get("is_accurate", "false").lower() == "true"
        feedback_text = request.form.get("feedback_text", "")
        image_file = request.files.get("image_file")
        
        print("\n📨 FEEDBACK SUBMISSION:")
        print("━" * 60)
        print(f"🔖 Image Hash: {image_hash}")
        print(f"✅ Accurate: {is_accurate}")
        
        if not image_hash or not analysis_result_str:
            print("❌ Missing required fields")
            return jsonify({"error": "Missing required fields"}), 400
        
        # Parse analysis result from JSON string
        import json
        try:
            analysis_result = json.loads(analysis_result_str)
        except json.JSONDecodeError:
            print("❌ Invalid analysis_result JSON")
            return jsonify({"error": "Invalid analysis_result JSON"}), 400
        
        # Save image if provided
        image_path: str | None = None
        if image_file and image_file.filename:
            print(f"📸 Saving feedback image: {image_file.filename}")
            image_data = image_file.read()
            image_path = feedback_service.save_feedback_image(image_hash, image_data)
        
        # Submit feedback
        result = feedback_service.submit_feedback(
            image_hash=image_hash,
            analysis_result=analysis_result,
            is_accurate=is_accurate,
            feedback_text=feedback_text,
            image_path=image_path  # type: ignore
        )
        
        print(f"✅ Feedback submitted successfully")
        print(f"📊 Total feedback entries: {len(feedback_service.feedback_history)}")
        return jsonify(result)
    
    except Exception as e:
        return jsonify({
            "error": "Feedback submission failed",
            "message": str(e)
        }), 500


@app.route("/get-statistics", methods=["GET"])
def get_statistics():
    """Get system statistics and accuracy metrics"""
    try:
        stats = feedback_service.get_statistics()
        return jsonify(stats)
    except Exception as e:
        return jsonify({
            "error": "Failed to get statistics",
            "message": str(e)
        }), 500


@app.route("/get-disease-accuracy/<disease>", methods=["GET"])
def get_disease_accuracy(disease):
    """Get accuracy metrics for a specific disease"""
    try:
        metrics = feedback_service.get_accuracy_by_disease(disease)
        return jsonify(metrics)
    except Exception as e:
        return jsonify({
            "error": "Failed to get disease accuracy",
            "message": str(e)
        }), 500


@app.route("/get-feedback-history", methods=["GET"])
def get_feedback_history():
    """Get complete feedback history for verification"""
    try:
        return jsonify(feedback_service.feedback_history)
    except Exception as e:
        return jsonify({
            "error": "Failed to get feedback history",
            "message": str(e)
        }), 500


@app.route("/delete-feedback", methods=["DELETE"])
def delete_feedback():
    """Delete a single feedback entry"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        image_hash = data.get("image_hash")
        
        if not image_hash:
            return jsonify({"error": "Missing image_hash"}), 400
        
        result = feedback_service.delete_feedback_entry(image_hash)
        
        if "error" in result:
            return jsonify(result), 404
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({
            "error": "Failed to delete feedback",
            "message": str(e)
        }), 500


@app.route("/verify-feedback", methods=["POST"])
def verify_feedback():
    """Verify/approve or reject feedback entry"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        image_hash = data.get("image_hash")
        approved = data.get("approved", False)
        verification_notes = data.get("verification_notes", "")
        
        if not image_hash:
            return jsonify({"error": "Missing image_hash"}), 400
        
        # Update feedback status in feedback service
        status = "verified" if approved else "rejected"
        result = feedback_service.verify_feedback_entry(
            image_hash=image_hash,
            approved=approved,
            verification_notes=verification_notes
        )
        
        return jsonify({
            "status": "success",
            "message": f"Feedback {status} successfully",
            "result": result
        })
    
    except Exception as e:
        return jsonify({
            "error": "Feedback verification failed",
            "message": str(e)
        }), 500


@app.route("/feedback_data/images/<path:filename>", methods=["GET"])
def serve_feedback_image(filename):
    """Serve feedback image files"""
    try:
        images_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "feedback_data",
            "images"
        )
        
        full_path = os.path.join(images_dir, filename)
        
        # Security check - ensure we're not escaping the images directory
        if not os.path.abspath(full_path).startswith(os.path.abspath(images_dir)):
            return jsonify({"error": "Invalid path"}), 400
        
        if not os.path.exists(full_path):
            return jsonify({"error": f"Image not found: {full_path}"}), 404
        
        return send_from_directory(images_dir, filename)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def save_backend_url(port):
    """Detects local IP and saves the URL to a file for the frontend to use"""
    import socket
    try:
        # Create a temporary socket to find the local IP address
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # We don't need to actually connect, this just helps pick the correct interface
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        
        url = f"http://{local_ip}:{port}"
        
        # Save to a file in the Frontend's public folder so it can be fetched
        frontend_public_path = os.path.join(os.path.dirname(__file__), "..", "Frontend", "public", "backend_url.txt")
        
        # Ensure the Frontend/public directory exists (it should, but just in case)
        os.makedirs(os.path.dirname(frontend_public_path), exist_ok=True)
        
        with open(frontend_public_path, "w") as f:
            f.write(url)
            
        print(f"📡 Backend URL saved to: {frontend_public_path}")
        print(f"🔗 Connect at: {url}")
        
    except Exception as e:
        print(f"⚠️ Could not automatically save backend URL: {e}")

if __name__ == "__main__":
    PORT = 5000
    save_backend_url(PORT)
    app.run(host="0.0.0.0", port=PORT, debug=False)


