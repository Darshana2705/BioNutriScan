import os
import json
import hashlib
from google import genai # type: ignore
from google.genai import types # type: ignore
from dotenv import load_dotenv

load_dotenv()


class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
        self.client = genai.Client(api_key=self.api_key)
        self.cache = {}  # Simple in-memory cache for image analysis
    
    def refresh_client(self):
        """Refresh client with current API key"""
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.client = genai.Client(api_key=self.api_key)
        return self.client
    
    def validate_image(self, image_bytes: bytes) -> dict:
        """
        Validate if image contains human face or body
        Returns: {"is_valid": bool, "message": str}
        """
        validation_prompt = """
Analyze this image and determine if it shows a human face or human body part (like hands, arms, legs, skin, etc.).

Respond with ONLY a JSON object in this exact format:
{
  "is_human": true/false,
  "reason": "Brief explanation"
}

Return true only if you can see human facial features or human body parts. Return false for animals, objects, landscapes, or non-human content.
"""
        
        try:
            image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            
            response = self.client.models.generate_content(
                model=self.model,
                contents=[image_part, validation_prompt],
                config=types.GenerateContentConfig(temperature=0.2)
            )
            
            text = (response.text or "").strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            result = json.loads(text)
            
            if not result.get("is_human", False):
                return {"is_valid": False, "message": "The provided image is not proper."}
            
            return {"is_valid": True, "message": result.get("reason", "Valid image")}
            
        except Exception as e:
            error_msg = str(e)
            print(f"Image validation error: {error_msg}")
            
            # Check if it's a network error
            if "nodename" in error_msg or "servname" in error_msg or "getaddrinfo" in error_msg:
                return {"is_valid": False, "message": "Network error - validation skipped"}
            
            return {"is_valid": False, "message": "Unable to validate image"}
    
    def analyze_deficiencies(self, image_bytes: bytes) -> dict:
        """
        Analyze image for vitamin deficiencies with comprehensive recommendations
        Returns: Full analysis with deficiencies, recommendations, supplements, etc.
        """
        # Check cache first
        image_hash = hashlib.md5(image_bytes).hexdigest()
        
        # Clear cache to force new analysis with updated prompt format
        # Remove this line after first run if you want caching
        self.cache.pop(image_hash, None)
        
        if image_hash in self.cache:
            print(f"✅ Cached analysis result returned")
            return self.cache[image_hash]
        
        analysis_prompt = """
You are an expert dermatological AI assistant specializing in identifying vitamin and mineral deficiencies from visual clinical signs in medical photographs.

════════════════════════════════════════════════════════════════
CRITICAL MISSION - TWO-STEP ANALYSIS PROCESS
════════════════════════════════════════════════════════════════

STEP 1: HEALTH STATUS CHECK
First, carefully examine the skin to determine if it appears NORMAL and HEALTHY:
- Look for clear, unblemished skin with uniform color
- Check for natural skin tone appropriate for the person's ethnicity
- Look for healthy texture and good hydration
- Check for absence of visible lesions, rashes, or abnormalities
- NO petechiae (small red/purple spots), bruising, extreme pallor, or unusual pigmentation
- NO visible inflammation, acne, pustules, dermatitis, or scaly patches
- Nails appear healthy, normal colored, smooth
- No visible hair loss, thinning, or unusual hair conditions
- Gums appear healthy (if visible)
- Overall appearance suggests good nutritional status

REMEMBER: Most healthy people have normal skin! If you do not see CLEAR ABNORMALITIES, mark as normal.

IF THE SKIN APPEARS NORMAL AND HEALTHY:
→ Return "is_normal": true immediately
→ Do NOT proceed with deficiency analysis
→ Return empty deficiencies, disease_risks, supplements arrays

IF THE SKIN CLEARLY SHOWS ABNORMALITIES:
→ Return "is_normal": false
→ THEN proceed to STEP 2

STEP 2: DETAILED VITAMIN DEFICIENCY ANALYSIS (ONLY if is_normal = false)
Only proceed with this analysis if abnormalities were detected in Step 1.
Analyze this image systematically to identify ALL visible deficiency indicators.

═══════════════════════════════════════════════════════════════
COMPREHENSIVE DEFICIENCY INDICATORS DATABASE
═══════════════════════════════════════════════════════════════

**VITAMIN C (Ascorbic Acid) - SCURVY:**
PRIMARY SIGNS:
- Petechiae: Small red/purple pinpoint spots (perifollicular hemorrhages)
- Ecchymoses: Larger bruising, purple/blue patches
- Skin inflammation: Red, inflamed areas
- Acne-like pustular lesions
- Perifollicular keratosis: Rough bumpy skin around hair follicles
- Corkscrew hairs
SECONDARY SIGNS:
- Bleeding gums, swollen gums
- Poor wound healing
- Splinter hemorrhages under nails
- Subconjunctival hemorrhage (eye redness)
FOOD SOURCES: Citrus fruits, bell peppers, broccoli, strawberries
SEVERITY MARKERS: Multiple petechiae = high likelihood (80-95%)

**VITAMIN A (Retinol):**
PRIMARY SIGNS:
- Follicular hyperkeratosis: Rough, bumpy "chicken skin" texture
- Phrynoderma: "Toad skin" - severe dry bumpy skin
- Xerosis: Extremely dry, scaly skin
- Acne, comedones (blackheads/whiteheads)
SECONDARY SIGNS:
- Bitot's spots (white/gray triangular patches on conjunctiva)
- Dry brittle hair
- Dry ridged nails
FOOD SOURCES: Carrots, sweet potatoes, spinach, eggs
SEVERITY MARKERS: Severe dry rough skin = high likelihood (70-90%)

**ZINC:**
PRIMARY SIGNS:
- Acrodermatitis: Red scaly rash around mouth, nose, eyes
- Pustular dermatitis: Pus-filled acne lesions
- Perioral dermatitis: Rash around mouth
- Acne vulgaris: Inflammatory acne
SECONDARY SIGNS:
- Alopecia (patchy hair loss)
- White spots on nails
- Paronychia (nail fold inflammation)
- Delayed wound healing
FOOD SOURCES: Oysters, beef, pumpkin seeds, chickpeas
SEVERITY MARKERS: Facial acne + perioral rash = high likelihood (75-90%)

**IRON (Anemia):**
PRIMARY SIGNS:
- Severe pallor: Very pale skin, almost white
- Pale conjunctiva: Inside eyelids appear white
- Koilonychia: Spoon-shaped concave nails
- Pale/white nail beds
SECONDARY SIGNS:
- Angular cheilitis (mouth corner cracks)
- Glossitis (smooth tongue)
- Pale lips and gums
- Hair loss, brittle hair
FOOD SOURCES: Red meat, spinach, legumes, fortified cereals
SEVERITY MARKERS: Extreme pallor visible = high likelihood (80-95%)

**VITAMIN B12 (Cobalamin):**
PRIMARY SIGNS:
- Pallor: Pale skin with yellowish tinge
- Glossitis: Smooth, red, swollen "beefy" tongue
- Angular cheilitis: Painful cracks at mouth corners
SECONDARY SIGNS:
- Pale conjunctiva
- Yellowish sclera (eyes)
- Premature graying of hair
- Hyperpigmentation patches
SEVERITY MARKERS: Glossitis + pallor = high likelihood (75-90%)

**BIOTIN (Vitamin B7):**
PRIMARY SIGNS:
- Seborrheic dermatitis: Red scaly rash on face (especially T-zone)
- Periorbital dermatitis: Rash around eyes
- Red scaly patches around nose, mouth
SECONDARY SIGNS:
- Hair loss, thinning hair
- Brittle nails
- Conjunctivitis
SEVERITY MARKERS: Facial seborrheic dermatitis = high likelihood (70-85%)

**VITAMIN B2 (Riboflavin):**
PRIMARY SIGNS:
- Angular cheilitis: Cracks at corners of mouth
- Cheilosis: Swollen, cracked lips
- Glossitis: Magenta/purple tongue
- Seborrheic dermatitis: Especially around nose and mouth
SECONDARY SIGNS:
- Sore throat
- Red, itchy eyes
- Photophobia (light sensitivity)
- Normocytic anemia (pale skin)
SEVERITY MARKERS: Angular cheilitis + magenta tongue = high likelihood (70-85%)

**NIACIN (Vitamin B3) - PELLAGRA:**
PRIMARY SIGNS:
- Photosensitive dermatitis: Rash on sun-exposed areas
- Casal's necklace: Collar-like rash around neck
- Hyperpigmentation: Dark patches on skin
- Scaling, cracking skin
SECONDARY SIGNS:
- Red swollen tongue
- Symmetrical skin lesions
SEVERITY MARKERS: Sun-exposed rash pattern = high likelihood (80-95%)

**FOLATE (Vitamin B9):**
PRIMARY SIGNS:
- Pallor: Pale skin (similar to B12 but no yellow tinge)
- Glossitis: Red painful tongue
- Angular stomatitis: Mouth inflammation
SECONDARY SIGNS:
- Pale nail beds
- Hyperpigmentation
- Premature graying
SEVERITY MARKERS: Pallor + glossitis without neurological signs = 70-85%

**VITAMIN D (Calciferol):**
PRIMARY SIGNS:
- Pale skin
- Visible bone deformities (bowed legs, knock knees)
- Frontal bossing (prominent forehead)
- Muscle weakness visible
SECONDARY SIGNS:
- Delayed tooth eruption
- Rachitic rosary (rib deformities)
- Joint swelling
SEVERITY MARKERS: Skeletal deformities = high likelihood (85-95%)

**VITAMIN K:**
PRIMARY SIGNS:
- Easy bruising: Multiple bruises in various stages
- Purpura: Purple patches under skin
- Ecchymoses: Large bruised areas
- Petechiae
SECONDARY SIGNS:
- Visible hemorrhages
- Bleeding gums
- Subconjunctival hemorrhage
SEVERITY MARKERS: Multiple unexplained bruises = 75-90%

**VITAMIN E (Tocopherol):**
PRIMARY SIGNS:
- Dry aged skin
- Age spots, hyperpigmentation
- Visible muscle weakness
SECONDARY SIGNS:
- Coordination issues visible
- Neuropathy signs
SEVERITY MARKERS: Premature aging signs = 60-75%

═══════════════════════════════════════════════════════════════
SYSTEMATIC ANALYSIS PROTOCOL
═══════════════════════════════════════════════════════════════

STEP 1 - SKIN SURFACE ANALYSIS:
□ Check for SPOTS: Petechiae (tiny red), purpura (purple), ecchymoses (bruises)
□ Check for TEXTURE: Smooth vs rough, bumpy, scaly, dry
□ Check for LESIONS: Acne, pustules, rashes, inflammation
□ Check for COLOR: Pale, yellow, hyperpigmented, normal

STEP 2 - REGIONAL ASSESSMENT:
□ FACE: Acne, rashes, perioral/periorbital dermatitis, seborrheic patterns
□ SKIN EXPOSED AREAS: Sun-damage patterns, photosensitivity
□ EXTREMITIES: Follicular patterns, keratosis, pallor
□ MUCOUS MEMBRANES: Gums, tongue, mouth corners

STEP 3 - PATTERN RECOGNITION:
□ BLEEDING PATTERN: Petechiae + bruising + hemorrhages → Vitamin C or K
□ DRY/ROUGH PATTERN: Follicular hyperkeratosis + xerosis → Vitamin A
□ ACNE PATTERN: Pustules + inflammation + perioral → Zinc or Biotin
□ PALLOR PATTERN: Extreme paleness + conjunctiva → Iron or B12
□ PHOTOSENSITIVE PATTERN: Sun-exposed rash → Niacin

STEP 4 - SEVERITY SCORING:
- MILD (50-65%): 1-2 primary signs OR 3+ secondary signs
- MODERATE (65-80%): 2-3 primary signs OR 1 primary + 3 secondary
- HIGH (80-95%): 3+ primary signs OR classic presentation

STEP 5 - DIFFERENTIAL DIAGNOSIS:
- If SKIN INFLAMMATION + SPOTS → Priority: Vitamin C > Zinc > Vitamin K
- If ACNE + ROUGH SKIN → Priority: Zinc > Vitamin A > Biotin
- If EXTREME PALLOR → Priority: Iron > B12 > Folate
- If DRY SCALY SKIN → Priority: Vitamin A > Biotin > Niacin
- If FACIAL RASH → Priority: Zinc > Biotin > Niacin

═══════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

RESPONSE FORMAT - TWO POSSIBLE OUTCOMES:

IF SKIN IS NORMAL:
{
  "is_normal": true,
  "status": "Normal",
  "image_description": "The skin shows a healthy, clear appearance with good color, texture, and hydration. No significant abnormalities, lesions, rashes, or signs of vitamin deficiency are visible.",
  "analysis_conclusion": "Based on the clinical examination, the skin appears healthy and normal. No vitamin or mineral deficiencies are detected from the visible clinical signs. This person maintains good nutritional status.",
  "deficiencies": [],
  "disease_risks": [],
  "dietary_recommendations": ["Maintain current balanced diet with diverse foods", "Continue with regular water intake", "Include fruits and vegetables regularly", "Ensure adequate protein intake", "Maintain consistent sleep schedule"],
  "lifestyle_recommendations": ["Maintain current skincare routine", "Stay physically active", "Get 7-9 hours of quality sleep", "Manage stress through relaxation", "Avoid smoking and excessive alcohol"],
  "supplements": [],
  "food_sources": {"veg": [], "nonVeg": []}
}

IF SKIN IS NOT NORMAL (has deficiencies):
{
  "is_normal": false,
  "status": "Abnormal",
  "image_description": "Detailed description of what you observe in the image - the skin condition, visible signs, affected areas, colors, texture, patterns, and any notable features",
  "analysis_conclusion": "Comprehensive explanation of how and why you concluded this vitamin deficiency based on the clinical signs observed. Include the key indicators that pointed to this diagnosis.",
  "deficiencies": [
    {
      "vitamin": "Vitamin C",
      "likelihood": 85,
      "severity": "High",
      "symptoms": "Visible petechiae and skin inflammation",
      "visible_signs": [
        "Small red/purple spots (petechiae)",
        "Areas of skin inflammation",
        "Possible bruising or ecchymoses"
      ],
      "clinical_description": "Multiple petechiae observed on skin, indicating severe Vitamin C deficiency leading to poor collagen synthesis and bleeding tendency",
      "complications_if_untreated": [
        "Worsening of skin lesions",
        "Potential bleeding gums",
        "Poor wound healing",
        "Development of scurvy in advanced cases"
      ],
      "urgency": "Moderate - Should address within 2-4 weeks",
      "recovery_timeline": "4-6 weeks with consistent supplementation"
    },
    {
      "vitamin": "Vitamin E",
      "likelihood": 70,
      "severity": "Moderate",
      "symptoms": "Dry, flaky skin with poor texture",
      "visible_signs": [
        "Rough, dry patches on skin",
        "Loss of skin elasticity",
        "Fine lines and early aging signs"
      ],
      "clinical_description": "Skin shows signs of oxidative stress damage with dryness and reduced elasticity, consistent with Vitamin E deficiency affecting skin barrier function",
      "complications_if_untreated": [
        "Accelerated skin aging",
        "Increased susceptibility to UV damage",
        "Impaired wound healing",
        "Potential neurological symptoms over time"
      ],
      "urgency": "Low to Moderate - Address within 4-6 weeks",
      "recovery_timeline": "8-12 weeks with consistent supplementation and dietary changes"
    }
  ],
  "disease_risks": [
    {
      "disease": "Scurvy",
      "deficiency": "Vitamin C",
      "risk_level": "High Risk",
      "correlation": 95,
      "description": "A serious deficiency disease caused by lack of vitamin C, characterized by bleeding, bruising, and poor wound healing"
    }
  ],
  "dietary_recommendations": [
    "Consume citrus fruits (oranges, lemons) daily",
    "Include bell peppers in your meals",
    "Eat fresh berries (strawberries, blueberries)",
    "Add broccoli and leafy greens to your diet",
    "Drink fresh fruit juices without added sugar"
  ],
  "lifestyle_recommendations": [
    "Avoid smoking as it depletes Vitamin C",
    "Limit alcohol consumption",
    "Store fruits properly to retain vitamin content",
    "Eat fruits raw when possible",
    "Minimize cooking time for vegetables"
  ],
  "supplements": [
    {
      "name": "Vitamin C (Ascorbic Acid)",
      "dosage": "500-1000 mg daily",
      "description": "Take with meals to reduce stomach upset",
      "brands": ["Nature Made", "Emergen-C", "Garden of Life"],
      "timeline": "4-6 weeks"
    }
  ],
  "food_sources": {
    "veg": [
      {"icon": "🍊", "name": "Citrus Fruits"},
      {"icon": "🫑", "name": "Bell Peppers"},
      {"icon": "🥦", "name": "Broccoli"},
      {"icon": "🍓", "name": "Strawberries"}
    ],
    "nonVeg": [
      {"icon": "🐟", "name": "Fish"}
    ]
  }
}

MANDATORY INSTRUCTIONS:
1. ⭐ STEP 1 IS CRITICAL - ALWAYS determine if skin is NORMAL or NOT first
2. IF skin is NORMAL and HEALTHY: IMMEDIATELY set "is_normal": true, "status": "Normal" 
3. For NORMAL skin: Return empty arrays: "deficiencies": [], "disease_risks": [], "supplements": []
4. ⭐ ONLY IF skin has CLEAR ABNORMALITIES: set "is_normal": false and proceed with vitamin analysis
5. ALWAYS provide "image_description" with detailed observations of skin condition
6. ALWAYS provide "analysis_conclusion" explaining your analysis reasoning
7. ALWAYS return "is_normal" field - true or false (REQUIRED)
8. ALWAYS return "status" field - "Normal" or "Abnormal" (REQUIRED)
9. For NORMAL results: dietary/lifestyle recommendations should focus on maintaining current health
10. For ABNORMAL results: Include 5-8 dietary and lifestyle recommendations
11. For ABNORMAL results: Include top 3 deficiency supplements with full details
12. ALWAYS include "food_sources" object with "veg" and "nonVeg" arrays
13. CRITICAL: Most skin problems are NOT vitamin deficiencies - only mark as abnormal if clear clinical signs exist
14. Return ONLY valid JSON, no markdown, no code blocks, no explanation text


VITAMIN-SPECIFIC DATA FOR SUPPLEMENTS:

Vitamin C (Adult 100% dose): 500-1000 mg daily, brands: Nature Made, Emergen-C, Garden of Life, timeline: 4-6 weeks
Vitamin D (Adult 100% dose): 2000 IU daily, brands: Nature Made, NOW Foods, Garden of Life, timeline: 8-12 weeks
Vitamin A (Adult 100% dose): 3000-5000 IU daily, brands: Solgar, Nature's Bounty, NOW Foods, timeline: 6-10 weeks
Vitamin B12 (Adult 100% dose): 1000 mcg daily, brands: Nature Made, Jarrow Formulas, Solgar, timeline: 6-8 weeks
Iron (Adult 100% dose): 18-65 mg elemental iron daily, brands: Fergon, Slow Fe, Nature Made, timeline: 12-16 weeks
Zinc (Adult 100% dose): 15-30 mg daily, brands: Thorne, NOW Foods, Jarrow Formulas, timeline: 4-8 weeks
Vitamin B3 (Niacin) (Adult 100% dose): 16-32 mg daily (Nicotinamide), brands: Nature's Way, Solgar, timeline: 4-6 weeks

AGE-BASED SUPPLEMENT DOSAGE MULTIPLIERS:
- Infant (0-12 months): 0.10 (10% of adult dose)
- Toddler (1-3 years): 0.15 (15% of adult dose)
- Preschooler (3-6 years): 0.25 (25% of adult dose)
- Child (6-12 years): 0.40 (40% of adult dose)
- Adolescent (12-18 years): 0.70 (70% of adult dose)
- Young Adult (18-30 years): 1.00 (100% of adult dose)
- Adult (31-50 years): 1.00 (100% of adult dose)
- Mature Adult (51-65 years): 0.85 (85% of adult dose)
- Senior (65+ years): 0.70 (70% of adult dose)

Always adjust the recommended daily dosage based on these multipliers in the "supplements" array for different age groups if applicable. 
When providing "supplements" in the JSON response, specifically include the age-adjusted dosage in the "dosage" field.
Check for any symptoms of petechiae, purpura, ecchymoses, or texture abnormalities during analysis.
If the skin is healthy, return "Normal" status. If abnormalities are found, perform systematic deficiency analysis.
Confidence scoring algorithm: C = Cbase + Σ(wi * si).
1 primary sign = Mild (50-60% confidence), 2 primary signs = Moderate (65-75% confidence), 3+ primary signs = High (80-90% confidence), Classic presentation = Very High (90-95% confidence).
Apply these confidence levels in the "likelihood" field.
Priority Rule: AI Clinical Assessment Priority. If AI determines skin is "normal", this overrides ML predictions.
Priority Rule: Highest Confidence Selection. For abnormal cases, the deficiency with the highest confidence score is selected.
Vitamin B2: 25-100 mg daily, brands: Nature Made, NOW Foods, Solgar, timeline: 4-6 weeks
Iron: 65 mg daily, brands: Feosol, Nature Made, Slow Fe, timeline: 8-12 weeks
Zinc: 15-30 mg daily, brands: NOW Foods, Nature's Bounty, Thorne, timeline: 4-8 weeks
Biotin: 30-100 mcg daily, brands: Nature's Bounty, Sports Research, Natrol, timeline: 3-6 months
Niacin: 14-16 mg daily, brands: Nature Made, Solaray, NOW Foods, timeline: 4-6 weeks
Folate: 400-800 mcg daily, brands: Nature Made, Solgar, Garden of Life, timeline: 4-8 weeks
Vitamin E: 15 mg daily, brands: Solgar, Nature Made, NOW Foods, timeline: 8-12 weeks
Vitamin K: 90-120 mcg daily, brands: Thorne, Life Extension, NOW Foods, timeline: 2-4 weeks

CRITICAL RULES:
✓ Include ALL deficiencies detected with likelihood > 0%
✓ DO NOT include deficiencies with 0% likelihood
✓ DO NOT limit to just 1 deficiency - list ALL visible deficiencies
✓ ⭐ EVERY deficiency MUST have ALL fields: vitamin, likelihood, severity, symptoms, visible_signs, clinical_description, complications_if_untreated, urgency, recovery_timeline
✓ Order by likelihood (highest first)
✓ Maximum 10 deficiencies
✓ Use EXACT names: "Vitamin C", "Vitamin A", "Vitamin D", "Vitamin B12", "Vitamin B2", "Iron", "Folate", "Zinc", "Biotin", "Niacin", "Vitamin E", "Vitamin K"
✓ Provide 5-8 dietary recommendations based on ALL detected deficiencies
✓ Provide 5-8 lifestyle recommendations
✓ Include supplements for top 3 deficiencies with accurate dosages and brands from the list above
✓ List relevant food sources with appropriate emojis (use actual emoji characters)
✓ Generate disease risks for each deficiency with correlation percentages
✓ Base likelihood on PRIMARY SIGNS first, then SECONDARY SIGNS
✓ Higher scores require MULTIPLE confirming signs
✓ Be SPECIFIC - avoid generic assessments
✓ Consider MULTIPLE DEFICIENCIES can coexist - analyze for ALL possible deficiencies
✓ NEVER return an empty array for dietary_recommendations, lifestyle_recommendations, supplements, or food_sources

CONFIDENCE CALCULATION:
- 1 primary sign alone = 50-60%
- 2 primary signs = 65-75%
- 3+ primary signs = 80-90%
- Classic textbook presentation = 90-95%
- Add +5-10% for each strong secondary sign
- Reduce -10-20% for conflicting or absent expected signs
"""
        
        try:
            client = self.refresh_client()
            image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            
            response = client.models.generate_content(
                model=self.model,
                contents=[image_part, analysis_prompt],
                config=types.GenerateContentConfig(temperature=0.6)
            )
            
            text_output = (response.text or "").strip()
            
            # Extract JSON from markdown code blocks
            if "```json" in text_output:
                text_output = text_output.split("```json")[1].split("```")[0].strip()
            elif "```" in text_output:
                text_output = text_output.split("```")[1].split("```")[0].strip()
            
            # Try to parse JSON, with fallback for malformed JSON
            result = None
            try:
                result = json.loads(text_output)
            except json.JSONDecodeError as parse_error:
                print(f"⚠️ JSON parse error, attempting to fix: {parse_error}")
                # Try to fix common JSON issues
                fixed_text = self._fix_malformed_json(text_output)
                try:
                    result = json.loads(fixed_text)
                    print("✅ Fixed malformed JSON successfully")
                except json.JSONDecodeError:
                    print("❌ Could not fix JSON, using fallback")
                    result = None
            
            if result is None:
                # Return a fallback result if JSON parsing completely fails
                return {
                    "is_normal": False,
                    "status": "Analysis Error",
                    "deficiencies": [],
                    "explanation": "AI response was malformed. Please try again.",
                    "dietary_recommendations": [],
                    "lifestyle_recommendations": [],
                    "supplements": [],
                    "food_sources": {"veg": [], "nonVeg": []},
                    "disease_risks": []
                }
            
            # Filter out deficiencies with 0% likelihood
            if "deficiencies" in result:
                result["deficiencies"] = [
                    d for d in result["deficiencies"] 
                    if d.get("likelihood", 0) > 0
                ]
            
            # Enrich result with missing fields if Gemini didn't provide them
            result = self._enrich_analysis_result(result)
            
            # Store in cache
            self.cache[image_hash] = result
            
            return result
            
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Analysis failed: {error_msg}")
            
            # Provide specific error messages
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                # Extract retry time if available
                if "retry in" in error_msg.lower():
                    import re
                    retry_match = re.search(r'retry in (\d+)', error_msg)
                    if retry_match:
                        retry_seconds = int(retry_match.group(1))
                        retry_minutes = retry_seconds // 60
                        if retry_minutes > 0:
                            explanation = f"API quota exceeded. Please try again in {retry_minutes} minutes."
                        else:
                            explanation = f"API quota exceeded. Please try again in {retry_seconds} seconds."
                    else:
                        explanation = "API quota exceeded. Please try again in a few minutes."
                else:
                    explanation = "API quota exceeded. The free tier allows 50 requests per day. Please try again later or upgrade your plan."
            elif "503" in error_msg or "UNAVAILABLE" in error_msg:
                explanation = "Service temporarily unavailable. Please try again in a few moments."
            elif "quota" in error_msg.lower():
                explanation = "API quota limit reached. Please try again later."
            elif "API_KEY" in error_msg.upper() or "INVALID" in error_msg.upper():
                explanation = "Invalid API key configuration."
            elif "404" in error_msg or "NOT_FOUND" in error_msg:
                explanation = "Service not found. Please try again."
            else:
                explanation = f"Unable to analyze image. Please try again."
            
            return {"deficiencies": [], "explanation": explanation}
    
    def _enrich_analysis_result(self, result: dict) -> dict:
        """Verify and ensure analysis result has all required fields"""
        
        # Default clinical info for common deficiencies
        deficiency_defaults = {
            "Vitamin C": {
                "symptoms": "Fatigue, easy bruising, slow wound healing, dry skin",
                "visible_signs": ["Petechiae (small red spots)", "Bruising", "Dry or rough skin", "Bleeding gums"],
                "clinical_description": "Vitamin C deficiency affects collagen synthesis, leading to weakened blood vessels and connective tissue issues",
                "complications_if_untreated": ["Scurvy", "Severe bleeding", "Poor wound healing", "Increased infection risk"],
                "urgency": "Moderate - Address within 2-4 weeks",
                "recovery_timeline": "4-6 weeks with proper supplementation"
            },
            "Vitamin D": {
                "symptoms": "Bone pain, muscle weakness, fatigue, mood changes",
                "visible_signs": ["Pale skin", "Possible bone deformities", "Muscle weakness visible"],
                "clinical_description": "Vitamin D deficiency impairs calcium absorption, affecting bone health and immune function",
                "complications_if_untreated": ["Osteoporosis", "Rickets (in children)", "Increased fracture risk", "Weakened immunity"],
                "urgency": "Moderate - Address within 4-6 weeks",
                "recovery_timeline": "8-12 weeks with consistent supplementation"
            },
            "Vitamin E": {
                "symptoms": "Dry skin, muscle weakness, vision problems, poor immunity",
                "visible_signs": ["Dry, flaky skin", "Loss of skin elasticity", "Premature aging signs"],
                "clinical_description": "Vitamin E deficiency causes oxidative stress damage, affecting skin barrier function and cellular health",
                "complications_if_untreated": ["Accelerated skin aging", "Nerve damage", "Impaired immune response", "Vision deterioration"],
                "urgency": "Low to Moderate - Address within 4-6 weeks",
                "recovery_timeline": "8-12 weeks with dietary changes and supplementation"
            },
            "Vitamin A": {
                "symptoms": "Night blindness, dry eyes, dry skin, frequent infections",
                "visible_signs": ["Dry, rough skin (xerosis)", "Bitot's spots on eyes", "Follicular hyperkeratosis"],
                "clinical_description": "Vitamin A deficiency affects epithelial tissues and vision, causing skin dryness and eye problems",
                "complications_if_untreated": ["Permanent vision loss", "Severe dry eye", "Increased infection susceptibility", "Skin disorders"],
                "urgency": "Moderate to High - Address within 2-4 weeks",
                "recovery_timeline": "6-8 weeks with proper treatment"
            },
            "Vitamin B12": {
                "symptoms": "Fatigue, weakness, numbness, cognitive issues, pale skin",
                "visible_signs": ["Pallor with yellowish tinge", "Glossitis (smooth, red tongue)", "Angular cheilitis"],
                "clinical_description": "Vitamin B12 deficiency affects red blood cell formation and neurological function",
                "complications_if_untreated": ["Anemia", "Nerve damage", "Cognitive decline", "Balance problems"],
                "urgency": "Moderate to High - Address within 2-4 weeks",
                "recovery_timeline": "6-8 weeks with B12 supplementation"
            },
            "Vitamin B2": {
                "symptoms": "Cracked lips, sore throat, mouth sores, red eyes",
                "visible_signs": ["Angular cheilitis", "Cheilosis (swollen lips)", "Magenta tongue", "Seborrheic dermatitis"],
                "clinical_description": "Vitamin B2 (Riboflavin) deficiency causes inflammation of lips, mouth, and skin",
                "complications_if_untreated": ["Severe mouth sores", "Anemia", "Eye problems", "Skin inflammation"],
                "urgency": "Moderate - Address within 2-4 weeks",
                "recovery_timeline": "4-6 weeks with supplementation"
            },
            "Iron": {
                "symptoms": "Fatigue, weakness, shortness of breath, cold extremities",
                "visible_signs": ["Pale skin and conjunctiva", "Brittle nails", "Pale lips and gums", "Koilonychia (spoon nails)"],
                "clinical_description": "Iron deficiency leads to decreased hemoglobin production, causing anemia and oxygen transport issues",
                "complications_if_untreated": ["Severe anemia", "Heart problems", "Developmental delays", "Weakened immunity"],
                "urgency": "Moderate to High - Address within 2-4 weeks",
                "recovery_timeline": "8-12 weeks with iron supplementation"
            },
            "Zinc": {
                "symptoms": "Hair loss, slow wound healing, loss of taste, frequent infections",
                "visible_signs": ["Hair thinning or loss", "Skin lesions", "White spots on nails", "Delayed wound healing"],
                "clinical_description": "Zinc deficiency impairs immune function, wound healing, and protein synthesis",
                "complications_if_untreated": ["Chronic infections", "Severe skin problems", "Growth retardation", "Immune dysfunction"],
                "urgency": "Moderate - Address within 3-4 weeks",
                "recovery_timeline": "4-8 weeks with zinc supplementation"
            },
            "Biotin": {
                "symptoms": "Hair loss, brittle nails, skin rash, fatigue",
                "visible_signs": ["Seborrheic dermatitis", "Hair thinning", "Red scaly rash (especially on face)", "Brittle nails"],
                "clinical_description": "Biotin deficiency affects fatty acid synthesis, impacting skin, hair, and nail health",
                "complications_if_untreated": ["Severe hair loss", "Extensive skin rash", "Neurological symptoms", "Depression"],
                "urgency": "Low to Moderate - Address within 4-6 weeks",
                "recovery_timeline": "3-6 months for visible improvement"
            },
            "Folate": {
                "symptoms": "Fatigue, weakness, mouth sores, gray hair",
                "visible_signs": ["Pallor", "Glossitis (red, painful tongue)", "Angular stomatitis", "Premature graying"],
                "clinical_description": "Folate deficiency affects DNA synthesis and cell division, causing anemia and oral symptoms",
                "complications_if_untreated": ["Megaloblastic anemia", "Birth defects (in pregnancy)", "Neurological issues", "Cardiovascular risk"],
                "urgency": "Moderate to High - Address within 2-4 weeks",
                "recovery_timeline": "4-8 weeks with folic acid supplementation"
            },
            "Niacin": {
                "symptoms": "Skin rash on sun-exposed areas, diarrhea, mental confusion",
                "visible_signs": ["Photosensitive dermatitis", "Casal's necklace (neck rash)", "Hyperpigmentation", "Scaling skin"],
                "clinical_description": "Niacin deficiency (Pellagra) causes the classic 3 Ds: Dermatitis, Diarrhea, Dementia",
                "complications_if_untreated": ["Severe pellagra", "Death (4th D)", "Permanent neurological damage", "Severe skin damage"],
                "urgency": "High - Address immediately",
                "recovery_timeline": "2-4 weeks with niacin supplementation"
            },
            "Vitamin K": {
                "symptoms": "Easy bruising, excessive bleeding, blood in stool/urine",
                "visible_signs": ["Multiple bruises", "Purpura (purple patches)", "Petechiae", "Prolonged bleeding from cuts"],
                "clinical_description": "Vitamin K deficiency impairs blood clotting factor synthesis, leading to bleeding disorders",
                "complications_if_untreated": ["Hemorrhage", "Internal bleeding", "Severe anemia", "Life-threatening bleeding"],
                "urgency": "High - Address within 1-2 weeks",
                "recovery_timeline": "2-4 weeks with vitamin K supplementation"
            }
        }
        
        # Enrich deficiencies with missing fields
        if result.get("deficiencies"):
            for deficiency in result["deficiencies"]:
                vitamin = deficiency.get("vitamin", "")
                defaults = deficiency_defaults.get(vitamin, {})
                
                # Fill in missing fields with defaults
                if not deficiency.get("symptoms") and defaults.get("symptoms"):
                    deficiency["symptoms"] = defaults["symptoms"]
                
                if not deficiency.get("visible_signs") and defaults.get("visible_signs"):
                    deficiency["visible_signs"] = defaults["visible_signs"]
                
                if not deficiency.get("clinical_description") and defaults.get("clinical_description"):
                    deficiency["clinical_description"] = defaults["clinical_description"]
                
                if not deficiency.get("complications_if_untreated") and defaults.get("complications_if_untreated"):
                    deficiency["complications_if_untreated"] = defaults["complications_if_untreated"]
                
                if not deficiency.get("urgency") and defaults.get("urgency"):
                    deficiency["urgency"] = defaults["urgency"]
                
                if not deficiency.get("recovery_timeline") and defaults.get("recovery_timeline"):
                    deficiency["recovery_timeline"] = defaults["recovery_timeline"]
                
                # If vitamin not in defaults, provide generic fallback
                if not defaults:
                    if not deficiency.get("symptoms"):
                        deficiency["symptoms"] = "Consult healthcare provider for symptom assessment"
                    if not deficiency.get("visible_signs"):
                        deficiency["visible_signs"] = ["Clinical signs detected in image analysis"]
                    if not deficiency.get("clinical_description"):
                        deficiency["clinical_description"] = f"{vitamin} deficiency detected based on visible clinical signs. Professional medical evaluation recommended."
                    if not deficiency.get("complications_if_untreated"):
                        deficiency["complications_if_untreated"] = ["Worsening of symptoms", "Potential health complications"]
                    if not deficiency.get("urgency"):
                        deficiency["urgency"] = "Moderate - Consult healthcare provider"
                    if not deficiency.get("recovery_timeline"):
                        deficiency["recovery_timeline"] = "4-8 weeks with proper treatment"
        
        # Check if Gemini already set is_normal
        is_normal = result.get("is_normal", False)
        
        # Ensure all required fields exist with proper structure
        if not result.get("image_description"):
            result["image_description"] = "Unable to generate image description"
        
        if not result.get("analysis_conclusion"):
            result["analysis_conclusion"] = "Unable to generate analysis conclusion"
        
        if not result.get("status"):
            result["status"] = "Normal" if is_normal else "Abnormal"
        
        if not result.get("is_normal"):
            # If no deficiencies and not explicitly marked, it's normal
            if not result.get("deficiencies"):
                result["is_normal"] = True
                result["status"] = "Normal"
            else:
                result["is_normal"] = False
                result["status"] = "Abnormal"
        
        if not result.get("dietary_recommendations"):
            result["dietary_recommendations"] = []
        
        if not result.get("lifestyle_recommendations"):
            result["lifestyle_recommendations"] = []
        
        if not result.get("supplements"):
            result["supplements"] = []
        
        if not result.get("food_sources"):
            result["food_sources"] = {"veg": [], "nonVeg": []}
        
        if not result.get("disease_risks"):
            result["disease_risks"] = []
        
        return result
    
    def _fix_malformed_json(self, text: str) -> str:
        """Attempt to fix common JSON formatting issues from AI responses"""
        import re
        
        # Remove any trailing commas before closing brackets/braces
        text = re.sub(r',(\s*[\]\}])', r'\1', text)
        
        # Fix missing commas between array elements or object properties
        text = re.sub(r'"\s*\n\s*"', '",\n"', text)
        text = re.sub(r'\}\s*\n\s*\{', '},\n{', text)
        text = re.sub(r'\]\s*\n\s*"', '],\n"', text)
        text = re.sub(r'"\s*\n\s*\[', '",\n[', text)
        text = re.sub(r'\}\s*\n\s*"', '},\n"', text)
        
        # Fix unescaped quotes in strings (common issue)
        # This is tricky - try to balance brackets first
        
        # Remove any control characters
        text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
        
        # Try to ensure proper closing
        open_braces = text.count('{')
        close_braces = text.count('}')
        open_brackets = text.count('[')
        close_brackets = text.count(']')
        
        # Add missing closing brackets/braces
        text = text + (']' * (open_brackets - close_brackets))
        text = text + ('}' * (open_braces - close_braces))
        
        return text