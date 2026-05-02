import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { ref, onValue, get, remove } from "firebase/database";
import Swal from "sweetalert2";
import "./AdminPanel.css";
import FeedbackVerification from "./FeedbackVerification";

interface AnalysisRecord {
  id: string;
  name: string;
  age: string;
  date: string;
  time?: string;
  disease: string;
  confidence: number;
  healthScore: number;
  imageUrl?: string;
  timestamp: number;
  geminiAnalysis?: any;
}

interface UserFeedback {
  userId: string;
  userName: string;
  isAccurate: boolean;
  feedbackText: string;
  disease: string;
  timestamp: number;
  imageHash?: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
}

interface AppSettings {
  backendURL: string;
  adminPassword?: string;
  maintenanceMode: boolean;
  modelConfidenceThreshold: number;
}

export default function AdminPanel({ onExit }: { onExit: () => void }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "analyses" | "feedbacks" | "verification">("dashboard");
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedURL = localStorage.getItem('backendURL') || "http://localhost:5000";
    return {
      backendURL: savedURL,
      maintenanceMode: false,
      modelConfidenceThreshold: 0.7
    };
  });

  // Fetch backend URL from dynamic config
  useEffect(() => {
    const fetchBackendURL = async () => {
      try {
        const response = await fetch("/backend_url.txt");
        if (response.ok) {
          const fetchedURL = (await response.text()).trim();
          if (fetchedURL) {
            setSettings(prev => ({ ...prev, backendURL: fetchedURL }));
            localStorage.setItem("backendURL", fetchedURL);
          }
        }
      } catch (err) {
        console.warn("ℹ️ Could not fetch backend discovery file:", err);
      }
    };
    fetchBackendURL();
  }, []);

  // Check storage for auth session
  useEffect(() => {
    const isAuth = sessionStorage.getItem("adminAuth") === "true";
    if (isAuth) setIsAuthenticated(true);
  }, []);

  // Fetch Analyses
  useEffect(() => {
    if (isAuthenticated) {
      const analysesRef = ref(db, "analyses");
      const unsubscribe = onValue(analysesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const list = Object.values(data) as AnalysisRecord[];
          setAnalyses(list.sort((a, b) => b.timestamp - a.timestamp));
        }
      });
      return () => unsubscribe();
    }
  }, [isAuthenticated]);

  // Fetch Feedbacks
  useEffect(() => {
    if (isAuthenticated) {
      const fbRef = ref(db, "feedbacks");
      const unsubscribe = onValue(fbRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const list = Object.values(data) as UserFeedback[];
          setFeedbacks(list.sort((a, b) => b.timestamp - a.timestamp));
        }
      });
      return () => unsubscribe();
    }
  }, [isAuthenticated]);

  // Fetch Settings from Firebase
  useEffect(() => {
    if (isAuthenticated) {
      const settingsRef = ref(db, "app_settings");
      get(settingsRef).then((snap) => {
        if (snap.exists()) setSettings(snap.val());
      });
    }
  }, [isAuthenticated]);

  const normalizeConfidence = (val: number): string => {
    if (!val) return "0.0";
    let normalized = val;
    // Handle 9500 -> 95.0
    if (val > 100) normalized = val / 100; 
    // Handle 0.95 -> 95.0
    else if (val <= 1 && val > 0) normalized = val * 100; 
    // Already in 0-100 range, keep it
    return normalized.toFixed(1);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Fetch admin password from database
      const settingsRef = ref(db, "app_settings/adminPassword");
      const snapshot = await get(settingsRef);
      
      if (!snapshot.exists()) {
        Swal.fire("System Error", "Admin password not configured in database. Contact system administrator.", "error");
        return;
      }

      const dbPassword = snapshot.val();

      if (passwordInput === dbPassword) {
        setIsAuthenticated(true);
        sessionStorage.setItem("adminAuth", "true");
      } else {
        Swal.fire("Error", "Invalid Password", "error");
      }
    } catch (err) {
      console.error("Auth error:", err);
      Swal.fire("Error", "Authentication failed. Check connection.", "error");
    }
  };

  /* 
  const handleSaveSettings = async () => {
    try {
      await set(ref(db, "app_settings"), settings);
      localStorage.setItem('backendURL', settings.backendURL);
      Swal.fire("Success", "Settings updated globally", "success");
    } catch (err) {
      Swal.fire("Error", "Failed to save settings", "error");
    }
  };
  */

  const deleteAnalysis = async (id: string) => {
    const result = await Swal.fire({
      title: "Delete Analysis?",
      text: "This will permanently remove this record from the database.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ff4444",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      background: "#05051e",
      color: "#fff"
    });

    if (result.isConfirmed) {
      try {
        const analysisRef = ref(db, `analyses/${id}`);
        await remove(analysisRef);
        Swal.fire("Deleted!", "Record has been removed.", "success");
      } catch (err) {
        Swal.fire("Error", "Failed to delete record.", "error");
      }
    }
  };

  const deleteFeedback = async (id: string) => {
    const result = await Swal.fire({
      title: "Delete Feedback?",
      text: "This will permanently remove this feedback from the database.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ff4444",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      background: "#05051e",
      color: "#fff"
    });

    if (result.isConfirmed) {
      try {
        const feedbackRef = ref(db, `feedbacks/${id}`);
        await remove(feedbackRef);
        Swal.fire("Deleted!", "Feedback has been removed.", "success");
      } catch (err) {
        Swal.fire("Error", "Failed to delete feedback.", "error");
      }
    }
  };

  const viewReportFromHistory = (report: AnalysisRecord) => {
    const currentConf = parseFloat(normalizeConfidence(report.confidence));
    const healthScore = report.disease === "Normal" ? 100 : Math.max(10, 100 - currentConf);
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
      <p style="margin-top: 10px;">Generated on ${report.date} at ${report.time || ''}</p>
    </div>

    <!-- Patient Information with Image -->
    <div class="section">
      <h2>👤 Patient Information</h2>
      <div class="patient-image-section">
        ${report.imageUrl ? `
        <div class="patient-image-container">
          <img src="${report.imageUrl}" alt="Analyzed Skin Image" class="patient-image" />
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
      <div style="font-size: 14px; color: #666;">Confidence Level: ${normalizeConfidence(report.confidence)}%</div>
      <div class="confidence-bar">
        <div class="confidence-fill" style="width: ${normalizeConfidence(report.confidence)}%"></div>
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
  };

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ width: '100%', maxWidth: '400px' }}>
          <div className="admin-logo" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '2rem'
          }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              background: '#00ff2a', 
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#05051e',
              fontWeight: '900',
              fontSize: '1.4rem'
            }}>B</div>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>BioNutriScan</span>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Admin Portal</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Please enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
             <center><label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem'}}>Security Password</label></center> 
              <input 
                type="password" 
                className="form-input" 
                value={passwordInput} 
                onChange={e => setPasswordInput(e.target.value)} 
                placeholder="••••••••"
                style={{ 
                  width: '100%', 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '0.8rem 1rem',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '1rem',
                  textAlign: 'center',
                }}
              />
            </div>
            <button 
              type="submit" 
              className="btn-save" 
              style={{ 
                width: '100%', 
                padding: '0.9rem', 
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>Verify & Login</span>
            </button>
            <button 
              type="button" 
              onClick={onExit} 
              style={{ 
                background: 'transparent', 
                color: 'rgba(255,255,255,0.5)', 
                border: 'none', 
                width: '100%', 
                padding: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'color 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.color = 'white'}
              onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >
              Back to Home
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* Analysis Preview Modal */}
      {selectedRecord && (
        <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
          <div className="preview-modal" onClick={e => e.stopPropagation()}>
            <button className="preview-close" onClick={() => setSelectedRecord(null)}>✕</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', padding: '2.5rem' }}>
              <div className="preview-left">
                <img 
                  src={selectedRecord.imageUrl} 
                  alt="Patient" 
                  style={{
                    width: '100%', aspectRatio: '1/1', objectFit: 'cover',
                    borderRadius: '20px', border: '3px solid #00ff2a', boxShadow: '0 20px 40px rgba(0,255,42,0.15)'
                  }}
                />
                <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <button 
                    className="btn-save"
                    style={{ width: '100%', padding: '1rem', background: '#00ff2a', color: '#05051e' }}
                    onClick={() => {
                      viewReportFromHistory(selectedRecord);
                    }}
                  >
                    📄 Generate PDF Report
                  </button>
                  <button 
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer' }}
                    onClick={() => setSelectedRecord(null)}
                  >
                    Close Preview
                  </button>
                </div>
              </div>

              <div className="preview-right">
                <div style={{ marginBottom: '1.5rem' }}>
                  <span style={{ color: '#00ff2a', fontWeight: '600', letterSpacing: '2px', fontSize: '0.8rem' }}>PATIENT DOSSIER</span>
                  <h2 style={{ fontSize: '2.2rem', marginTop: '0.5rem' }}>{selectedRecord.name}</h2>
                  <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '-0.2rem' }}>Analysis ID: <span style={{ color: 'white', opacity: 1 }}>#{selectedRecord.id}</span></p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Clinical Diagnosis</label>
                    <span style={{ color: '#ffab00', fontWeight: '600', fontSize: '1.1rem' }}>{selectedRecord.disease?.replace(" Deficiency", "")}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Confidence Score</label>
                    <span style={{ color: '#00ff2a', fontWeight: '600', fontSize: '1.1rem' }}>
                      {normalizeConfidence(selectedRecord.confidence)}%
                    </span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Patient Age</label>
                    <span style={{ color: '#fff', fontWeight: '600', fontSize: '1.1rem' }}>{selectedRecord.age} Years</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Record Date</label>
                    <span style={{ color: '#fff', fontWeight: '600', fontSize: '1.1rem' }}>{selectedRecord.date}</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(0, 255, 42, 0.05)', padding: '1.5rem', borderRadius: '15px', border: '1px border-dashed rgba(0, 255, 42, 0.2)' }}>
                  <h4 style={{ color: '#00ff2a', marginBottom: '0.8rem', fontSize: '0.9rem' }}>Clinical Health Score</h4>
                  <div style={{ height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <div style={{ width: `${selectedRecord.healthScore}%`, height: '100%', background: 'linear-gradient(90deg, #ff4444, #ffab00, #00ff2a)', transition: 'width 1.5s ease' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                    <span>Critical</span>
                    <span style={{ color: 'white', fontWeight: 'bold' }}>{selectedRecord.healthScore}/100</span>
                    <span>Optimal</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-logo" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          padding: '1.5rem 1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          marginBottom: '1.5rem'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            background: '#00ff2a', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#05051e',
            fontWeight: '900',
            fontSize: '1.2rem'
          }}>B</div>
          <span style={{ fontSize: '1.1rem', letterSpacing: '0.5px' }}>BioNutri<span style={{ color: '#00ff2a' }}>Scan</span></span>
        </div>

        <nav className="admin-nav" style={{ flex: 1, padding: '0 1.5rem' }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', padding: '0 0 0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Menu</div>
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <span className="nav-icon">📊</span> Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'analyses' ? 'active' : ''}`} onClick={() => setActiveTab('analyses')}>
            <span className="nav-icon">🦠</span> Database
          </button>
          <button className={`nav-item ${activeTab === 'feedbacks' ? 'active' : ''}`} onClick={() => setActiveTab('feedbacks')}>
            <span className="nav-icon">💬</span> Feedbacks
          </button>
          <button className={`nav-item ${activeTab === 'verification' ? 'active' : ''}`} onClick={() => setActiveTab('verification')}>
            <span className="nav-icon">📋</span> Verification
          </button>
        </nav>

        <div className="sidebar-footer" style={{ 
          marginTop: 'auto', 
          padding: '1.5rem 1.5rem',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem'
        }}>
          <button className="nav-item" onClick={onExit} style={{ 
            background: 'rgba(0, 255, 42, 0.05)', 
            color: '#00ff2a',
            border: '1px solid rgba(0, 255, 42, 0.1)'
          }}>
            <span className="nav-icon">🏠</span> Client View
          </button>
          <button className="nav-item logout-btn" onClick={async () => {
            const result = await Swal.fire({
              title: 'Logout?',
              text: "Are you sure you want to end your session?",
              icon: 'warning',
              showCancelButton: true,
              confirmButtonColor: '#ff4444',
              cancelButtonColor: '#3085d6',
              confirmButtonText: 'Yes, Logout',
              background: '#05051e',
              color: '#fff'
            });
            if (result.isConfirmed) {
              sessionStorage.clear();
              setIsAuthenticated(false);
            }
          }} style={{ 
            color: '#ff4444',
            background: 'rgba(255, 68, 68, 0.05)',
            border: '1px solid rgba(255, 68, 68, 0.1)'
          }}>
            <span className="nav-icon">🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {activeTab === 'dashboard' && (
          <div className="dashboard-content">
            <div className="page-header">
              <h1>Admin Dashboard</h1>
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>Real-time overview of clinical deficiency analyses and system performance.</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card modern">
                <div className="stat-icon">📊</div>
                <div className="stat-info">
                  <div className="stat-title">Total Analyses</div>
                  <div className="stat-value">{analyses.length}</div>
                  <div className="stat-trend positive">+12% from last week</div>
                </div>
              </div>
              
              <div className="stat-card modern">
                <div className="stat-icon">❤️</div>
                <div className="stat-info">
                  <div className="stat-title">Avg Health Score</div>
                  <div className="stat-value">
                    {(analyses.reduce((acc, curr) => acc + curr.healthScore, 0) / (analyses.length || 1)).toFixed(1)}
                  </div>
                  <div className="stat-trend">Standard clinical range</div>
                </div>
              </div>

              <div className="stat-card modern">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <div className="stat-title">Verified Claims</div>
                  <div className="stat-value">
                    {feedbacks.filter(f => f.verificationStatus === 'verified').length}
                  </div>
                  <div className="stat-trend negative">
                    {feedbacks.filter(f => !f.isAccurate && !f.verificationStatus).length} pending review
                  </div>
                </div>
              </div>

              <div className="stat-card modern">
                <div className="stat-icon">⚡</div>
                <div className="stat-info">
                  <div className="stat-title">System Status</div>
                  <div className="stat-value" style={{ color: '#00ff2a' }}>Online</div>
                  <div className="stat-trend">API Latency: 42ms</div>
                </div>
              </div>
            </div>
            
            <div className="dashboard-sections">
              <div className="dashboard-main-section">
                <div className="section-header">
                  <h3>Recent Analysis Activity</h3>
                  <button className="btn-text" onClick={() => setActiveTab('analyses')}>View All →</button>
                </div>
                <div className="data-table-container modern">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Analysis ID</th>
                        <th>Patient</th>
                        <th>Diagnosis</th>
                        <th>Confidence</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyses.slice(0, 6).map(record => (
                        <tr key={record.id}>
                          <td style={{ fontSize: '0.8rem', opacity: 0.6 }}>#{record.id}</td>
                          <td style={{ fontWeight: '500' }}>{record.name} <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>({record.age})</span></td>
                          <td>
                            <span className={`badge ${record.disease === 'Normal' ? 'badge-success' : 'badge-warning'}`}>
                              {record.disease?.replace(" Deficiency", "")}
                            </span>
                          </td>
                          <td>
                            <div className="mini-confidence">
                              <div className="mini-bar-bg">
                                <div className="mini-bar-fill" style={{ width: `${normalizeConfidence(record.confidence)}%` }}></div>
                              </div>
                              <span style={{ fontSize: '0.75rem', marginLeft: '5px' }}>{normalizeConfidence(record.confidence)}%</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.8rem', opacity: 0.6 }}>{record.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="dashboard-side-section">
                <div className="section-header">
                  <h3>Clinical Distribution</h3>
                </div>
                <div className="distribution-card">
                  {['Vitamin D', 'Vitamin B12', 'Iron', 'Normal'].map(type => {
                    const count = analyses.filter(a => a.disease?.includes(type)).length;
                    const percent = analyses.length > 0 ? (count / analyses.length) * 100 : 0;
                    return (
                      <div key={type} className="dist-item">
                        <div className="dist-label">
                          <span>{type}</span>
                          <span>{percent.toFixed(0)}%</span>
                        </div>
                        <div className="dist-progress-bg">
                          <div className="dist-progress-fill" style={{ width: `${percent}%`, background: type === 'Normal' ? '#00ff2a' : '#ffab00' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analyses' && (
          <>
            <div className="page-header">
              <h1>Database Records</h1>
              <p>All stored vitamin deficiency analyses.</p>
            </div>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Analysis ID</th>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Age</th>
                    <th>Confidence</th>
                    <th>Health Score</th>
                    <th>Diagnosis</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map(record => (
                    <tr key={record.id}>
                      <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>#{record.id}</td>
                      <td>
                        {record.imageUrl ? (
                          <img 
                            src={record.imageUrl} 
                            className="thumbnail" 
                            alt="analysis" 
                            style={{ cursor: 'pointer', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}
                            onClick={() => setSelectedRecord(record)}
                          />
                        ) : 'No-Image'}
                      </td>
                      <td>{record.name}</td>
                      <td>{record.age}</td>
                      <td>{normalizeConfidence(record.confidence)}%</td>
                      <td>{record.healthScore}</td>
                      <td><span className={`badge ${record.disease === 'Normal' ? 'badge-success' : 'badge-warning'}`}>{record.disease?.replace(" Deficiency Deficiency", " Deficiency")}</span></td>
                      <td>{record.date} {record.time}</td>
                      <td style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn-view"
                          onClick={() => viewReportFromHistory(record)}
                        >
                          View Report
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => deleteAnalysis(record.id)}
                          title="Delete Analysis"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {analyses.length === 0 && <div style={{ padding: '2rem', textAlign: 'center' }}>No Analyses found.</div>}
            </div>
          </>
        )}

        {activeTab === 'feedbacks' && (
          <>
            <div className="page-header">
              <h1>User Feedbacks</h1>
              <p>Clinical accuracy reports from users.</p>
            </div>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Accuracy</th>
                    <th>Feedback Message</th>
                    <th>Diagnosis</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map((fb, idx) => (
                    <tr key={idx}>
                      <td>{fb.userName}</td>
                      <td>
                        {fb.isAccurate ? (
                          <span className="badge badge-success">✅ Accurate</span>
                        ) : fb.verificationStatus === 'verified' ? (
                          <span className="badge badge-success">✅ Verified Inaccurate</span>
                        ) : fb.verificationStatus === 'rejected' ? (
                          <span className="badge badge-danger">❌ Rejected Claim</span>
                        ) : (
                          <button 
                            className="btn-view" 
                            style={{ 
                              fontSize: '0.7rem', 
                              padding: '6px 12px',
                              background: 'rgba(255, 171, 0, 0.1)',
                              color: '#ffab00',
                              border: '1px solid #ffab00'
                            }}
                            onClick={() => {
                              setActiveTab('verification');
                              if (fb.imageHash) {
                                localStorage.setItem('target_feedback_hash', fb.imageHash);
                              }
                            }}
                          >
                            ⚠️ Verify Claim
                          </button>
                        )}
                      </td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'normal' }}>{fb.feedbackText || 'No comment'}</td>
                      <td>{fb.disease}</td>
                      <td>{new Date(fb.timestamp).toLocaleDateString()}</td>
                      <td>
                        <button 
                          className="btn-delete"
                          onClick={() => deleteFeedback(fb.timestamp.toString())}
                          title="Delete Feedback"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {feedbacks.length === 0 && <div style={{ padding: '2rem', textAlign: 'center' }}>No Feedback found.</div>}
            </div>
          </>
        )}

        {activeTab === 'verification' && (
          <FeedbackVerification 
            backendURL={settings.backendURL} 
            onBack={() => setActiveTab('dashboard')} 
          />
        )}
      </main>
    </div>
  );
}
