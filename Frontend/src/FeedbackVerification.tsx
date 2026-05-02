import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { db } from "./firebase";
import { ref, query, orderByChild, equalTo, get, update } from "firebase/database";

interface FeedbackEntry {
  image_hash: string;
  timestamp: string;
  is_accurate: boolean;
  feedback_text: string;
  image_path?: string;
  detected_disease: string;
  confidence: number;
  deficiencies_count: number;
  status?: "pending" | "verified" | "rejected";
}

interface FeedbackVerificationProps {
  backendURL: string;
  onBack: () => void;
}

export default function FeedbackVerification({ backendURL, onBack }: FeedbackVerificationProps) {
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackEntry | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"all" | "pending" | "verified" | "rejected">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");

  useEffect(() => {
    fetchFeedbackData();
  }, []);

  useEffect(() => {
    filterFeedback();
    // Auto-select feedback if coming from User Feedbacks tab
    const targetHash = localStorage.getItem('target_feedback_hash');
    if (targetHash && feedbackList.length > 0) {
      const target = feedbackList.find(f => f.image_hash === targetHash);
      if (target) {
        setSelectedFeedback(target);
        setSearchTerm(targetHash);
        localStorage.removeItem('target_feedback_hash');
      }
    }
  }, [feedbackList, verificationStatus, searchTerm]);

  const fetchFeedbackData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${backendURL}/get-statistics`);
      if (response.data.feedback_history_sample) {
        const historyResponse = await axios.get(`${backendURL}/get-feedback-history`);
        const feedbackData: FeedbackEntry[] = Object.entries(historyResponse.data).map(([hash, data]) => ({
          image_hash: hash,
          timestamp: (data as Record<string, unknown>).timestamp as string,
          is_accurate: (data as Record<string, unknown>).is_accurate as boolean,
          feedback_text: (data as Record<string, unknown>).feedback_text as string,
          image_path: (data as Record<string, unknown>).image_path as string | undefined,
          detected_disease: (data as Record<string, unknown>).detected_disease as string,
          confidence: (data as Record<string, unknown>).confidence as number,
          deficiencies_count: (data as Record<string, unknown>).deficiencies_count as number,
          status: ((data as Record<string, unknown>).status || "pending") as "pending" | "verified" | "rejected"
        }));
        setFeedbackList(feedbackData);
      }
    } catch (error) {
      console.error("Error fetching feedback data:", error);
      Swal.fire({
        title: "Error",
        text: "Could not fetch feedback data",
        icon: "error",
        background: "linear-gradient(135deg, #1e0505, #3f1e1e)",
        color: "#ffffff"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterFeedback = () => {
    let filtered = feedbackList;

    if (verificationStatus !== "all") {
      filtered = filtered.filter(f => f.status === verificationStatus);
    }

    if (searchTerm.trim()) {
      filtered = filtered.filter(f =>
        f.detected_disease.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.feedback_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.image_hash.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredFeedback(filtered);
  };

  const handleVerify = async (feedback: FeedbackEntry, approved: boolean) => {
    try {
      await axios.post(`${backendURL}/verify-feedback`, {
        image_hash: feedback.image_hash,
        approved: approved,
        verification_notes: verificationNotes
      });

      // Update Firebase feedback entries too
      try {
        const feedbackRef = ref(db, "feedbacks");
        const q = query(feedbackRef, orderByChild("imageHash"), equalTo(feedback.image_hash));
        const snapshot = await get(q);
        if (snapshot.exists()) {
          const updates: Record<string, unknown> = {};
          snapshot.forEach((child) => {
            updates[`feedbacks/${child.key}/verificationStatus`] = approved ? 'verified' : 'rejected';
          });
          await update(ref(db), updates);
        }
      } catch (fErr) {
        console.warn("Firebase sync failed:", fErr);
      }

      const updated: FeedbackEntry[] = feedbackList.map(f =>
        f.image_hash === feedback.image_hash
          ? { ...f, status: (approved ? "verified" : "rejected") as "pending" | "verified" | "rejected" }
          : f
      );
      setFeedbackList(updated);
      setSelectedFeedback(null);
      setVerificationNotes("");

      Swal.fire({
        title: approved ? "Verified ✓" : "Rejected ✗",
        text: `Feedback has been ${approved ? "verified" : "rejected"}`,
        icon: approved ? "success" : "warning",
        background: approved 
          ? "linear-gradient(135deg, #05051e, #1e1e3f)"
          : "linear-gradient(135deg, #1e0505, #3f1e1e)",
        color: "#ffffff"
      });
    } catch (error) {
      console.error("Error verifying feedback:", error);
      Swal.fire({
        title: "Error",
        text: "Could not verify feedback",
        icon: "error",
        background: "linear-gradient(135deg, #1e0505, #3f1e1e)",
        color: "#ffffff"
      });
    }
  };

  const handleDeleteFeedback = async (feedback: FeedbackEntry, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the item when clicking delete
    
    const result = await Swal.fire({
      title: '<span style="color:#ff1900;">Delete Feedback?</span>',
      html: `<p style="color:#ffffff">This will permanently delete this feedback entry for "${feedback.detected_disease}".</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      background: "linear-gradient(135deg, #1e0505, #3f1e1e)",
      color: "#ffffff",
    });
    
    if (result.isConfirmed) {
      try {
        await axios.delete(`${backendURL}/delete-feedback`, {
          data: { image_hash: feedback.image_hash }
        });
        
        // Remove from local state
        setFeedbackList(prev => prev.filter(f => f.image_hash !== feedback.image_hash));
        
        // Clear selection if deleted item was selected
        if (selectedFeedback?.image_hash === feedback.image_hash) {
          setSelectedFeedback(null);
        }
        
        Swal.fire({
          title: "Deleted",
          text: "Feedback entry deleted successfully",
          icon: "success",
          background: "linear-gradient(135deg, #05051e, #1e1e3f)",
          color: "#ffffff",
          timer: 1500,
          showConfirmButton: false
        });
      } catch (error) {
        console.error("Error deleting feedback:", error);
        Swal.fire({
          title: "Error",
          text: "Could not delete feedback entry",
          icon: "error",
          background: "linear-gradient(135deg, #1e0505, #3f1e1e)",
          color: "#ffffff"
        });
      }
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "verified":
        return "#00ff2a";
      case "rejected":
        return "#ff1900";
      default:
        return "#ffa500";
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "verified":
        return "✓ Verified";
      case "rejected":
        return "✗ Rejected";
      default:
        return "⏳ Pending";
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(90deg, #05051e, rgb(30, 30, 63))", padding: "20px" }}>
      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.05)",
        padding: "30px",
        borderRadius: "15px",
        border: "1px solid rgba(255,255,255,0.1)",
        marginBottom: "30px",
        backdropFilter: "blur(10px)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>
          <h1 style={{
            color: "#00ff2a",
            marginBottom: "10px",
            fontSize: "32px"
          }}>
            📋 Feedback Verification Center
          </h1>
          <p style={{ color: "#ffffffca", margin: 0 }}>
            Review and verify feedback data before it's used for model improvement
          </p>
        </div>
        <button
          onClick={onBack}
          style={{
            padding: "12px 24px",
            background: "linear-gradient(0deg, #00ff2a, #f6ff00)",
            border: "none",
            borderRadius: "10px",
            color: "#05051e",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.3s ease"
          }}
        >
          ← Back to Analysis
        </button>
      </div>

      {/* Controls */}
      <div style={{
        display: "flex",
        gap: "20px",
        marginBottom: "30px",
        flexWrap: "wrap"
      }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search by disease, hash, or feedback..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: "300px",
            padding: "12px 20px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "10px",
            color: "#ffffff",
            fontSize: "14px",
            outline: "none"
          }}
        />

        {/* Filter Buttons */}
        {(["all", "pending", "verified", "rejected"] as const).map(status => (
          <button
            key={status}
            onClick={() => setVerificationStatus(status)}
            style={{
              padding: "12px 24px",
              background: verificationStatus === status
                ? "linear-gradient(0deg, #00ff2a, #f6ff00)"
                : "rgba(255,255,255,0.05)",
              border: verificationStatus === status
                ? "1px solid #00ff2a"
                : "1px solid rgba(255,255,255,0.2)",
              borderRadius: "10px",
              color: verificationStatus === status ? "#05051e" : "#ffffff",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "14px",
              transition: "all 0.3s ease"
            }}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "20px" }}>
        {/* Feedback List */}
        <div style={{ flex: 1 }}>
          <h2 style={{ color: "#00ff2a", marginBottom: "20px" }}>
            Feedback Entries ({filteredFeedback.length})
          </h2>

          {loading ? (
            <div style={{ textAlign: "center", color: "#ffffffca", padding: "40px" }}>
              Loading feedback data...
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div style={{
              textAlign: "center",
              color: "#ffffffca",
              padding: "40px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "10px",
              border: "1px dashed rgba(255,255,255,0.2)"
            }}>
              No feedback entries found
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredFeedback.map((feedback) => (
                <div
                  key={feedback.image_hash}
                  onClick={() => setSelectedFeedback(feedback)}
                  style={{
                    padding: "16px",
                    background: selectedFeedback?.image_hash === feedback.image_hash
                      ? "rgba(0, 255, 42, 0.1)"
                      : "rgba(255,255,255,0.05)",
                    border: selectedFeedback?.image_hash === feedback.image_hash
                      ? "1px solid rgba(0, 255, 42, 0.5)"
                      : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#00ff2a", fontWeight: "600", marginBottom: "4px" }}>
                      {feedback.detected_disease}
                    </div>
                    <div style={{ color: "#ffffffaa", fontSize: "12px" }}>
                      {feedback.feedback_text ? feedback.feedback_text.substring(0, 50) + "..." : "No feedback text"}
                    </div>
                    <div style={{ color: "#ffffff88", fontSize: "11px", marginTop: "4px" }}>
                      Confidence: {feedback.confidence.toFixed(1)}% | {new Date(feedback.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      padding: "6px 12px",
                      background: getStatusColor(feedback.status),
                      color: feedback.status === "verified" ? "#05051e" : feedback.status === "rejected" ? "#ffffff" : "#05051e",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      minWidth: "90px",
                      textAlign: "center"
                    }}>
                      {getStatusLabel(feedback.status)}
                    </div>
                    <button
                      onClick={(e) => handleDeleteFeedback(feedback, e)}
                      style={{
                        padding: "6px 10px",
                        background: "rgba(255, 25, 0, 0.15)",
                        border: "1px solid rgba(255, 25, 0, 0.4)",
                        borderRadius: "6px",
                        color: "#ff1900",
                        cursor: "pointer",
                        fontSize: "14px",
                        transition: "all 0.3s ease"
                      }}
                      title="Delete this feedback"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div style={{ flex: 1 }}>
          {selectedFeedback ? (
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "15px",
              padding: "20px",
              position: "sticky",
              top: "20px"
            }}>
              <h2 style={{ color: "#00ff2a", marginBottom: "20px", marginTop: 0 }}>
                🔍 Feedback Details
              </h2>

              {/* Status */}
              <div style={{
                padding: "12px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "8px",
                marginBottom: "15px"
              }}>
                <div style={{ color: "#ffffffaa", fontSize: "12px", marginBottom: "4px" }}>Status</div>
                <div style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  background: getStatusColor(selectedFeedback.status),
                  color: selectedFeedback.status === "verified" ? "#05051e" : selectedFeedback.status === "rejected" ? "#ffffff" : "#05051e",
                  borderRadius: "6px",
                  fontWeight: "600",
                  fontSize: "13px"
                }}>
                  {getStatusLabel(selectedFeedback.status)}
                </div>
              </div>

              {/* Disease & Confidence */}
              <div style={{ marginBottom: "15px" }}>
                <div style={{ color: "#ffffffaa", fontSize: "12px", marginBottom: "4px" }}>Detected Disease</div>
                <div style={{ color: "#ffffff", fontSize: "16px", fontWeight: "600" }}>
                  {selectedFeedback.detected_disease}
                </div>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <div style={{ color: "#ffffffaa", fontSize: "12px", marginBottom: "4px" }}>AI Confidence</div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}>
                  <div style={{
                    flex: 1,
                    height: "8px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${selectedFeedback.confidence}%`,
                      background: selectedFeedback.confidence >= 70 ? "#00ff2a" : selectedFeedback.confidence >= 50 ? "#ffa500" : "#ff1900"
                    }} />
                  </div>
                  <div style={{ color: "#ffffff", fontWeight: "600", minWidth: "50px" }}>
                    {selectedFeedback.confidence.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Timestamp */}
              <div style={{ marginBottom: "15px" }}>
                <div style={{ color: "#ffffffaa", fontSize: "12px", marginBottom: "4px" }}>Timestamp</div>
                <div style={{ color: "#ffffff", fontSize: "13px" }}>
                  {new Date(selectedFeedback.timestamp).toLocaleString()}
                </div>
              </div>

              {/* Image Display */}
              {selectedFeedback.image_path && (
                <div style={{ marginBottom: "15px" }}>
                  <div style={{ color: "#ffffffaa", fontSize: "12px", marginBottom: "8px" }}>Feedback Image</div>
                  <div style={{
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: "1px solid rgba(0,255,42,0.3)",
                    height: "250px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative"
                  }}>
                    <img
                      src={(() => {
                        const pathParts = selectedFeedback.image_path.split('/');
                        const filename = pathParts[pathParts.length - 1];
                        return `${backendURL}/feedback_data/images/${filename}`;
                      })()}
                      alt="Feedback"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain"
                      }}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = "none";
                        const parent = img.parentElement;
                        if (parent) {
                          const errorText = document.createElement("div");
                          errorText.style.color = "#ff1900";
                          errorText.style.fontSize = "14px";
                          errorText.textContent = "📷 Image not found";
                          parent.appendChild(errorText);
                        }
                      }}
                    />
                  </div>
                  <div style={{
                    color: "#ffffff88",
                    fontSize: "10px",
                    marginTop: "6px",
                    wordBreak: "break-all",
                    fontFamily: "monospace"
                  }}>
                    📁 {selectedFeedback.image_path}
                  </div>
                </div>
              )}

              {/* Accuracy Assessment */}
              <div style={{ marginBottom: "15px" }}>
                <div style={{ color: "#ffffffaa", fontSize: "12px", marginBottom: "4px" }}>User Assessment</div>
                <div style={{
                  padding: "10px",
                  background: selectedFeedback.is_accurate ? "rgba(0, 255, 42, 0.1)" : "rgba(255, 25, 0, 0.1)",
                  border: `1px solid ${selectedFeedback.is_accurate ? "rgba(0, 255, 42, 0.3)" : "rgba(255, 25, 0, 0.3)"}`,
                  borderRadius: "6px",
                  color: selectedFeedback.is_accurate ? "#00ff2a" : "#ff1900",
                  fontWeight: "600",
                  textAlign: "center"
                }}>
                  {selectedFeedback.is_accurate ? "✓ User Confirmed Accurate" : "✗ User Marked Inaccurate"}
                </div>
              </div>

              {/* Feedback Text */}
              <div style={{ marginBottom: "15px" }}>
                <div style={{ color: "#ffffffaa", fontSize: "12px", marginBottom: "4px" }}>User Feedback</div>
                <div style={{
                  color: "#ffffff",
                  fontSize: "13px",
                  background: "rgba(255,255,255,0.03)",
                  padding: "12px",
                  borderRadius: "6px",
                  minHeight: "60px",
                  maxHeight: "150px",
                  overflow: "auto"
                }}>
                  {selectedFeedback.feedback_text || "(No detailed feedback provided)"}
                </div>
              </div>

              {/* Verification Notes (if not pending) */}
              {selectedFeedback.status !== "pending" ? (
                <div style={{ marginBottom: "15px" }}>
                  <div style={{ color: "#ffffffaa", fontSize: "12px", marginBottom: "4px" }}>Verification Status</div>
                  <div style={{
                    color: "#ffffff",
                    fontSize: "13px",
                    background: "rgba(255,255,255,0.03)",
                    padding: "12px",
                    borderRadius: "6px"
                  }}>
                    Already {selectedFeedback.status}
                  </div>
                </div>
              ) : (
                <>
                  {/* Verification Notes Input */}
                  <div style={{ marginBottom: "15px" }}>
                    <div style={{ color: "#ffffffaa", fontSize: "12px", marginBottom: "4px" }}>Verification Notes</div>
                    <textarea
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      placeholder="Add notes about your verification decision..."
                      style={{
                        width: "100%",
                        height: "80px",
                        padding: "10px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontFamily: "Poppins, sans-serif",
                        resize: "none",
                        outline: "none"
                      }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => handleVerify(selectedFeedback, true)}
                      style={{
                        flex: 1,
                        padding: "12px",
                        background: "linear-gradient(0deg, #00ff2a, #f6ff00)",
                        border: "none",
                        borderRadius: "8px",
                        color: "#05051e",
                        fontWeight: "600",
                        cursor: "pointer",
                        fontSize: "13px",
                        transition: "all 0.3s ease"
                      }}
                    >
                      ✓ Verify & Approve
                    </button>
                    <button
                      onClick={() => handleVerify(selectedFeedback, false)}
                      style={{
                        flex: 1,
                        padding: "12px",
                        background: "rgba(255, 25, 0, 0.2)",
                        border: "1px solid rgba(255, 25, 0, 0.5)",
                        borderRadius: "8px",
                        color: "#ff1900",
                        fontWeight: "600",
                        cursor: "pointer",
                        fontSize: "13px",
                        transition: "all 0.3s ease"
                      }}
                    >
                      ✗ Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px dashed rgba(255,255,255,0.2)",
              borderRadius: "15px",
              padding: "40px 20px",
              textAlign: "center",
              color: "#ffffffaa"
            }}>
              <span style={{ fontSize: "40px", display: "block", marginBottom: "10px" }}>📌</span>
              Select a feedback entry to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
