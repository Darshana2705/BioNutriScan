import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import * as faceapi from 'face-api.js';
import { db, storage } from "./firebase";
import { ref as dbRef, push, set, onValue } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import AdminPanel from "./AdminPanel";
// ReactMarkdown removed (recommendations UI removed)
import Swal from "sweetalert2";  // <-- import sweetalert2
import "./App.css";
import { doctorDatabase, doctorTypeIcons } from "./doctorDatabase";

export default function App() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [selectedDoctorType, setSelectedDoctorType] = useState<"dermatologist" | "nutritionist" | "physician" | null>(null);

  const [disease, setDisease] = useState<string | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [modelAccuracy, setModelAccuracy] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [geminiAnalysis, setGeminiAnalysis] = useState<{
    image_description?: string;
    analysis_conclusion?: string;
    deficiencies?: Array<{ 
      vitamin: string; 
      likelihood: number; 
      symptoms?: string;
      severity?: string;
      visible_signs?: string[];
      clinical_description?: string;
      complications_if_untreated?: string[];
      urgency?: string;
      recovery_timeline?: string;
    }>;
    disease_risks?: Array<{ 
      disease: string; 
      deficiency: string; 
      risk_level: string; 
      correlation: number;
      description?: string;
    }>;
    dietary_recommendations?: string[];
    lifestyle_recommendations?: string[];
    supplements?: Array<{
      name: string;
      dosage: string;
      description: string;
      brands: string[];
      timeline: string;
    }>;
    food_sources?: {
      veg: Array<{ icon: string; name: string }>;
      nonVeg: Array<{ icon: string; name: string }>;
    };
  } | null>(null);
  // recommendation and medicine removed from UI

  const [loading, setLoading] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [reportHistory, setReportHistory] = useState<Array<{
    id: string;
    name: string;
    age: string;
    date: string;
    time: string;
    disease: string;
    confidence: number;
    healthScore: number;
    imagePreview?: string;
    geminiAnalysis?: unknown;
  }>>([]);
  const [backendURL, setBackendURL] = useState(() => {
    // Initial default, will fetch more actual one below
    return localStorage.getItem("backendURL") || "http://localhost:5000";
  });
  const [showBackendInput, setShowBackendInput] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [formError, setFormError] = useState("");
  const [processingSpeed, setProcessingSpeed] = useState(0);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [showAdmin, setShowAdmin] = useState(false);

  const handleGoHome = () => {
    sessionStorage.removeItem('appStarted');
    window.location.reload();
  };

  // Fetch backend URL from dynamic config
  useEffect(() => {
    const fetchBackendURL = async () => {
      try {
        const response = await fetch("/backend_url.txt");
        if (response.ok) {
          const fetchedURL = (await response.text()).trim();
          if (fetchedURL) {
            console.log("📡 Found backend at:", fetchedURL);
            setBackendURL(fetchedURL);
            localStorage.setItem("backendURL", fetchedURL);
          }
        }
      } catch (err) {
        console.warn("ℹ️ Could not fetch backend discovery file, using defaults:", err);
      }
    };
    fetchBackendURL();
  }, []);

  // Sync settings with Firebase Admin Panel
  useEffect(() => {
    const settingsRef = dbRef(db, "app_settings");
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const settings = snapshot.val();
      if (settings?.backendURL) {
        setBackendURL(settings.backendURL);
        localStorage.setItem('backendURL', settings.backendURL);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen for verification updates to sync feedbacks
  useEffect(() => {
    // Listen for changes in the feedbacks node
    const feedbackRef = dbRef(db, "feedbacks");
    const unsub = onValue(feedbackRef, () => {
      // Re-fetch or trigger update if needed
    });
    return () => unsub();
  }, []);

  // New camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState<"face" | "skin">("face");
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [stabilizing, setStabilizing] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load face-api models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
        ]);
        setIsModelsLoaded(true);
      } catch (err) {
        console.error("Error loading face models:", err);
      }
    };
    loadModels();
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setFaceDetected(false);
    setStabilizing(0);
    setCountdown(null);
  }, []);

  // Start camera and setup face detection if face mode
  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      const constraints = {
        video: { 
          facingMode: cameraType === 'face' ? 'user' : 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        if (cameraType === 'face' && isModelsLoaded) {
          // If we are already running an interval, clear it
          if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
          
          detectionIntervalRef.current = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const detection = await faceapi.detectSingleFace(
                  videoRef.current,
                  new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
                );
                
                const isDetected = !!detection;
                setFaceDetected(isDetected);
                
                if (isDetected) {
                  setStabilizing(prev => Math.min(prev + 1, 3));
                } else {
                  setStabilizing(0);
                }
              } catch (detectErr) {
                console.warn("Face detection error:", detectErr);
              }
            }
          }, 300); // Check every 300ms
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      Swal.fire("Camera Error", "Unable to access camera. Please check permissions.", "error");
      setShowCamera(false);
    }
  }, [cameraType, stopCamera, isModelsLoaded]);

  // Close camera and cleanup
  const handleCloseCamera = useCallback(() => {
    stopCamera();
    setShowCamera(false);
  }, [stopCamera]);

  // Start camera when modal opens or cameraType/models status changes
  useEffect(() => {
    if (showCamera) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [showCamera, startCamera, stopCamera, cameraType, isModelsLoaded]);

  // Handle capture
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    // Additional validation for face mode: must have detection
    if (cameraType === 'face' && !faceDetected) {
      Swal.fire({
        title: "No Face Detected",
        text: "Please align your face properly in the camera frame.",
        icon: "warning",
        timer: 1500,
        showConfirmButton: false
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      // For front camera, we might want to mirror back if it was mirrored in UI
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const capturedFile = new File([blob], "capture.jpg", { type: "image/jpeg" });
          setFile(capturedFile);
          setPreview(URL.createObjectURL(blob));
          setShowCamera(false);
          stopCamera();
        }
      }, "image/jpeg", 0.9);
    }
  }, [faceDetected, cameraType, stopCamera]);

  // Intelligent Auto-Capture based on detection stability
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    
    // Auto capture after stable detection
    if (showCamera && cameraType === "face" && faceDetected && stabilizing >= 3) {
      if (countdown === null) {
        setCountdown(5);
      } else if (countdown > 0) {
        timer = setTimeout(() => {
          setCountdown(prev => (prev !== null ? prev - 1 : null));
        }, 1000);
      } else if (countdown === 0) {
        capturePhoto();
        setCountdown(null);
      }
    } else {
      setCountdown(null);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showCamera, cameraType, faceDetected, stabilizing, capturePhoto, countdown]);

  // Helper function to get age-based dosage adjustments and instructions
  const getAgeBasedInfo = (userAge: string, supplementName: string, baseDosage: string) => {
    const ageNum = parseFloat(userAge) || 30;
    let ageGroup: string;
    let dosageMultiplier: number;
    let specialInstructions: string;
    let timingAdvice: string;
    let foodAdvice: string;
    let precautions: string;
    let administrationMethod: string = "";

    // Determine age group and adjustments
    if (ageNum < 1) {
      // Infant (0-12 months)
      ageGroup = "Infant (0-12 months)";
      dosageMultiplier = 0.1;
      specialInstructions = "🍼 LIQUID/DROPS FORM ONLY - Must be prescribed by pediatrician";
      administrationMethod = "👶 How to give: Use liquid drops. Place drops directly on tongue, nipple, or mix with small amount of breast milk/formula. Use dropper provided.";
      precautions = "🚨 CRITICAL: Only use infant-specific formulations. Never crush adult tablets. Consult pediatrician before ANY supplementation.";
    } else if (ageNum >= 1 && ageNum < 3) {
      // Toddler (1-3 years)
      ageGroup = "Toddler (1-3 years)";
      dosageMultiplier = 0.15;
      specialInstructions = "🍬 Use liquid, chewable gummies, or dissolvable forms only";
      administrationMethod = "👶 How to give: Liquid drops in juice/milk, OR chewable gummies (supervise to prevent choking), OR crush and mix with soft food (applesauce, yogurt).";
      precautions = "🚨 Choking hazard with tablets. Always supervise. Use child-specific products only. Consult pediatrician.";
    } else if (ageNum >= 3 && ageNum < 6) {
      // Preschooler (3-6 years)
      ageGroup = "Preschooler (3-6 years)";
      dosageMultiplier = 0.25;
      specialInstructions = "🍭 Use chewable gummies, liquid, or dissolvable tablets";
      administrationMethod = "🧒 How to give: Chewable vitamins/gummies work best. Can also use liquid mixed with favorite drink. Avoid hard tablets.";
      precautions = "⚠️ Supervise to ensure proper chewing. Keep supplements out of reach - may look like candy. Pediatrician guidance recommended.";
    } else if (ageNum >= 6 && ageNum < 12) {
      // School-age child (6-12 years)
      ageGroup = "Child (6-12 years)";
      dosageMultiplier = 0.4;
      specialInstructions = "💊 Chewables preferred, small tablets acceptable if child can swallow";
      administrationMethod = "🧒 How to give: Chewable tablets or gummies. If using regular tablets, teach to swallow with plenty of water. Can crush and mix with food if needed.";
      precautions = "⚠️ Requires parental supervision. Use age-appropriate formulations. Check with pediatrician for proper dosing.";
    } else if (ageNum >= 12 && ageNum < 18) {
      // Adolescent (12-18 years)
      ageGroup = "Adolescent (12-18 years)";
      dosageMultiplier = 0.7;
      specialInstructions = "Teen dosing - can use adult forms at reduced dose";
      administrationMethod = "🧑 How to give: Can swallow tablets/capsules with water. Take with food as directed.";
      precautions = "⚠️ Parental oversight recommended. Consult doctor before starting any supplement regimen.";
    } else if (ageNum >= 18 && ageNum <= 30) {
      ageGroup = "Young Adult (18-30)";
      dosageMultiplier = 1.0;
      specialInstructions = "Standard adult dosage recommended";
      administrationMethod = "💊 Swallow tablets/capsules whole with full glass of water.";
      precautions = "Monitor for any adverse reactions during first week";
    } else if (ageNum > 30 && ageNum <= 50) {
      ageGroup = "Adult (31-50)";
      dosageMultiplier = 1.0;
      specialInstructions = "Standard dosage - may increase based on deficiency severity";
      administrationMethod = "💊 Swallow tablets/capsules whole with full glass of water.";
      precautions = "Consider liver function if on other medications";
    } else if (ageNum > 50 && ageNum <= 65) {
      ageGroup = "Mature Adult (51-65)";
      dosageMultiplier = 0.85;
      specialInstructions = "Slightly reduced dosage for better absorption";
      administrationMethod = "💊 Swallow with water. If difficulty swallowing, use liquid or chewable forms.";
      precautions = "Check for drug interactions with existing medications";
    } else {
      ageGroup = "Senior (65+)";
      dosageMultiplier = 0.7;
      specialInstructions = "Reduced dosage recommended - enhanced monitoring needed";
      administrationMethod = "💊 Use easy-to-swallow forms. Liquid or chewable options available if swallowing is difficult.";
      precautions = "⚠️ Consult physician - may interact with blood thinners/heart medications";
    }

    // Get timing and food advice based on supplement type
    const supplementLower = supplementName.toLowerCase();
    if (supplementLower.includes("vitamin d") || supplementLower.includes("vitamin e") || supplementLower.includes("vitamin a") || supplementLower.includes("vitamin k")) {
      timingAdvice = "Take with breakfast or lunch";
      foodAdvice = "🍽️ Take WITH fatty foods (eggs, avocado, nuts) for better absorption";
    } else if (supplementLower.includes("vitamin c")) {
      timingAdvice = "Take in the morning or divided doses";
      foodAdvice = "🍊 Can be taken with or without food. Avoid taking with dairy products";
    } else if (supplementLower.includes("vitamin b") || supplementLower.includes("b12") || supplementLower.includes("b6") || supplementLower.includes("folate") || supplementLower.includes("folic")) {
      timingAdvice = "Take in the morning for energy boost";
      foodAdvice = "🌅 Best absorbed on empty stomach, or with light meal";
    } else if (supplementLower.includes("iron")) {
      timingAdvice = "Take 1 hour before or 2 hours after meals";
      foodAdvice = "🍊 Take with Vitamin C for enhanced absorption. Avoid with calcium, tea, coffee";
    } else if (supplementLower.includes("calcium")) {
      timingAdvice = "Take in divided doses (morning and evening)";
      foodAdvice = "🥛 Take with food. Do NOT combine with iron supplements";
    } else if (supplementLower.includes("zinc")) {
      timingAdvice = "Take 1-2 hours before or after meals";
      foodAdvice = "💊 Best on empty stomach. If causes nausea, take with food";
    } else if (supplementLower.includes("magnesium")) {
      timingAdvice = "Take in the evening before bed";
      foodAdvice = "🌙 Take with food to avoid stomach upset. Promotes relaxation";
    } else if (supplementLower.includes("omega") || supplementLower.includes("fish oil")) {
      timingAdvice = "Take with main meal";
      foodAdvice = "🐟 Take with largest meal of the day for best absorption";
    } else {
      timingAdvice = "Follow package instructions or take with meals";
      foodAdvice = "💊 Generally safe to take with food";
    }

    // Calculate adjusted dosage (simplistic approach - extract number and adjust)
    const dosageMatch = baseDosage.match(/(\d+(?:\.\d+)?)/g);
    let adjustedDosage = baseDosage;
    if (dosageMatch && dosageMatch.length > 0 && dosageMultiplier !== 1.0) {
      const originalValue = parseFloat(dosageMatch[0]);
      const adjustedValue = Math.round(originalValue * dosageMultiplier);
      adjustedDosage = baseDosage.replace(dosageMatch[0], adjustedValue.toString());
    }

    return {
      ageGroup,
      adjustedDosage,
      specialInstructions,
      timingAdvice,
      foodAdvice,
      precautions,
      administrationMethod,
      dosageNote: dosageMultiplier !== 1.0 ? `(Adjusted from ${baseDosage} for your age group)` : ""
    };
  };

  const handleConnect = async () => {
    setConnectionError("");
    setBackendStatus("connecting");
    try {
      const startTime = Date.now();
      await axios.get(`${backendURL}/ping`, { timeout: 3000 });
      const responseTime = Date.now() - startTime;
      setProcessingSpeed(responseTime);
      setBackendAvailable(true);
      setBackendStatus("connected");
      setShowBackendInput(false);
      // Save to localStorage on successful connection
      localStorage.setItem('backendURL', backendURL);
    } catch {
      setConnectionError("Could not connect. Please check the URL.");
      setBackendAvailable(false);
      setBackendStatus("disconnected");
    }
  };

  // Load report history from localStorage on mount
  useEffect(() => {
    const savedReports = JSON.parse(localStorage.getItem('BioNutriScanReports') || '[]');
    setReportHistory(savedReports);
  }, []);

  useEffect(() => {
    // We already check backend in the root landing page transition, 
    // so we don't need to auto-trigger pings until the user interacts with the app.
    // This prevents ERR_CONNECTION_REFUSED in logs before the app is even ready.
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      // Periodic check only if we are already marked as available or in a session
      if (backendAvailable === false && !sessionStorage.getItem('appStarted')) return;
      
      try {
        const startTime = Date.now();
        await axios.get(`${backendURL}/ping`, { timeout: 3000 });
        const responseTime = Date.now() - startTime;
        setProcessingSpeed(responseTime);
        setBackendAvailable(true);
        setBackendStatus("connected");
      } catch {
        setBackendAvailable(false);
        setBackendStatus("disconnected");
      }
    }, 10000); // Increased interval to 10s to reduce noise
    return () => clearInterval(interval);
  }, [backendURL, backendAvailable]);

  const [base64Preview, setBase64Preview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setDisease(null);
    setConfidence(null);
    setGeminiAnalysis(null);
    setImageHash(null);
    setFeedbackGiven(false);
    setShowFeedbackForm(false);
    setPreview(selectedFile ? URL.createObjectURL(selectedFile) : null);
    
    // Convert to base64 for persistent storage
    if (selectedFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Preview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setBase64Preview(null);
    }
  };

 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setFormError("");
  
  if (!name.trim()) {
    setFormError("Please enter your name.");
    return;
  }
  if (!age) {
    setFormError("Please enter your age.");
    return;
  }
  if (!file) {
    setFormError("Please provide an image of the affected area.");
    return;
  }
  if (!agreedToTerms) {
    setFormError("You must agree to the Terms & Conditions.");
    return;
  }

  setLoading(true);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("age", age);

  try {
    // Generate simple image hash using file name and size
    const fileHash = `${file.name}_${file.size}_${Date.now()}`;
    setImageHash(fileHash);

    const startTime = Date.now();
    const res = await axios.post(`${backendURL}/predict`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const responseTime = Date.now() - startTime;
    setProcessingSpeed(responseTime);

    // Update state
    setDisease(res.data.disease);
    setConfidence(res.data.confidence);
    
    // Debug: Log the response to check structure
    console.log('API Response:', res.data);
    console.log('AI Analysis:', res.data.ai_analysis);
    console.log('Gemini Analysis:', res.data.gemini_analysis);
    
    const analysisData = res.data.ai_analysis || res.data.gemini_analysis;
    console.log('Analysis Data to Set:', analysisData);
    console.log('Has dietary_recommendations:', analysisData?.dietary_recommendations);
    console.log('Has lifestyle_recommendations:', analysisData?.lifestyle_recommendations);
    console.log('Has supplements:', analysisData?.supplements);
    
    setGeminiAnalysis(analysisData);
    // recommendation and medicine are no longer shown in the UI

    // Save to history immediately after analysis is complete
    const analysisId = 'V' + Date.now().toString().slice(-8);
    setCurrentAnalysisId(analysisId);
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    const diseaseResult = res.data.disease;
    const confidenceResult = res.data.confidence;
    
    // Normalize confidence for health score calculation (Handle 9500, 0.95, or 95 formats)
    let normalizedConfForScore = confidenceResult || 0;
    if (normalizedConfForScore >= 100) normalizedConfForScore = normalizedConfForScore / 100;
    else if (normalizedConfForScore <= 1 && normalizedConfForScore > 0) normalizedConfForScore = normalizedConfForScore * 100;
    
    const healthScore = diseaseResult === "Normal" ? 100 : Math.max(10, 100 - normalizedConfForScore);
    
    // Get base64 image - wait for it if not ready yet
    let imageToStore = base64Preview;
    if (!imageToStore && file) {
      imageToStore = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
    
    const savedReports = JSON.parse(localStorage.getItem('BioNutriScanReports') || '[]');
    savedReports.unshift({
      id: analysisId,
      name: name,
      age: age,
      date: currentDate,
      time: currentTime,
      disease: diseaseResult,
      confidence: confidenceResult,
      healthScore: healthScore,
      imagePreview: imageToStore,
      geminiAnalysis: analysisData
    });
    // Keep only last 20 reports
    if (savedReports.length > 20) savedReports.pop();
    localStorage.setItem('BioNutriScanReports', JSON.stringify(savedReports));
    setReportHistory(savedReports);

    // --- Firebase Sync Area ---
    try {
      // 1. Upload image to Firebase Storage
      const storagePath = `analysis_images/${analysisId}_${file.name}`;
      const imageRef = storageRef(storage, storagePath);
      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);

      // 2. Store data in Realtime Database under global AND user-specific nodes
      const analysisPayload = {
        id: analysisId,
        name: name,
        age: age,
        date: currentDate,
        time: currentTime,
        disease: diseaseResult,
        confidence: confidenceResult,
        healthScore: healthScore,
        imageUrl: imageUrl,
        geminiAnalysis: analysisData,
        timestamp: Date.now()
      };

      // --- Local Storage History (User Privacy) ---
      try {
        const localHistory = JSON.parse(localStorage.getItem("report_history") || "[]");
        const newRecord = { ...analysisPayload, id: analysisId, timestamp: Date.now() };
        const updatedHistory = [newRecord, ...localHistory].slice(0, 50); // Keep last 50
        localStorage.setItem("report_history", JSON.stringify(updatedHistory));
        setReportHistory(updatedHistory);
      } catch (lErr) {
        console.warn("Local history save failed:", lErr);
      }

      // --- Firebase Global Record (Admin Only) ---
      try {
        const globalAnalysesRef = push(dbRef(db, "analyses"));
        await set(globalAnalysesRef, analysisPayload);
      } catch (fErr) {
        console.warn("Admin record sync failed:", fErr);
      }

      console.log("Data successfully synced!");
    } catch (firebaseErr) {
      console.warn("Cloud sync warning:", firebaseErr);
    }

    // --- SweetAlert Popup ---
   Swal.fire({
  title: `<span style="color:#00ff2a;">Analysis Complete!</span>`,
  html: `
    <p style="color:#ffffff">Hello <strong>${name}</strong>, your vitamin deficiency analysis is ready.</p>
  `,
  icon: "success",
  showCloseButton: true,
  confirmButtonText: "View Full Report",
  confirmButtonColor: "transparent",  // use a solid color, gradient not supported here
  background: "linear-gradient(135deg, #05051e, #1e1e3f)",
  color: "#ffffff",  // text color inside popup
  width: 450,
  padding: "2rem",
  backdrop: "rgba(0,0,0,0.6)"
});


  } catch (error: unknown) {
    // Handle API errors
    const err = error as { response?: { data: { message?: string; error?: string; details?: string } } };
    if (err.response) {
      const errorData = err.response.data;
      
      // Show specific error message
      Swal.fire({
        title: `<span style="color:#ff1900;">Analysis Failed</span>`,
        html: `
          <p style="color:#ffffff">${errorData.message || errorData.error || 'Unable to analyze the image'}</p>
          <p style="color:#ffffffaa; font-size: 14px; margin-top: 10px;">${errorData.details || 'Please try again in a few moments.'}</p>
        `,
        icon: "error",
        confirmButtonText: "OK",
        background: "linear-gradient(135deg, #1e0505, #3f1e1e)",
        color: "#ffffff",
        width: 450,
        padding: "2rem"
      });
    } else {
      setConnectionError("Could not connect to backend. Please try again.");
    }
  } finally {
    setLoading(false);
  }
};

  const handleFeedback = async (isAccurate: boolean) => {
    setFeedbackLoading(true);
    try {
      const formData = new FormData();
      // Add image file if available
      if (file) {
        formData.append("image_file", file);
      }
      formData.append("image_hash", imageHash || "unknown");
      formData.append("analysis_result", JSON.stringify({
        disease: disease,
        confidence: confidence,
        gemini_analysis: geminiAnalysis
      }));
      formData.append("is_accurate", String(isAccurate));
      formData.append("feedback_text", feedbackText);
      
      const response = await axios.post(`${backendURL}/submit-feedback`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      // --- Firebase Feedback Storage ---
      try {
        const feedbackRef = push(dbRef(db, "feedbacks"));
        await set(feedbackRef, {
          userId: name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'),
          userName: name,
          isAccurate: isAccurate,
          feedbackText: feedbackText,
          imageHash: imageHash,
          disease: disease,
          timestamp: Date.now()
        });
      } catch (fErr) {
        console.warn("Feedback cloud sync failed:", fErr);
      }
      
      setModelAccuracy(response.data.accuracy_metrics?.accuracy_percentage);
      setFeedbackGiven(true);
      setShowFeedbackForm(false);
      setFeedbackText("");
      
      Swal.fire({
        title: "<span style=\"color:#00ff2a;\">Thank You!</span>",
        html: `
          <p style="color:#ffffff">Your feedback helps improve our model accuracy.</p>
          <p style="color:#ffffffaa; font-size: 14px;">Current Model Accuracy: <strong>${response.data.accuracy_metrics?.accuracy_percentage || 0}%</strong></p>
        `,
        icon: "success",
        confirmButtonText: "OK",
        background: "linear-gradient(135deg, #05051e, #1e1e3f)",
        color: "#ffffff",
        width: 450,
        padding: "2rem"
      });
    } catch (error) {
      console.error("Feedback submission error:", error);
      Swal.fire({
        title: "<span style=\"color:#ff1900;\">Error</span>",
        html: "<p style=\"color:#ffffff\">Could not submit feedback. Please try again.</p>",
        icon: "error",
        confirmButtonText: "OK",
        background: "linear-gradient(135deg, #1e0505, #3f1e1e)",
        color: "#ffffff",
        width: 450,
        padding: "2rem"
      });
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Generate and download analysis report as HTML file
  const generateReport = () => {
    if (!disease) return;

    const analysisId = currentAnalysisId || ('V' + Date.now().toString().slice(-8));
    if (!currentAnalysisId) setCurrentAnalysisId(analysisId);

    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    const healthScore = disease === "Normal" ? 100 : Math.max(10, 100 - (confidence || 0));
    
    // Build the report content
    const reportHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BioNutriScan Analysis Report - ${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: #ffffff;
      color: #1a1a2e;
      padding: 15px;
      font-size: 11px;
    }
    .container { max-width: 100%; margin: 0 auto; }
    .header { 
      text-align: center; 
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #00994d;
    }
    .header h1 { 
      color: #00994d; 
      font-size: 20px;
      margin-bottom: 4px;
    }
    .header p { color: #666666; font-size: 10px; margin: 2px 0; }
    .section { 
      background: #f8f9fa;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
      border: 1px solid #e0e0e0;
    }
    .section h2 { 
      color: #00994d; 
      margin-bottom: 6px;
      font-size: 13px;
    }
    .section h3 { 
      color: #cc7000; 
      margin-bottom: 4px;
      font-size: 11px;
    }
    .info-grid { 
      display: grid; 
      grid-template-columns: repeat(4, 1fr); 
      gap: 8px;
    }
    .info-item { 
      background: #ffffff;
      padding: 6px;
      border-radius: 5px;
      border: 1px solid #e8e8e8;
    }
    .info-label { color: #888888; font-size: 9px; }
    .info-value { color: #1a1a2e; font-size: 11px; font-weight: 600; }
    .confidence-bar { 
      background: #e0e0e0;
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
      margin-top: 5px;
    }
    .confidence-fill { 
      height: 100%;
      background: linear-gradient(90deg, #00994d, #4CAF50);
      border-radius: 6px;
    }
    .deficiency-card { 
      background: #fff5e6;
      border-left: 3px solid #cc7000;
      padding: 8px;
      margin: 5px 0;
      border-radius: 0 6px 6px 0;
    }
    .deficiency-card p { margin: 2px 0; font-size: 10px; color: #333; }
    .risk-high { border-left-color: #cc0000; background: #ffe6e6; }
    .risk-low { border-left-color: #00994d; background: #e6ffe6; }
    .health-score { 
      text-align: center;
      font-size: 28px;
      font-weight: bold;
      color: ${healthScore >= 70 ? '#00994d' : healthScore >= 40 ? '#cc7000' : '#cc0000'};
    }
    .recommendation-item { 
      padding: 4px 8px;
      margin: 3px 0;
      background: #e6f7ed;
      border-radius: 5px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #1a1a2e;
    }
    .supplement-card { 
      background: #ffffff;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
      margin: 5px 0;
    }
    .supplement-card p { font-size: 10px; margin: 2px 0; color: #333; }
    .brand-tag { 
      display: inline-block;
      background: #e6f7ed;
      color: #00663a;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 9px;
      margin: 2px;
    }
    .footer { 
      text-align: center;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #e0e0e0;
      color: #666666;
      font-size: 9px;
    }
    .normal-status { 
      background: #e6f7ed;
      border: 2px solid #00994d;
      padding: 10px;
      border-radius: 8px;
      text-align: center;
    }
    .normal-status p { font-size: 10px; margin: 4px 0; color: #1a1a2e; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .two-column .section { margin-bottom: 0; }
    @media print {
      body { 
        background: #ffffff !important; 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        padding: 10px !important;
      }
      .container { max-width: 100%; }
      .section { break-inside: avoid; }
    }
    @page {
      size: A4;
      margin: 8mm;
    }
    .patient-image-section {
      display: flex;
      gap: 15px;
      align-items: flex-start;
    }
    .patient-image-container {
      flex-shrink: 0;
    }
    .patient-image {
      width: 100px;
      height: 100px;
      object-fit: cover;
      border-radius: 8px;
      border: 2px solid #00994d;
    }
    .patient-info-right {
      flex: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧬 BioNutriScan Analysis Report</h1>
      <p style="margin-top: 10px;">Generated on ${currentDate} at ${currentTime}</p>
    </div>

    <!-- Patient Information with Image -->
    <div class="section">
      <h2>👤 Patient Information</h2>
      <div class="patient-image-section">
        ${base64Preview || preview ? `
        <div class="patient-image-container">
          <img src="${base64Preview || preview}" alt="Analyzed Skin Image" class="patient-image" />
          <p style="font-size: 8px; text-align: center; margin-top: 4px; color: #666;">Analyzed Image</p>
        </div>
        ` : ''}
        <div class="patient-info-right">
          <div class="info-grid" style="grid-template-columns: repeat(2, 1fr);">
            <div class="info-item">
              <div class="info-label">Name</div>
              <div class="info-value">${name || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Age</div>
              <div class="info-value">${age || 'N/A'} years</div>
            </div>
            <div class="info-item">
              <div class="info-label">Analysis ID</div>
              <div class="info-value">#${analysisId}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Date</div>
              <div class="info-value">${currentDate}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Confidence -->
    <div class="section">
      <h2>🤖 AI Analysis Result</h2>
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px; color: #1a1a2e;">
        ${disease === "Normal" ? "✅ No Deficiency Detected" : disease?.replace(" Deficiency Deficiency", " Deficiency")}
      </div>
      <div style="font-size: 14px; color: #666;">Confidence Level: ${(confidence && confidence > 100 ? confidence / 100 : confidence || 0).toFixed(1)}%</div>
      <div class="confidence-bar">
        <div class="confidence-fill" style="width: ${confidence && confidence > 100 ? confidence / 100 : confidence || 0}%"></div>
      </div>
    </div>

    ${disease === "Normal" ? `
    <!-- Normal Status -->
    <div class="section normal-status">
      <h2>✅ Status: Normal & Healthy</h2>
      <p style="margin-top: 10px;">Your skin analysis shows no significant vitamin deficiencies. You have a healthy nutrient profile!</p>
      <p style="margin-top: 10px;"><strong>Recommendation:</strong> Maintain your current healthy diet and lifestyle to keep your skin in excellent condition.</p>
    </div>
    ` : ''}

    ${geminiAnalysis?.image_description && disease !== "Normal" ? `
    <!-- Image Analysis -->
    <div class="section">
      <h2>🔍 Image Analysis</h2>
      <p>${geminiAnalysis.image_description}</p>
    </div>
    ` : ''}

    ${geminiAnalysis?.analysis_conclusion ? `
    <!-- Clinical Conclusion -->
    <div class="section">
      <h2>💡 Clinical Conclusion</h2>
      <p>${geminiAnalysis.analysis_conclusion}</p>
    </div>
    ` : ''}

    ${disease !== "Normal" && geminiAnalysis?.deficiencies && geminiAnalysis.deficiencies.length > 0 ? `
    <!-- Detected Deficiencies -->
    <div class="section">
      <h2>⚠️ Detected Deficiencies</h2>
      ${geminiAnalysis.deficiencies.filter(d => d.likelihood > 0).sort((a, b) => b.likelihood - a.likelihood).slice(0, 5).map(def => {
        const riskLevel = def.likelihood >= 70 ? "high" : def.likelihood >= 50 ? "medium" : "low";
        const riskClass = riskLevel === "high" ? "risk-high" : riskLevel === "low" ? "risk-low" : "";
        return `
        <div class="deficiency-card ${riskClass}">
          <h3>${def.vitamin?.replace(" Deficiency Deficiency", " Deficiency")}</h3>
          <p><strong>Likelihood:</strong> ${def.likelihood}%</p>
          ${def.severity ? `<p><strong>Severity:</strong> ${def.severity}</p>` : ''}
          ${def.symptoms ? `<p><strong>Symptoms:</strong> ${def.symptoms}</p>` : ''}
          ${def.clinical_description ? `<p><strong>Clinical Details:</strong> ${def.clinical_description}</p>` : ''}
          ${def.recovery_timeline ? `<p><strong>Recovery Timeline:</strong> ${def.recovery_timeline}</p>` : ''}
        </div>
        `;
      }).join('')}
    </div>
    ` : ''}

    <!-- Health Score -->
    <div class="section" style="text-align: center; padding: 8px;">
      <h2 style="display: inline; margin-right: 15px;">❤️ Health Score:</h2>
      <span class="health-score" style="font-size: 24px;">${healthScore}/100</span>
      <span style="margin-left: 10px; font-size: 11px;">
        (${disease === "Normal" ? "Excellent" :
          healthScore >= 70 ? "Good" :
          healthScore >= 40 ? "Fair" : "Poor"})
      </span>
    </div>

    ${disease !== "Normal" && ((geminiAnalysis?.dietary_recommendations && geminiAnalysis.dietary_recommendations.length > 0) || (geminiAnalysis?.lifestyle_recommendations && geminiAnalysis.lifestyle_recommendations.length > 0)) ? `
    <div class="two-column">
      ${geminiAnalysis?.dietary_recommendations && geminiAnalysis.dietary_recommendations.length > 0 ? `
      <div class="section">
        <h2>🍽️ Dietary</h2>
        ${geminiAnalysis.dietary_recommendations.slice(0, 4).map(rec => `
          <div class="recommendation-item"><span>✓</span><span>${rec}</span></div>
        `).join('')}
      </div>
      ` : '<div></div>'}
      ${geminiAnalysis?.lifestyle_recommendations && geminiAnalysis.lifestyle_recommendations.length > 0 ? `
      <div class="section">
        <h2>🏃 Lifestyle</h2>
        ${geminiAnalysis.lifestyle_recommendations.slice(0, 4).map(rec => `
          <div class="recommendation-item"><span>✓</span><span>${rec}</span></div>
        `).join('')}
      </div>
      ` : '<div></div>'}
    </div>
    ` : ''}

    ${disease !== "Normal" && geminiAnalysis?.supplements && geminiAnalysis.supplements.length > 0 ? `
    <div class="section">
      <h2>💊 Supplements</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
      ${geminiAnalysis.supplements.slice(0, 3).map(supp => `
        <div class="supplement-card">
          <h3>${supp.name}</h3>
          <p><strong>Dosage:</strong> ${supp.dosage} | <strong>Timeline:</strong> ${supp.timeline}</p>
          <div>${supp.brands.slice(0, 2).map(b => `<span class="brand-tag">${b}</span>`).join('')}</div>
        </div>
      `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="footer">
      <p>🧬 This report is for informational purposes only. Consult a healthcare professional.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Create and open in new window for PDF printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHTML);
      printWindow.document.close();
      
      // Wait for content to load then trigger print dialog
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }

    Swal.fire({
      title: '<span style="color:#00ff2a;">Report Generated!</span>',
      html: `
        <p style="color:#ffffff">Your analysis report is ready.</p>
        <p style="color:#ffffffaa; font-size: 14px; margin-top: 10px;">Use the print dialog to save as PDF.</p>
        <p style="color:#ffffffaa; font-size: 12px; margin-top: 5px;">💡 Tip: Select "Save as PDF" in the print destination.</p>
      `,
      icon: "success",
      confirmButtonText: "OK",
      background: "linear-gradient(135deg, #05051e, #1e1e3f)",
      color: "#ffffff",
      width: 450,
      padding: "2rem"
    });
  };

  // View report from history
  const viewReportFromHistory = (report: {
    id: string;
    name: string;
    age: string;
    date: string;
    time: string;
    disease: string;
    confidence: number;
    healthScore: number;
    imagePreview?: string;
    geminiAnalysis?: unknown;
  }) => {
    const healthScore = report.disease === "Normal" ? 100 : Math.max(10, 100 - (report.confidence || 0));
    const geminiAnalysis = report.geminiAnalysis as {
      image_description?: string;
      analysis_conclusion?: string;
      deficiencies?: Array<{ vitamin: string; likelihood: number; severity?: string; symptoms?: string; clinical_description?: string; recovery_timeline?: string }>;
      dietary_recommendations?: string[];
      lifestyle_recommendations?: string[];
      supplements?: Array<{ name: string; dosage: string; timeline: string; brands: string[] }>;
    } | null;
    
    const reportHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BioNutriScan Analysis Report - ${report.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: #ffffff;
      color: #1a1a2e;
      padding: 15px;
      font-size: 11px;
    }
    .container { max-width: 100%; margin: 0 auto; }
    .header { 
      text-align: center; 
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #00994d;
    }
    .header h1 { 
      color: #00994d; 
      font-size: 20px;
      margin-bottom: 4px;
    }
    .header p { color: #666666; font-size: 10px; margin: 2px 0; }
    .section { 
      background: #f8f9fa;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
      border: 1px solid #e0e0e0;
    }
    .section h2 { 
      color: #00994d; 
      margin-bottom: 6px;
      font-size: 13px;
    }
    .section h3 { 
      color: #cc7000; 
      margin-bottom: 4px;
      font-size: 11px;
    }
    .info-grid { 
      display: grid; 
      grid-template-columns: repeat(4, 1fr); 
      gap: 8px;
    }
    .info-item { 
      background: #ffffff;
      padding: 6px;
      border-radius: 5px;
      border: 1px solid #e8e8e8;
    }
    .info-label { color: #888888; font-size: 9px; }
    .info-value { color: #1a1a2e; font-size: 11px; font-weight: 600; }
    .confidence-bar { 
      background: #e0e0e0;
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
      margin-top: 5px;
    }
    .confidence-fill { 
      height: 100%;
      background: linear-gradient(90deg, #00994d, #4CAF50);
      border-radius: 6px;
    }
    .deficiency-card { 
      background: #fff5e6;
      border-left: 3px solid #cc7000;
      padding: 8px;
      margin: 5px 0;
      border-radius: 0 6px 6px 0;
    }
    .deficiency-card p { margin: 2px 0; font-size: 10px; color: #333; }
    .risk-high { border-left-color: #cc0000; background: #ffe6e6; }
    .risk-low { border-left-color: #00994d; background: #e6ffe6; }
    .health-score { 
      text-align: center;
      font-size: 28px;
      font-weight: bold;
      color: ${healthScore >= 70 ? '#00994d' : healthScore >= 40 ? '#cc7000' : '#cc0000'};
    }
    .recommendation-item { 
      padding: 4px 8px;
      margin: 3px 0;
      background: #e6f7ed;
      border-radius: 5px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #1a1a2e;
    }
    .supplement-card { 
      background: #ffffff;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
      margin: 5px 0;
    }
    .supplement-card p { font-size: 10px; margin: 2px 0; color: #333; }
    .brand-tag { 
      display: inline-block;
      background: #e6f7ed;
      color: #00663a;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 9px;
      margin: 2px;
    }
    .footer { 
      text-align: center;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #e0e0e0;
      color: #666666;
      font-size: 9px;
    }
    .normal-status { 
      background: #e6f7ed;
      border: 2px solid #00994d;
      padding: 10px;
      border-radius: 8px;
      text-align: center;
    }
    .normal-status p { font-size: 10px; margin: 4px 0; color: #1a1a2e; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .two-column .section { margin-bottom: 0; }
    @media print {
      body { 
        background: #ffffff !important; 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        padding: 10px !important;
      }
      .container { max-width: 100%; }
      .section { break-inside: avoid; }
    }
    @page {
      size: A4;
      margin: 8mm;
    }
    .patient-image-section {
      display: flex;
      gap: 15px;
      align-items: flex-start;
    }
    .patient-image-container {
      flex-shrink: 0;
    }
    .patient-image {
      width: 100px;
      height: 100px;
      object-fit: cover;
      border-radius: 8px;
      border: 2px solid #00994d;
    }
    .patient-info-right {
      flex: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧬 BioNutriScan Analysis Report</h1>
      <p>A Clinical System for Vitamin Deficiency Detection</p>
      <p style="margin-top: 10px;">Generated on ${report.date} at ${report.time}</p>
    </div>

    <!-- Patient Information with Image -->
    <div class="section">
      <h2>👤 Patient Information</h2>
      <div class="patient-image-section">
        ${report.imagePreview ? `
        <div class="patient-image-container">
          <img src="${report.imagePreview}" alt="Analyzed Skin Image" class="patient-image" />
          <p style="font-size: 8px; text-align: center; margin-top: 4px; color: #666;">Analyzed Image</p>
        </div>
        ` : ''}
        <div class="patient-info-right">
          <div class="info-grid" style="grid-template-columns: repeat(2, 1fr);">
            <div class="info-item">
              <div class="info-label">Name</div>
              <div class="info-value">${report.name || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Age</div>
              <div class="info-value">${report.age || 'N/A'} years</div>
            </div>
            <div class="info-item">
              <div class="info-label">Analysis ID</div>
              <div class="info-value">#${report.id}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Date</div>
              <div class="info-value">${report.date}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Confidence -->
    <div class="section">
      <h2>🤖 AI Analysis Result</h2>
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px; color: #1a1a2e;">
        ${report.disease === "Normal" ? "✅ No Deficiency Detected" : report.disease?.replace(" Deficiency Deficiency", " Deficiency")}
      </div>
      <div style="font-size: 14px; color: #666;">Confidence Level: ${(report.confidence && report.confidence > 100 ? report.confidence / 100 : report.confidence || 0).toFixed(1)}%</div>
      <div class="confidence-bar">
        <div class="confidence-fill" style="width: ${report.confidence && report.confidence > 100 ? report.confidence / 100 : report.confidence || 0}%"></div>
      </div>
    </div>

    ${report.disease === "Normal" ? `
    <!-- Normal Status -->
    <div class="section normal-status">
      <h2>✅ Status: Normal & Healthy</h2>
      <p style="margin-top: 10px;">Your skin analysis shows no significant vitamin deficiencies. You have a healthy nutrient profile!</p>
      <p style="margin-top: 10px;"><strong>Recommendation:</strong> Maintain your current healthy diet and lifestyle to keep your skin in excellent condition.</p>
    </div>
    ` : ''}

    ${geminiAnalysis?.image_description && report.disease !== "Normal" ? `
    <!-- Image Analysis -->
    <div class="section">
      <h2>🔍 Image Analysis</h2>
      <p>${geminiAnalysis.image_description}</p>
    </div>
    ` : ''}

    ${geminiAnalysis?.analysis_conclusion ? `
    <!-- Clinical Conclusion -->
    <div class="section">
      <h2>💡 Clinical Conclusion</h2>
      <p>${geminiAnalysis.analysis_conclusion}</p>
    </div>
    ` : ''}

    ${report.disease !== "Normal" && geminiAnalysis?.deficiencies && geminiAnalysis.deficiencies.length > 0 ? `
    <!-- Detected Deficiencies -->
    <div class="section">
      <h2>⚠️ Detected Deficiencies</h2>
      ${geminiAnalysis.deficiencies.filter((d: { likelihood: number }) => d.likelihood > 0).sort((a: { likelihood: number }, b: { likelihood: number }) => b.likelihood - a.likelihood).slice(0, 5).map((def: { vitamin: string; likelihood: number; severity?: string; symptoms?: string; clinical_description?: string; recovery_timeline?: string }) => {
        const riskLevel = def.likelihood >= 70 ? "high" : def.likelihood >= 50 ? "medium" : "low";
        const riskClass = riskLevel === "high" ? "risk-high" : riskLevel === "low" ? "risk-low" : "";
        return `
        <div class="deficiency-card ${riskClass}">
          <h3>${def.vitamin?.replace(" Deficiency Deficiency", " Deficiency")}</h3>
          <p><strong>Likelihood:</strong> ${def.likelihood}%</p>
          ${def.severity ? `<p><strong>Severity:</strong> ${def.severity}</p>` : ''}
          ${def.symptoms ? `<p><strong>Symptoms:</strong> ${def.symptoms}</p>` : ''}
          ${def.clinical_description ? `<p><strong>Clinical Details:</strong> ${def.clinical_description}</p>` : ''}
          ${def.recovery_timeline ? `<p><strong>Recovery Timeline:</strong> ${def.recovery_timeline}</p>` : ''}
        </div>
        `;
      }).join('')}
    </div>
    ` : ''}

    <!-- Health Score -->
    <div class="section" style="text-align: center; padding: 8px;">
      <h2 style="display: inline; margin-right: 15px;">❤️ Health Score:</h2>
      <span class="health-score" style="font-size: 24px;">${healthScore}/100</span>
      <span style="margin-left: 10px; font-size: 11px;">
        (${report.disease === "Normal" ? "Excellent" :
          healthScore >= 70 ? "Good" :
          healthScore >= 40 ? "Fair" : "Poor"})
      </span>
    </div>

    ${report.disease !== "Normal" && ((geminiAnalysis?.dietary_recommendations && geminiAnalysis.dietary_recommendations.length > 0) || (geminiAnalysis?.lifestyle_recommendations && geminiAnalysis.lifestyle_recommendations.length > 0)) ? `
    <div class="two-column">
      ${geminiAnalysis?.dietary_recommendations && geminiAnalysis.dietary_recommendations.length > 0 ? `
      <div class="section">
        <h2>🍽️ Dietary</h2>
        ${geminiAnalysis.dietary_recommendations.slice(0, 4).map((rec: string) => `
          <div class="recommendation-item"><span>✓</span><span>${rec}</span></div>
        `).join('')}
      </div>
      ` : '<div></div>'}
      ${geminiAnalysis?.lifestyle_recommendations && geminiAnalysis.lifestyle_recommendations.length > 0 ? `
      <div class="section">
        <h2>🏃 Lifestyle</h2>
        ${geminiAnalysis.lifestyle_recommendations.slice(0, 4).map((rec: string) => `
          <div class="recommendation-item"><span>✓</span><span>${rec}</span></div>
        `).join('')}
      </div>
      ` : '<div></div>'}
    </div>
    ` : ''}

    ${report.disease !== "Normal" && geminiAnalysis?.supplements && geminiAnalysis.supplements.length > 0 ? `
    <div class="section">
      <h2>💊 Supplements</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
      ${geminiAnalysis.supplements.slice(0, 3).map((supp: { name: string; dosage: string; timeline: string; brands: string[] }) => `
        <div class="supplement-card">
          <h3>${supp.name}</h3>
          <p><strong>Dosage:</strong> ${supp.dosage} | <strong>Timeline:</strong> ${supp.timeline}</p>
          <div>${supp.brands.slice(0, 2).map((b: string) => `<span class="brand-tag">${b}</span>`).join('')}</div>
        </div>
      `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="footer">
      <p>🧬 BioNutriScan - A Clinical System for Vitamin Deficiency Detection | This report is for informational purposes only. Consult a healthcare professional.</p>
      <p style="margin-top: 3px;">© 2025 BioNutriScan. All Rights Reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Open in new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHTML);
      printWindow.document.close();
    }
    setShowHistory(false);
  };

  // Page switching logic
  if (showAdmin) {
    return <AdminPanel onExit={() => setShowAdmin(false)} />;
  }

  if (showBackendInput) {
    return (
      <div className="main_section center_message">
        <div style={{
          background: "rgba(255,255,255,0.05)",
          padding: "40px",
          borderRadius: "15px",
          border: "1px dashed #f5f5f55c",
          textAlign: "center"
        }}>
          <h2 style={{ color: "#00ff2a", marginBottom: "20px" }}>Connect to Backend</h2>
          <p style={{ color: "#ffffffca", marginBottom: "20px" }}>Enter your backend server URL</p>
          <input
            type="text"
            value={backendURL}
            onChange={(e) => setBackendURL(e.target.value)}
            placeholder="http://localhost:9000"
            style={{
              width: "400px",
              padding: "12px 20px",
              fontSize: "16px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid #f5f5f55c",
              borderRadius: "10px",
              color: "#ffffff",
              outline: "none",
              marginBottom: "20px"
            }}
          />
          <br />
          {connectionError && (
            <div style={{
              color: "#ff1900",
              fontSize: "14px",
              marginBottom: "15px",
              padding: "8px 15px",
              background: "rgba(255, 25, 0, 0.1)",
              border: "1px solid #ff1900",
              borderRadius: "8px"
            }}>
              ⚠️ {connectionError}
            </div>
          )}
          <button
            onClick={handleConnect}
            style={{
              padding: "12px 40px",
              background: "linear-gradient(0deg, #00ff2a, #f6ff00)",
              border: "none",
              borderRadius: "10px",
              color: "#05051e",
              fontSize: "18px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            Connect
          </button>
        </div>
      </div>
    );
  }

  if (backendAvailable === false) {
    return (
      <div className="main_section center_message">
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#00ff2a" }}>Connecting to Backend...</h2>
          <p style={{ color: "#ffffffca" }}>Trying to reach: <code>{backendURL}</code></p>
          <p style={{ color: "#ffffff80", fontSize: "14px", marginTop: "10px" }}>Please ensure the server is running.</p>
          <div style={{
            marginTop: "20px",
            display: "inline-block",
            width: "30px",
            height: "30px",
            border: "3px solid rgba(255,255,255,0.3)",
            borderRadius: "50%",
            borderTopColor: "#00ff2a",
            animation: "spin 1s ease-in-out infinite"
          }}></div>
        </div>
      </div>
    );
  }

  if (showAdmin) {
    return <AdminPanel onExit={() => setShowAdmin(false)} />;
  }

  return (
    <div className="main_section">
      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="image-scanner-container">
            {preview && (
              <div className="scanning-image-wrapper">
                <img src={preview} alt="Scanning" className="scanning-image" />
                <div className="scan-line"></div>
                <div className="scan-grid"></div>
              </div>
            )}
          </div>
          <div className="loading-text">Analyzing...</div>
          <div className="loading-subtext">Scanning your image</div>
        </div>
      )}

      <div className="nav_bar">
        <div className="nav_brand" onClick={() => setShowAdmin(true)} style={{ cursor: 'pointer' }}>
          <img src="./images/logo.png" width="50" height="50" alt="logo" />
          <h1>BioNutriScan <span className="live-indicator">● live</span></h1>
          <p>A Clinical System for Vitamin Deficiency Detection</p>
        </div>
        
        {/* Navigation Buttons */}
        <div className="nav_buttons">
          {/* Home Button */}
          <button 
            onClick={handleGoHome}
            className="nav_btn"
            style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            🏠 Home
          </button>

          {/* Admin Button */}
          <button 
            onClick={() => setShowAdmin(true)} 
            className="nav_btn admin_btn"
            style={{ 
              background: 'rgba(0, 255, 42, 0.1)', 
              color: '#00ff2a',
              border: '1px solid rgba(0, 255, 42, 0.2)'
            }}
          >
            🔐 Admin
          </button>

          {/* History Button */}
          <button
            onClick={() => setShowHistory(true)}
            className="nav_btn"
          >
            📜 History ({reportHistory.length})
          </button>

          {backendStatus === "connected" && processingSpeed > 0 && (
            <div className="nav_speed">
              ⚡ {processingSpeed}ms
            </div>
          )}
        </div>
      </div>

      <div className="container">
        {/* Left Section (Form) - Hidden after analysis is complete */}
        {!disease && (
        <div className="left_section">
          <div className="user_details">
            <div className="form">
              <h1 className="form_title">Vitamin Deficiency Detection</h1>
              <p className="form_subtitle">AI-powered nutritional assessment through visual analysis</p>
              
              {formError && (
                <div className="form_error_message">
                  ⚠️ {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="analysis_form">
                <div className="details_row">
                  <div className="input_group">
                    <label htmlFor="name_input">Your Name</label>
                    <input
                      id="name_input"
                      type="text"
                      className="username"
                      placeholder="eg. Vishal"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="input_group">
                    <label htmlFor="age_input">Your Age</label>
                    <input
                      id="age_input"
                      type="number"
                      className="age"
                      placeholder="eg. 22"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    />
                  </div>
                </div>

                <div className="upload_section">
                  <label>Capture or Upload Analysis Image</label>
                  <div className="upload_container_layout">
                    <div 
                      className="upload_zone_new" 
                    >
                      {preview ? (
                        <div className="preview_container_new">
                          <img src={preview} alt="Preview" className="preview_image_new" />
                          <button 
                            className="remove_preview_btn" 
                            type="button" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreview(null);
                              setFile(null);
                            }}
                            title="Remove image"
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="placeholder_new" 
                          onClick={() => document.getElementById('file_input')?.click()}
                        >
                          <div className="placeholder_icon">🖼️</div>
                          <span>Select Image File</span>
                        </div>
                      )}
                      <input
                        id="file_input"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </div>
                    
                    <div className="camera_prompt">
                      <div className="prompt_text">
                        <strong>For accurate results:</strong>
                        <ul>
                          <li>Ensure bright, natural lighting</li>
                          <li>Hold camera steady & focus clearly</li>
                          <li>Center the affected area in frame</li>
                        </ul>
                      </div>
                      <button 
                        className="open_camera_btn_new" 
                        type="button"
                        onClick={() => setShowCamera(true)}
                      >
                        📸 Open Camera
                      </button>
                    </div>
                  </div>
                </div>

                <div className="terms_agreement">
                  <label className="checkbox_container">
                    <input 
                      type="checkbox" 
                      checked={agreedToTerms} 
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                    />
                    <span className="terms_text">
                      I agree to the <a href="#">Terms & Conditions</a> and <a href="#">Privacy Policy</a> for AI medical analysis.
                    </span>
                  </label>
                </div>

                <button 
                  className={`analyzeButton_new ${!agreedToTerms ? 'disabled' : ''}`} 
                  type="submit" 
                  disabled={loading || !agreedToTerms}
                >
                  {loading ? (
                    <><span className="loading_spinner"></span> Processing...</>
                  ) : (
                    <>🚀 Analyze Professional Report</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
        )}

        {/* Camera Modal Overlay */}
        {showCamera && (
          <div className="camera_overlay" onClick={handleCloseCamera}>
            <div className="camera_container" onClick={(e) => e.stopPropagation()}>
              <div className="camera_header">
                <h3>📸 Capture Diagnosis Image</h3>
                <button className="close_camera" onClick={handleCloseCamera}>&times;</button>
              </div>
              
              <div className="camera_type_selector">
                <button 
                  className={cameraType === "face" ? "active" : ""} 
                  onClick={() => setCameraType("face")}
                >
                  👤 Face Mode
                </button>
                <button 
                  className={cameraType === "skin" ? "active" : ""} 
                  onClick={() => setCameraType("skin")}
                >
                  🔍 Skin/Other Mode
                </button>
              </div>

              <div className="video_wrapper">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className={`camera_video ${cameraType === "face" ? "face_mode" : ""}`}
                />
                
                {countdown !== null && (
                  <div className="capture_countdown">
                    {countdown > 0 ? countdown : "Smile! 📸"}
                  </div>
                )}
                
                {/* Face Detection Status */}
                {cameraType === "face" && (
                  <div className={`detection_badge ${faceDetected ? 'detected' : ''}`}>
                    {faceDetected ? (
                      <><span>✅</span> Face Detected - Hold Still</>
                    ) : (
                      <><span>❌</span> No Face Detected</>
                    )}
                  </div>
                )}
                
                {/* Face Overlay Guide */}
                {cameraType === "face" && (
                  <div className={`face_guide_overlay ${faceDetected ? 'detected' : ''}`}>
                    <div className="face_oval"></div>
                    <div className="camera_instruction">
                      <strong>AI Smart Align:</strong> Keep face within oval. <br />
                      Image will auto-capture when focused.
                    </div>
                  </div>
                )}
                
                {/* Skin/Other Overlay Guide */}
                {cameraType === "skin" && (
                  <div className="skin_guide_overlay">
                    <div className="crosshair"></div>
                    <div className="camera_instruction">Focus on the affected skin area</div>
                  </div>
                )}
              </div>

              <div className="camera_footer">
                <button className="capture_btn" onClick={capturePhoto}>
                  <div className="capture_inner"></div>
                </button>
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
            </div>
          </div>
        )}

        {/* Right Section (Report) - Hidden before analysis is complete */}
        {disease && (
        <div className="right_section">
          <div className="report_section">
            {/* Analysis Report */}
              <div className="full_analysis_report">
                {/* Analysis Report Header */}
                <div className="analysis_report_header">
                  <h1>Analysis Report</h1>
                  <button 
                    className="generate_report_btn"
                    onClick={() => {
                      setDisease(null);
                      setConfidence(null);
                      setGeminiAnalysis(null);
                      setFile(null);
                      setPreview(null);
                      setBase64Preview(null);
                      setName("");
                      setAge("");
                      setFeedbackGiven(false);
                      setShowFeedbackForm(false);
                      setFeedbackText("");
                      setImageHash(null);
                      setFormError("");
                    }}
                    title="Start New Analysis"
                  >
                    🔄 New Analysis
                  </button>
                </div>


                {/* Patient Information Section */}
                <div className="patient_info_section">
                  <h3>👤 Patient Information</h3>
                  <div className="patient_info_grid">
                    <div className="info_item">
                      <span className="info_label">Name:</span>
                      <span className="info_value getName">{name}</span>
                    </div>
                    <div className="info_item">
                      <span className="info_label">Age:</span>
                      <span className="info_value">{age} years</span>
                    </div>
                    <div className="info_item">
                      <span className="info_label">Date:</span>
                      <span className="info_value">{new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="info_item">
                      <span className="info_label">Analysis ID:</span>
                      <span className="info_value">#{'V' + Date.now().toString().slice(-8)}</span>
                    </div>
                  </div>
                </div>

                {/* Normal/Healthy Status Section */}
                {disease === "Normal" && (
                  <div className="normal_status_section">
                    <h3>✅ Status: Normal & Healthy</h3>
                    <div className="normal_content">
                      <p>Your skin analysis shows no significant vitamin deficiencies. You have a healthy nutrient profile!</p>
                      <p><strong>Recommendation:</strong> Maintain your current healthy diet and lifestyle to keep your skin in excellent condition.</p>
                    </div>
                  </div>
                )}

                {/* Image Description & Clinical Conclusion - Side by Side */}
                {geminiAnalysis && disease !== "Normal" && (geminiAnalysis.image_description || geminiAnalysis.analysis_conclusion) && (
                  <div className="analysis_details_container">
                    {/* Image Description Section */}
                    {geminiAnalysis.image_description && (
                      <div className="image_description_section">
                        <h3>🔍 Image Analysis</h3>
                        <div className="description_content">
                          {geminiAnalysis.image_description}
                        </div>
                      </div>
                    )}

                    {/* Analysis Conclusion Section */}
                    {geminiAnalysis.analysis_conclusion && (
                      <div className="analysis_conclusion_section">
                        <h3>💡 Clinical Conclusion</h3>
                        <div className="conclusion_content">
                          {geminiAnalysis.analysis_conclusion}
                        </div>
                      </div>
                    )}
                  </div>
                )}



                  {/* AI Confidence Section */}
              <div className="saferrr">
                  <div className="confidence_section">
                  <div className="confidence_header">
                    <span className="confidence_icon">ⓘ</span>
                    <span className="confidence_title">AI Confidence</span>
                  </div>
                  <div className="detection_name">
                    {disease === "Normal" ? "No Deficiency Detected" : disease?.replace(" Deficiency Deficiency", " Deficiency")}
                  </div>
                </div>
              </div>


                {/* Detected Deficiencies Section */}
                {disease !== "Normal" && geminiAnalysis && geminiAnalysis.deficiencies && geminiAnalysis.deficiencies.length > 0 && (
                  <div className="deficiencies_section">
                    <h3>⚠ Detected Deficiencies</h3>
                    <div className="deficiencies_list">
                      {geminiAnalysis.deficiencies
                        .filter((def: { likelihood: number }) => def.likelihood > 0)
                        .sort((a: { likelihood: number }, b: { likelihood: number }) => b.likelihood - a.likelihood)
                        .slice(0, 5)
                        .map((def: { vitamin: string; likelihood: number; symptoms?: string; severity?: string; visible_signs?: string[]; clinical_description?: string; complications_if_untreated?: string[]; urgency?: string; recovery_timeline?: string }, index: number) => {
                        const riskLevel = def.likelihood >= 70 ? "high" : def.likelihood >= 50 ? "medium" : "low";
                        const riskLabel = riskLevel === "high" ? "High Risk" : riskLevel === "medium" ? "Medium Risk" : "Low Risk";
                        const isTopRisk = index === 0;
                        
                        // Clean up vitamin name - remove duplicate "Deficiency" if present
                        const vitaminName = def.vitamin?.replace(" Deficiency Deficiency", " Deficiency") || "Unknown";
                        
                        return (
                          <div key={index} className={`deficiency_card deficiency_${riskLevel} ${isTopRisk ? 'top_priority' : ''}`}>
                            <div className="deficiency_header_static">
                              <div className="header_left">
                                <span className="vitamin_icon">{isTopRisk ? '🚨' : '🏥'}</span>
                                <span className="vitamin_name">{vitaminName}</span>
                                {isTopRisk && <span className="priority_badge">Priority #1</span>}
                              </div>
                              <div className="header_right">
                                <span className={`risk_badge risk_${riskLevel}`}>{riskLabel}</span>
                                {def.severity && <span className="severity_badge">{def.severity}</span>}
                              </div>
                            </div>
                            
                            <div className="card_content_visible">
                              {def.clinical_description && (
                                <div className="clinical_description">
                                  <span className="label">📋 Clinical Details:</span>
                                  <p>{def.clinical_description}</p>
                                </div>
                              )}

                              {def.visible_signs && def.visible_signs.length > 0 && (
                                <div className="visible_signs">
                                  <span className="label">👁️ Visible Signs:</span>
                                  <ul>
                                    {def.visible_signs.map((sign: string, signIdx: number) => (
                                      <li key={signIdx}>{sign}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {def.symptoms && (
                                <div className="deficiency_symptoms">
                                  <span className="symptoms_label">◉ Main Symptoms:</span>
                                  <p>{def.symptoms}</p>
                                </div>
                              )}

                              {def.urgency && (
                                <div className="urgency_section">
                                  <span className="label">⏰ Urgency:</span>
                                  <p>{def.urgency}</p>
                                </div>
                              )}

                              {def.complications_if_untreated && def.complications_if_untreated.length > 0 && (
                                <div className="complications_section">
                                  <span className="label">⚠️ Complications if Untreated:</span>
                                  <ul>
                                    {def.complications_if_untreated.map((comp: string, compIdx: number) => (
                                      <li key={compIdx}>{comp}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {def.recovery_timeline && (
                                <div className="recovery_section">
                                  <span className="label">📅 Recovery Timeline:</span>
                                  <p>{def.recovery_timeline}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}


                
                {/* Overall Health Score Section */}
                <div className="health_score_section">
                  <h3>❤ Overall Health Score</h3>
                  <div className="health_score_circle">
                    {/* Health score is inverse of deficiency confidence - higher deficiency = lower health */}
                    {(() => {
                      const healthScore = disease === "Normal" ? 100 : Math.max(10, 100 - (confidence || 0));
                      const ringFill = (healthScore / 100) * 339.3;
                      return (
                        <>
                          <svg className="score_ring" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="54" className="score_ring_background"></circle>
                            <circle cx="60" cy="60" r="54" className="score_ring_fill" style={{
                              strokeDasharray: `${ringFill} 339.3`,
                              stroke: healthScore >= 70 ? '#00ff2a' : healthScore >= 40 ? '#ffa500' : '#ff1900'
                            }}></circle>
                          </svg>
                          <div className="score_number" style={{
                            background: healthScore >= 70 ? '-webkit-linear-gradient(0deg, #00ff2a, #f6ff00)' : 
                                        healthScore >= 40 ? '-webkit-linear-gradient(0deg, #ffa500, #ffcc00)' : 
                                        '-webkit-linear-gradient(0deg, #ff1900, #ff6600)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                          }}>
                            {healthScore.toFixed(2)}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="health_status">
                    {(() => {
                      const healthScore = disease === "Normal" ? 100 : Math.max(10, 100 - (confidence || 0));
                      if (disease === "Normal") return "Excellent - Your skin is healthy!";
                      if (healthScore >= 70) return "Good - Minor attention needed";
                      if (healthScore >= 40) return "Fair - Needs improvement";
                      return "Poor - Immediate attention needed";
                    })()}
                  </div>
                </div>

                {/* Potential Disease Risks Section */}
                {disease !== "Normal" && geminiAnalysis && geminiAnalysis.disease_risks && geminiAnalysis.disease_risks.length > 0 && (
                  <div className="disease_risks_section">
                    <h3>⚡ Potential Disease Risks</h3>
                    <div className="risks_warning">
                      <span className="warning_icon">⚠</span>
                      <span className="warning_text">Based on detected deficiencies, you may be at risk for the following conditions:</span>
                    </div>
                    <div className="risks_list">
                      {geminiAnalysis.disease_risks.map((risk, index) => (
                        <div key={index} className={`risk_card risk_card_${index}`}>
                          <div className="risk_title">{risk.disease}</div>
                          <div className="risk_cause">
                            Due to {risk.deficiency} deficiency - {risk.risk_level}
                          </div>
                          <div className="risk_correlation">
                            {risk.correlation}% correlation
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="important_note">
                      <span className="note_icon">ⓘ</span>
                      <span className="note_text">Important:</span> These are predictions based on AI analysis. Please consult a healthcare professional for proper diagnosis and treatment.
                    </div>
                  </div>
                )}
                



                {/* Doctor Recommendation Section - Shows when health is poor */}
                {(() => {
                  const healthScore = disease === "Normal" ? 100 : Math.max(10, 100 - (confidence || 0));
                  if (healthScore < 40 && disease !== "Normal") {
                    return (
                      <div className="doctor_recommendation_section">
                        <h3>🏥 Consult a Healthcare Professional</h3>
                        <div className="doctor_alert">
                          <span className="alert_icon">⚠️</span>
                          <p>Your health score indicates a significant deficiency. We strongly recommend consulting a healthcare professional for proper diagnosis and treatment.</p>
                        </div>
                        
                        {/* Doctor Type Selection */}
                        <div className="doctor_type_tabs">
                          <button 
                            className={`doctor_tab ${selectedDoctorType === 'dermatologist' ? 'active' : ''}`}
                            onClick={() => setSelectedDoctorType(selectedDoctorType === 'dermatologist' ? null : 'dermatologist')}
                          >
                            👨‍⚕️ Dermatologists
                          </button>
                          <button 
                            className={`doctor_tab ${selectedDoctorType === 'nutritionist' ? 'active' : ''}`}
                            onClick={() => setSelectedDoctorType(selectedDoctorType === 'nutritionist' ? null : 'nutritionist')}
                          >
                            🥗 Nutritionists
                          </button>
                          <button 
                            className={`doctor_tab ${selectedDoctorType === 'physician' ? 'active' : ''}`}
                            onClick={() => setSelectedDoctorType(selectedDoctorType === 'physician' ? null : 'physician')}
                          >
                            🩺 Physicians
                          </button>
                        </div>

                        {/* Doctor Profiles */}
                        {selectedDoctorType && (
                          <div className="doctor_profiles">
                            <h4>
                              {selectedDoctorType === 'dermatologist' && '👨‍⚕️ Recommended Dermatologists'}
                              {selectedDoctorType === 'nutritionist' && '🥗 Recommended Nutritionists'}
                              {selectedDoctorType === 'physician' && '🩺 Recommended Physicians'}
                            </h4>
                            <div className="doctor_cards_grid">
                              {doctorDatabase[selectedDoctorType].map((doctor, index) => (
                                <div key={index} className="doctor_profile_card">
                                  <div className="doctor_profile_header">
                                    <div className="doctor_avatar">
                                      {doctor.image && !failedImages.has(doctor.image) ? (
                                        <img 
                                          src={doctor.image} 
                                          alt={doctor.name}
                                          onError={() => {
                                            setFailedImages(prev => new Set(prev).add(doctor.image));
                                          }}
                                        />
                                      ) : (
                                        <span className="avatar_icon">{doctorTypeIcons[selectedDoctorType]}</span>
                                      )}
                                    </div>
                                    <div className="doctor_info">
                                      <h5>{doctor.name}</h5>
                                      <span className="doctor_specialty">{doctor.specialty}</span>
                                      <div className="doctor_rating">
                                        <span className="star">⭐</span>
                                        <span>{doctor.rating}</span>
                                        <span className="experience">• {doctor.experience}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="doctor_details">
                                    <div className="detail_row">
                                      <span className="detail_icon">📍</span>
                                      <span className="detail_text">{doctor.address}</span>
                                    </div>
                                    <div className="detail_row">
                                      <span className="detail_icon">📅</span>
                                      <span className="detail_text">{doctor.availability}</span>
                                    </div>
                                    <div className="detail_row">
                                      <span className="detail_icon">💰</span>
                                      <span className="detail_text">Consultation: {doctor.fee}</span>
                                    </div>
                                  </div>
                                  <div className="doctor_actions">
                                    <a 
                                      href={doctor.practoLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="action_btn call_btn"
                                    >
                                      📅 Book on Practo
                                    </a>
                                    <a 
                                      href={`https://www.google.com/maps/search/${encodeURIComponent(doctor.address)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="action_btn directions_btn"
                                    >
                                      🗺️ Directions
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <a 
                              href={`https://www.practo.com/mumbai/${selectedDoctorType === 'nutritionist' ? 'dietitian-nutritionist' : selectedDoctorType === 'physician' ? 'general-physician' : 'dermatologist'}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="find_more_btn"
                            >
                              🔍 Find More {selectedDoctorType === 'dermatologist' ? 'Dermatologists' : selectedDoctorType === 'nutritionist' ? 'Nutritionists' : 'Physicians'} on Practo
                            </a>
                          </div>
                        )}

                        {!selectedDoctorType && (
                          <div className="doctor_types_hint">
                            <span className="hint_icon">👆</span>
                            <p>Click on a category above to see recommended doctors with their contact details</p>
                          </div>
                        )}

                        <div className="emergency_note">
                          <span className="note_icon">ℹ️</span>
                          <span>If you experience severe symptoms like excessive bleeding, extreme fatigue, or difficulty breathing, please seek immediate medical attention.</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Dietary & Lifestyle Recommendations Section */}
                {disease !== "Normal" && geminiAnalysis && geminiAnalysis.deficiencies && geminiAnalysis.deficiencies.length > 0 && (
                  <div className="recommendations_section">
                    <h2>🥗 Dietary & Lifestyle Recommendations</h2>
                    
                    <div className="recommendations_container">
                      {/* Dietary Recommendations */}
                      {geminiAnalysis.dietary_recommendations && geminiAnalysis.dietary_recommendations.length > 0 && (
                        <div className="recommendation_subsection">
                          <h3>🍽️ Dietary Recommendations</h3>
                          <div className="recommendations_list">
                            {geminiAnalysis.dietary_recommendations.map((recommendation, index) => (
                              <div key={index} className="recommendation_item">
                                <span className="checkmark">✓</span>
                                <span>{recommendation}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lifestyle Recommendations */}
                      {geminiAnalysis.lifestyle_recommendations && geminiAnalysis.lifestyle_recommendations.length > 0 && (
                        <div className="recommendation_subsection">
                          <h3>🏃 Lifestyle Recommendations</h3>
                          <div className="recommendations_list">
                            {geminiAnalysis.lifestyle_recommendations.map((recommendation, index) => (
                              <div key={index} className="recommendation_item">
                                <span className="checkmark">✓</span>
                                <span>{recommendation}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rich Food Sources */}
                    {geminiAnalysis.food_sources && (
                      geminiAnalysis.food_sources.veg?.length > 0 || 
                      geminiAnalysis.food_sources.nonVeg?.length > 0
                    ) && (
                      <div className="rich_food_sources">
                        <h3>🍎 Rich Food Sources</h3>
                        
                        {/* Vegetarian Sources */}
                        {geminiAnalysis.food_sources.veg && geminiAnalysis.food_sources.veg.length > 0 && (
                          <div className="food_category">
                            <h4 className="category_title">🌱 Vegetarian</h4>
                            <div className="food_sources_grid">
                              {geminiAnalysis.food_sources.veg.map((food, index) => (
                                <div key={index} className="food_item veg">
                                  <div className="food_icon">{food.icon}</div>
                                  <div className="food_name">{food.name}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Non-Vegetarian Sources */}
                        {geminiAnalysis.food_sources.nonVeg && geminiAnalysis.food_sources.nonVeg.length > 0 && (
                          <div className="food_category">
                            <h4 className="category_title">🍖 Non-Vegetarian</h4>
                            <div className="food_sources_grid">
                              {geminiAnalysis.food_sources.nonVeg.map((food, index) => (
                                <div key={index} className="food_item non-veg">
                                  <div className="food_icon">{food.icon}</div>
                                  <div className="food_name">{food.name}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Medicine & Supplement Recommendations Section */}
                {disease !== "Normal" && geminiAnalysis && geminiAnalysis.deficiencies && geminiAnalysis.deficiencies.length > 0 && 
                 geminiAnalysis.supplements && geminiAnalysis.supplements.length > 0 && (
                  <div className="medicine_section">
                    <h2>💊 Medicine & Supplement Recommendations</h2>

                    {/* Healthcare Provider Warning */}
                    <div className="healthcare_warning">
                      <span className="warning_icon_circle">ⓘ</span>
                      <span className="warning_message">Consult your healthcare provider before starting any supplement regimen</span>
                    </div>

                    {/* Recommended Supplements */}
                    <div className="supplements_container">
                      <h3>💉 Recommended Supplements for Age {age || "N/A"}</h3>
                      
                      {geminiAnalysis.supplements.map((supplement, index) => {
                        const ageInfo = getAgeBasedInfo(age, supplement.name, supplement.dosage);
                        return (
                          <div key={index} className="supplement_card">
                            <div className="supplement_header">
                              <span className="supplement_name">{supplement.name}</span>
                              <span className="dosage_badge">{ageInfo.adjustedDosage}</span>
                            </div>
                            {ageInfo.dosageNote && (
                              <div className="dosage_note">
                                <span className="age_group_badge">👤 {ageInfo.ageGroup}</span>
                                <span className="adjusted_note">{ageInfo.dosageNote}</span>
                              </div>
                            )}
                            <div className="supplement_description">
                              {supplement.description}
                            </div>
                            
                            {/* How to Take Instructions */}
                            <div className="how_to_take_section">
                              <div className="instruction_title">📋 How to Take:</div>
                              
                              {/* Administration Method - especially important for infants/children */}
                              {ageInfo.administrationMethod && (
                                <div className="administration_method">
                                  <span className="admin_method_text">{ageInfo.administrationMethod}</span>
                                </div>
                              )}
                              
                              <div className="instruction_grid">
                                <div className="instruction_item">
                                  <span className="instruction_icon">⏰</span>
                                  <span className="instruction_label">Timing:</span>
                                  <span className="instruction_value">{ageInfo.timingAdvice}</span>
                                </div>
                                <div className="instruction_item">
                                  <span className="instruction_icon">🍽️</span>
                                  <span className="instruction_label">With Food:</span>
                                  <span className="instruction_value">{ageInfo.foodAdvice}</span>
                                </div>
                                <div className="instruction_item">
                                  <span className="instruction_icon">📝</span>
                                  <span className="instruction_label">Instructions:</span>
                                  <span className="instruction_value">{ageInfo.specialInstructions}</span>
                                </div>
                                <div className="instruction_item precaution_item">
                                  <span className="instruction_icon">⚠️</span>
                                  <span className="instruction_label">Precautions:</span>
                                  <span className="instruction_value">{ageInfo.precautions}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="supplement_brands">
                              <span className="brands_label">Recommended Brands:</span>
                              {supplement.brands.map((brand, idx) => (
                                <span key={idx} className="brand_tag">{brand}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Suggested Timeline */}
                    <div className="timeline_container">
                      <h3>📅 Suggested Timeline</h3>
                      
                      <div className="timeline_item">
                        <div className="timeline_marker">
                          <div className="timeline_dot"></div>
                          <div className="timeline_line"></div>
                        </div>
                        <div className="timeline_content">
                          <div className="timeline_period">Week 1-2</div>
                          <div className="timeline_description">
                            Start supplements as recommended, monitor for side effects
                          </div>
                        </div>
                      </div>

                      <div className="timeline_item">
                        <div className="timeline_marker">
                          <div className="timeline_dot"></div>
                          <div className="timeline_line"></div>
                        </div>
                        <div className="timeline_content">
                          <div className="timeline_period">Week 3-4</div>
                          <div className="timeline_description">
                            Begin noticing improvements in symptoms
                          </div>
                        </div>
                      </div>

                      <div className="timeline_item">
                        <div className="timeline_marker">
                          <div className="timeline_dot"></div>
                        </div>
                        <div className="timeline_content">
                          <div className="timeline_period">{geminiAnalysis.supplements[0]?.timeline || "8-12 weeks"}</div>
                          <div className="timeline_description">
                            Schedule follow-up blood tests and health assessment
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Feedback Section */}
                {!feedbackGiven && (
                  <div className="feedback_section">
                    <h3>💬 Help Us Improve</h3>
                    <p className="feedback_intro">Was this analysis accurate? Your feedback helps improve our model's accuracy.</p>
                    
                    {!showFeedbackForm ? (
                      <div className="feedback_buttons">
                        <button 
                          className="feedback_btn feedback_yes"
                          onClick={() => handleFeedback(true)}
                          disabled={feedbackLoading}
                        >
                          👍 Yes, Accurate
                        </button>
                        <button 
                          className="feedback_btn feedback_no"
                          onClick={() => setShowFeedbackForm(true)}
                        >
                          👎 No, Incorrect
                        </button>
                      </div>
                    ) : (
                      <div className="feedback_form">
                        <textarea 
                          placeholder="Please describe what was inaccurate in the analysis..."
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          className="feedback_textarea"
                        />
                        <div className="feedback_form_buttons">
                          <button 
                            className="feedback_btn feedback_submit"
                            onClick={() => handleFeedback(false)}
                            disabled={feedbackLoading || !feedbackText.trim()}
                          >
                            {feedbackLoading ? "Submitting..." : "Submit Feedback"}
                          </button>
                          <button 
                            className="feedback_btn feedback_cancel"
                            onClick={() => setShowFeedbackForm(false)}
                            disabled={feedbackLoading}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {modelAccuracy !== null && (
                      <div className="model_accuracy">
                        <span className="accuracy_icon">📊</span>
                        <span className="accuracy_text">Model Accuracy: <strong>{modelAccuracy}%</strong></span>
                      </div>
                    )}
                  </div>
                )}

                {feedbackGiven && (
                  <div className="feedback_thank_you">
                    <span className="thank_you_icon">✨</span>
                    <span className="thank_you_text">Thank you for your feedback! It helps us improve.</span>
                  </div>
                )}

                {/* Download PDF Button */}
                <div className="new_analysis_section">
                  <button 
                    className="new_analysis_btn"
                    onClick={generateReport}
                  >
                    📄 Download PDF
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="history_modal_overlay" onClick={() => setShowHistory(false)}>
          <div className="history_modal" onClick={(e) => e.stopPropagation()}>
            <div className="history_header">
              <h2>📜 Report History</h2>
              <button className="history_close_btn" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="history_content">
              {reportHistory.length === 0 ? (
                <div className="history_empty">
                  <span>📋</span>
                  <p>No reports generated yet</p>
                  <p className="hint">Generate a report to see it here</p>
                </div>
              ) : (
                <div className="history_list">
                  {reportHistory.map((report, index) => (
                    <div key={report.id || index} className="history_item" style={{ cursor: 'pointer', position: 'relative' }}>
                      <div className="history_item_content" onClick={() => viewReportFromHistory(report)} style={{ display: 'flex', width: '100%' }}>
                        <div className="history_item_left">
                          {report.imagePreview ? (
                            <img src={report.imagePreview} alt="Analysis" className="history_thumbnail" />
                          ) : (
                            <div className="history_thumbnail_placeholder">🖼️</div>
                          )}
                        </div>
                        <div className="history_item_center">
                          <div className="history_item_name">{report.name || 'Unknown'}</div>
                          <div className="history_item_disease">
                            {report.disease === "Normal" ? "✅ Normal" : `⚠️ ${report.disease}`}
                          </div>
                          <div className="history_item_date">{report.date} at {report.time}</div>
                        </div>
                        <div className="history_item_right">
                          <div className="history_health_score" style={{
                            color: report.healthScore >= 70 ? '#00ff2a' : report.healthScore >= 40 ? '#ffa500' : '#ff1900'
                          }}>
                            {report.healthScore}
                          </div>
                          <div className="history_score_label">Health Score</div>
                          <div className="history_confidence">{report.confidence?.toFixed(0)}% confidence</div>
                        </div>
                      </div>
                      <button
                        className="history_item_delete_btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          Swal.fire({
                            title: '<span style="color:#ff1900;">Delete Report?</span>',
                            html: `<p style="color:#ffffff">Delete report for "${report.name || 'Unknown'}"?</p>`,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Yes, Delete',
                            cancelButtonText: 'Cancel',
                            background: "linear-gradient(135deg, #1e0505, #3f1e1e)",
                            color: "#ffffff",
                          }).then((result) => {
                            if (result.isConfirmed) {
                              const updatedHistory = reportHistory.filter((_, i) => i !== index);
                              setReportHistory(updatedHistory);
                              localStorage.setItem('BioNutriScanReports', JSON.stringify(updatedHistory));
                            }
                          });
                        }}
                        title="Delete this report"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {reportHistory.length > 0 && (
              <div className="history_footer">
                <button 
                  className="history_clear_btn"
                  onClick={() => {
                    Swal.fire({
                      title: '<span style="color:#ff1900;">Clear History?</span>',
                      html: '<p style="color:#ffffff">This will delete all saved reports.</p>',
                      icon: 'warning',
                      showCancelButton: true,
                      confirmButtonText: 'Yes, Clear All',
                      cancelButtonText: 'Cancel',
                      background: "linear-gradient(135deg, #1e0505, #3f1e1e)",
                      color: "#ffffff",
                    }).then((result) => {
                      if (result.isConfirmed) {
                        localStorage.removeItem('BioNutriScanReports');
                        setReportHistory([]);
                        setShowHistory(false);
                      }
                    });
                  }}
                >
                  🗑️ Clear All History
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <footer>
        <p style={{ color: "#ffffff9a" }}>
          © 2025 <span>BioNutriScan.</span> All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
