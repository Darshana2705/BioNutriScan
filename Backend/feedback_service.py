import os
import json
from datetime import datetime
from pathlib import Path

class FeedbackService:
    """Service to manage user feedback and improve model accuracy"""
    
    def __init__(self):
        self.feedback_dir = os.path.join(os.path.dirname(__file__), "feedback_data")
        self.images_dir = os.path.join(self.feedback_dir, "images")
        self.feedback_file = os.path.join(self.feedback_dir, "feedback_history.json")
        self.accuracy_file = os.path.join(self.feedback_dir, "accuracy_metrics.json")
        
        # Create feedback directories if they don't exist
        Path(self.feedback_dir).mkdir(parents=True, exist_ok=True)
        Path(self.images_dir).mkdir(parents=True, exist_ok=True)
        
        # Load or initialize feedback history
        self.feedback_history = self._load_feedback_history()
        self.accuracy_metrics = self._load_accuracy_metrics()
    
    def _load_feedback_history(self) -> dict:
        """Load feedback history from file"""
        if os.path.exists(self.feedback_file):
            try:
                with open(self.feedback_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ Error loading feedback history: {str(e)}")
                return {}
        return {}
    
    def _load_accuracy_metrics(self) -> dict:
        """Load accuracy metrics from file"""
        if os.path.exists(self.accuracy_file):
            try:
                with open(self.accuracy_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ Error loading accuracy metrics: {str(e)}")
                return {"total_analyses": 0, "correct_analyses": 0, "accuracy_percentage": 0}
        return {"total_analyses": 0, "correct_analyses": 0, "accuracy_percentage": 0}
    
    def _save_feedback_history(self):
        """Save feedback history to file"""
        try:
            with open(self.feedback_file, 'w') as f:
                json.dump(self.feedback_history, f, indent=2)
        except Exception as e:
            print(f"❌ Error saving feedback history: {str(e)}")
    
    def _save_accuracy_metrics(self):
        """Save accuracy metrics to file"""
        try:
            with open(self.accuracy_file, 'w') as f:
                json.dump(self.accuracy_metrics, f, indent=2)
        except Exception as e:
            print(f"❌ Error saving accuracy metrics: {str(e)}")
    
    def save_feedback_image(self, image_hash: str, image_data: bytes) -> str | None:
        """
        Save feedback image to disk
        
        Args:
            image_hash: Hash identifier for the image
            image_data: Binary image data
        
        Returns:
            Path to saved image file or None if error occurred
        """
        try:
            # Create filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{image_hash}_{timestamp}.jpg"
            filepath = os.path.join(self.images_dir, filename)
            
            # Save image
            with open(filepath, 'wb') as f:
                f.write(image_data)
            
            print(f"✅ Image saved: {filepath}")
            return filepath
        except Exception as e:
            print(f"❌ Error saving image: {str(e)}")
            return None
    
    def submit_feedback(self, image_hash: str, analysis_result: dict, is_accurate: bool, feedback_text: str = "", image_path: str | None = None) -> dict:
        """
        Submit feedback for an analysis with verification workflow
        
        Args:
            image_hash: Hash of the analyzed image
            analysis_result: The analysis result that was returned
            is_accurate: Whether the analysis was accurate/helpful
            feedback_text: Optional detailed feedback from user
            image_path: Path to stored image file
        
        Returns:
            Feedback acknowledgment and confidence adjustment
        """
        # Part I-2: VERIFICATION WORKFLOW
        # ● Pending State: Initial submission awaiting review
        # ● Verification: Administrator review with clinical validation
        # ● Final Status: Approved (verified) or Rejected
        
        feedback_entry = {
            "timestamp": datetime.now().isoformat(),
            "image_hash": image_hash,
            "is_accurate": is_accurate,
            "feedback_text": feedback_text,
            "image_path": image_path,
            "detected_disease": analysis_result.get("disease"),
            "confidence": analysis_result.get("confidence"),
            "is_normal": analysis_result.get("is_normal", False),
            "deficiencies_count": len(analysis_result.get("deficiencies", [])),
            "verification_status": "Pending", # Initial submission awaiting review
            "verification_date": None
        }
        
        # Store feedback
        self.feedback_history[image_hash] = feedback_entry
        self._save_feedback_history()
        
        # Update accuracy metrics
        self.accuracy_metrics["total_analyses"] += 1
        if is_accurate:
            self.accuracy_metrics["correct_analyses"] += 1
        
        # Calculate accuracy percentage
        total = self.accuracy_metrics["total_analyses"]
        correct = self.accuracy_metrics["correct_analyses"]
        self.accuracy_metrics["accuracy_percentage"] = round((correct / total) * 100, 2) if total > 0 else 0
        
        self._save_accuracy_metrics()
        
        print(f"✅ Feedback submitted: {'Accurate' if is_accurate else 'Inaccurate'}")
        print(f"📊 Overall accuracy: {self.accuracy_metrics['accuracy_percentage']}%")
        
        return {
            "status": "success",
            "message": f"Thank you for your feedback! Current model accuracy: {self.accuracy_metrics['accuracy_percentage']}%",
            "accuracy_metrics": self.accuracy_metrics
        }
    
    def get_accuracy_by_disease(self, disease: str) -> dict:
        """Get accuracy metrics for a specific disease"""
        disease_feedbacks = [
            fb for fb in self.feedback_history.values()
            if fb.get("detected_disease") == disease
        ]
        
        if not disease_feedbacks:
            return {"disease": disease, "total": 0, "accurate": 0, "accuracy": 0, "adjustment_factor": 1.0}
        
        total = len(disease_feedbacks)
        accurate = sum(1 for fb in disease_feedbacks if fb.get("is_accurate"))
        accuracy = (accurate / total) * 100
        
        # TABLE 3: CONFIDENCE ADJUSTMENT FACTORS BASED ON HISTORICAL ACCURACY
        adjustment_factor = 1.0
        if accuracy >= 100:
            adjustment_factor = 1.20
        elif accuracy >= 75:
            adjustment_factor = 1.10
        elif accuracy >= 50:
            adjustment_factor = 1.00
        elif accuracy > 0:
            adjustment_factor = 0.90
        else:
            adjustment_factor = 0.70
            
        return {
            "disease": disease, 
            "total": total, 
            "accurate": accurate, 
            "accuracy": accuracy,
            "adjustment_factor": adjustment_factor
        }
        accuracy = round((accurate / total) * 100, 2)
        
        return {
            "disease": disease,
            "total": total,
            "accurate": accurate,
            "accuracy": accuracy
        }
    
    def get_confidence_adjustment(self, disease: str) -> float:
        """
        Calculate confidence adjustment factor based on past accuracy
        
        If a disease has been correctly identified before, boost confidence
        If it has been incorrect, reduce confidence
        """
        metrics = self.get_accuracy_by_disease(disease)
        
        if metrics["total"] == 0:
            return 1.0  # No adjustment if no history
        
        accuracy = metrics["accuracy"] / 100
        
        # Adjustment factor: 0.8 to 1.2 based on accuracy
        # If 100% accurate in past: boost by 20%
        # If 0% accurate in past: reduce by 20%
        adjustment = 0.8 + (accuracy * 0.4)
        
        return round(adjustment, 2)
    
    def get_statistics(self) -> dict:
        """Get overall system statistics"""
        return {
            "accuracy_metrics": self.accuracy_metrics,
            "total_feedbacks": len(self.feedback_history),
            "feedback_history_sample": list(self.feedback_history.values())[-5:] if self.feedback_history else []
        }
    
    def delete_feedback_entry(self, image_hash: str) -> dict:
        """
        Delete a feedback entry
        
        Args:
            image_hash: Hash of the image to delete
        
        Returns:
            Deletion result
        """
        if image_hash not in self.feedback_history:
            return {"error": f"Feedback entry not found for hash: {image_hash}"}
        
        # Get the entry before deleting (to delete associated image if exists)
        entry = self.feedback_history[image_hash]
        image_path = entry.get("image_path")
        
        # Delete from history
        del self.feedback_history[image_hash]
        self._save_feedback_history()
        
        # Try to delete associated image file
        if image_path and os.path.exists(image_path):
            try:
                os.remove(image_path)
                print(f"✅ Deleted image: {image_path}")
            except Exception as e:
                print(f"⚠️ Could not delete image: {str(e)}")
        
        # Update accuracy metrics
        if entry.get("is_accurate"):
            self.accuracy_metrics["correct_analyses"] -= 1
        self.accuracy_metrics["total_analyses"] -= 1
        
        # Recalculate accuracy percentage
        total = self.accuracy_metrics["total_analyses"]
        correct = self.accuracy_metrics["correct_analyses"]
        self.accuracy_metrics["accuracy_percentage"] = round((correct / total) * 100, 2) if total > 0 else 0
        self._save_accuracy_metrics()
        
        print(f"✅ Deleted feedback entry: {image_hash}")
        
        return {
            "status": "success",
            "message": f"Feedback entry deleted successfully",
            "deleted_hash": image_hash
        }
    
    def verify_feedback_entry(self, image_hash: str, approved: bool, verification_notes: str = "") -> dict:
        """
        Verify/approve or reject a feedback entry
        
        Args:
            image_hash: Hash of the image to verify
            approved: Whether to approve (True) or reject (False)
            verification_notes: Notes from the verifier
        
        Returns:
            Updated feedback entry
        """
        if image_hash not in self.feedback_history:
            return {"error": f"Feedback entry not found for hash: {image_hash}"}
        
        # Update status
        status = "verified" if approved else "rejected"
        self.feedback_history[image_hash]["status"] = status
        self.feedback_history[image_hash]["verified_at"] = datetime.now().isoformat()
        self.feedback_history[image_hash]["verification_notes"] = verification_notes
        self.feedback_history[image_hash]["approved"] = approved
        
        self._save_feedback_history()
        
        print(f"✅ Feedback {status}: {image_hash}")
        
        return {
            "image_hash": image_hash,
            "status": status,
            "verified_at": self.feedback_history[image_hash]["verified_at"],
            "verification_notes": verification_notes
        }
    
    def cross_verify_vitamin_deficiency(self, vitamin_name: str, predicted_confidence: float) -> dict:
        """
        Cross-verify a predicted vitamin deficiency against historical feedback data
        
        Args:
            vitamin_name: Name of the vitamin to verify (e.g., "Vitamin C")
            predicted_confidence: Confidence level from the prediction (0-100)
        
        Returns:
            Verification result with historical accuracy, confidence adjustment, and insights
        """
        # Find all feedback entries for this vitamin
        vitamin_feedbacks = [
            fb for fb in self.feedback_history.values()
            if vitamin_name.lower() in fb.get("detected_disease", "").lower()
        ]
        
        if not vitamin_feedbacks:
            return {
                "vitamin": vitamin_name,
                "predicted_confidence": predicted_confidence,
                "verification_status": "NO_HISTORICAL_DATA",
                "message": "No historical feedback data available for cross-verification",
                "confidence_adjustment": 1.0,
                "adjusted_confidence": predicted_confidence,
                "feedback_count": 0,
                "historical_accuracy": None,
                "recommendation": "First prediction for this vitamin - baseline confidence used"
            }
        
        # Analyze historical feedback for this vitamin
        total_predictions = len(vitamin_feedbacks)
        accurate_predictions = sum(1 for fb in vitamin_feedbacks if fb.get("is_accurate", False))
        historical_accuracy = round((accurate_predictions / total_predictions * 100), 2) if total_predictions > 0 else 0
        
        # Calculate confidence adjustment based on historical accuracy
        if historical_accuracy == 100:
            confidence_adjustment = 1.2  # Boost by 20% for perfect history
            adjustment_type = "BOOST"
        elif historical_accuracy >= 75:
            confidence_adjustment = 1.1  # Boost by 10% for good history
            adjustment_type = "SLIGHT_BOOST"
        elif historical_accuracy >= 50:
            confidence_adjustment = 1.0  # No adjustment for average history
            adjustment_type = "NEUTRAL"
        elif historical_accuracy > 0:
            confidence_adjustment = 0.9  # Reduce by 10% for poor history
            adjustment_type = "SLIGHT_REDUCE"
        else:
            confidence_adjustment = 0.7  # Reduce by 30% for failed predictions
            adjustment_type = "STRONG_REDUCE"
        
        # Calculate adjusted confidence (capped at 100)
        adjusted_confidence = min(100, round(predicted_confidence * confidence_adjustment, 1))
        
        # Get verified feedback entries for more reliability assessment
        verified_feedbacks = [
            fb for fb in vitamin_feedbacks
            if fb.get("status") == "verified"
        ]
        
        verification_reliability = len(verified_feedbacks) / total_predictions if total_predictions > 0 else 0
        
        return {
            "vitamin": vitamin_name,
            "predicted_confidence": predicted_confidence,
            "verification_status": "VERIFIED" if verified_feedbacks else "UNVERIFIED_DATA",
            "message": f"Cross-verified against {total_predictions} historical predictions ({accurate_predictions} accurate)",
            "feedback_count": total_predictions,
            "accurate_count": accurate_predictions,
            "historical_accuracy": historical_accuracy,
            "confidence_adjustment": confidence_adjustment,
            "adjustment_type": adjustment_type,
            "adjusted_confidence": adjusted_confidence,
            "verified_count": len(verified_feedbacks),
            "verification_reliability": round(verification_reliability * 100, 1),
            "recommendation": self._get_verification_recommendation(
                historical_accuracy, 
                adjusted_confidence, 
                total_predictions,
                verification_reliability
            )
        }
    
    def _get_verification_recommendation(self, accuracy: float, confidence: float, count: int, reliability: float) -> str:
        """Generate recommendation based on verification results"""
        if count < 3:
            return "Limited historical data - use with caution until more feedback is collected"
        
        if accuracy == 100 and reliability >= 0.8:
            return "Highly reliable prediction based on strong historical accuracy"
        
        if accuracy >= 80 and confidence >= 70:
            return "Good confidence - prediction is consistent with historical accuracy"
        
        if accuracy >= 50 and confidence >= 60:
            return "Moderate confidence - recommended for further verification"
        
        if accuracy < 50:
            return "Low historical accuracy - recommend manual review before accepting this prediction"
        
        if reliability < 0.5:
            return "Data is mostly unverified - recommend manual verification"
        
        return "Use prediction with caution - collect more verified feedback for better accuracy"
    
    def cross_verify_analysis(self, disease: str, deficiencies: list, predicted_confidence: float) -> dict:
        """
        Cross-verify complete analysis against historical feedback
        
        Args:
            disease: Disease/condition name
            deficiencies: List of detected deficiencies
            predicted_confidence: Overall confidence level
        
        Returns:
            Comprehensive cross-verification report
        """
        verification_results = {
            "disease": disease,
            "predicted_confidence": predicted_confidence,
            "total_deficiencies": len(deficiencies),
            "deficiency_verifications": [],
            "overall_adjustment_factor": 1.0,
            "overall_adjusted_confidence": predicted_confidence,
            "verification_summary": []
        }
        
        # Cross-verify each deficiency
        adjustment_factors = []
        for deficiency in deficiencies:
            vitamin_name = deficiency.get("vitamin", "Unknown")
            vitamin_confidence = deficiency.get("likelihood", 0)
            
            verification = self.cross_verify_vitamin_deficiency(vitamin_name, vitamin_confidence)
            verification_results["deficiency_verifications"].append(verification)
            adjustment_factors.append(verification["confidence_adjustment"])
            
            print(f"✅ Cross-verified {vitamin_name}: {verification['historical_accuracy']}% accuracy ({verification['feedback_count']} samples)")
        
        # Calculate overall adjustment factor (average of all adjustments)
        if adjustment_factors:
            verification_results["overall_adjustment_factor"] = round(sum(adjustment_factors) / len(adjustment_factors), 2)
            verification_results["overall_adjusted_confidence"] = min(
                100, 
                round(predicted_confidence * verification_results["overall_adjustment_factor"], 1)
            )
        
        # Generate verification summary
        high_confidence_verifications = [
            v for v in verification_results["deficiency_verifications"]
            if (v.get("historical_accuracy") or 0) >= 80
        ]
        
        if high_confidence_verifications:
            count = len(high_confidence_verifications)
            total = len(verification_results["deficiency_verifications"])
            verification_results["verification_summary"].append(
                f"{count}/{total} deficiencies verified with high historical accuracy (≥80%)"
            )
        
        low_confidence_verifications = [
            v for v in verification_results["deficiency_verifications"]
            if (v.get("historical_accuracy") or 0) < 50 and v.get("historical_accuracy") is not None
        ]
        
        if low_confidence_verifications:
            count = len(low_confidence_verifications)
            verification_results["verification_summary"].append(
                f"⚠️ {count} deficiencies have low historical accuracy (<50%) - recommend manual review"
            )
        
        unverified = [
            v for v in verification_results["deficiency_verifications"]
            if v["verification_status"] == "NO_HISTORICAL_DATA"
        ]
        
        if unverified:
            count = len(unverified)
            verification_results["verification_summary"].append(
                f"ℹ️ {count} deficiencies have no historical data for cross-verification"
            )
        
        return verification_results
