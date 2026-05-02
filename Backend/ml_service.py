import os
import json
import csv
import numpy as np
from tensorflow import keras # type: ignore
from PIL import Image
import io

class MLService:
    """Service class for ML model predictions"""
    
    def __init__(self):
        self.model = None
        self.class_labels = []
        self.disease_to_vitamin = {}
        self.load_model()
    
    def load_model(self):
        """Load the ML model and metadata"""
        try:
            model_path = os.path.join(os.path.dirname(__file__), "Model", "vitamin_deficiency_model.h5")
            class_path = os.path.join(os.path.dirname(__file__), "Model", "class.json")
            
            # Load model
            self.model = keras.models.load_model(model_path)
            print("✅ ML Model loaded successfully")
            
            # Load class labels
            with open(class_path, "r") as f:
                data = json.load(f)
                # The JSON is a dict with disease names as keys and indices as values
                # Create a list ordered by indices
                max_idx = max(data.values()) if data else 0
                self.class_labels = [''] * (max_idx + 1)
                for disease_name, idx in data.items():
                    self.class_labels[idx] = disease_name
            
            # Load disease to vitamin mapping from CSV
            mapping_path = os.path.join(os.path.dirname(__file__), "Model", "mapping_data.csv")
            self.disease_to_vitamin = {}
            
            try:
                with open(mapping_path, "r") as f:
                    csv_reader = csv.DictReader(f)
                    for row in csv_reader:
                        disease = row.get("Diseases", "").strip()
                        deficiency = row.get("Deficiency", "").strip()
                        if disease and deficiency:
                            self.disease_to_vitamin[disease] = deficiency
                print(f"✅ Loaded {len(self.disease_to_vitamin)} disease-to-vitamin mappings from CSV")
            except Exception as e:
                print(f"⚠️ Could not load mapping CSV: {str(e)}, using default mappings")
                # Fallback to basic mappings if CSV fails
                self.disease_to_vitamin = {
                    "Beriberi": "Vitamin B1 Deficiency",
                    "Pellagra": "Vitamin B3 Deficiency",
                    "Scurvy": "Vitamin C Deficiency",
                    "folate defficient": "Vitamin B9 Deficiency",
                }
            
            print(f"✅ Loaded {len(self.class_labels)} disease classes")
            
        except Exception as e:
            print(f"❌ Failed to load ML model: {str(e)}")
            self.model = None
    
    def preprocess_image(self, image_bytes: bytes) -> np.ndarray:
        """Preprocess image for ML model prediction"""
        try:
            # Open image
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            
            # Resize to model input size (assuming 224x224)
            image = image.resize((224, 224))
            
            # Convert to array and normalize
            img_array = np.array(image) / 255.0
            
            # Add batch dimension
            img_array = np.expand_dims(img_array, axis=0)
            
            return img_array
            
        except Exception as e:
            print(f"Image preprocessing error: {str(e)}")
            raise
    
    def predict(self, image_bytes: bytes) -> dict:
        """
        Predict vitamin deficiency using ML model
        Returns: {"deficiencies": [...], "explanation": str}
        """
        if self.model is None:
            return {
                "deficiencies": [],
                "explanation": "ML model not available"
            }
        
        try:
            # Preprocess image
            img_array = self.preprocess_image(image_bytes)
            
            # Make prediction
            predictions = self.model.predict(img_array, verbose=0)
            
            # Get top predictions (top 5 to increase chances of multiple results)
            top_indices = np.argsort(predictions[0])[::-1][:20]  # Top 20 predictions
            
            deficiencies = []
            unmapped_diseases = []
            
            for idx in top_indices:
                if idx < len(self.class_labels):
                    disease_name = self.class_labels[idx]
                    confidence = float(predictions[0][idx] * 100)
                    
                    # Include only predictions with confidence > 0%
                    if confidence > 0:
                        # Map disease to vitamin
                        vitamin_name = self.disease_to_vitamin.get(disease_name)
                        
                        if vitamin_name:
                            # Only include if we have a vitamin mapping
                            # Avoid duplicates
                            if not any(d["vitamin"] == vitamin_name for d in deficiencies):
                                deficiencies.append({
                                    "vitamin": vitamin_name,
                                    "disease": disease_name,
                                    "likelihood": round(confidence, 1)
                                })
                        else:
                            # Track unmapped diseases for debugging
                            if confidence > 0:  # Only show unmapped with >0%
                                unmapped_diseases.append(f"{disease_name} ({confidence:.1f}%)")
            
            # Print unmapped diseases for debugging
            if unmapped_diseases:
                print(f"⚠️ Unmapped diseases: {', '.join(unmapped_diseases[:3])}")
            
            if not deficiencies:
                return {
                    "deficiencies": [],
                    "is_normal": True,
                    "status": "Normal",
                    "explanation": "No significant deficiencies detected by ML model"
                }
            
            return {
                "deficiencies": deficiencies,
                "explanation": "Predicted using ML model (fallback)"
            }
            
        except Exception as e:
            print(f"❌ ML prediction failed: {str(e)}")
            return {
                "deficiencies": [],
                "explanation": f"ML prediction error: {str(e)}"
            }
