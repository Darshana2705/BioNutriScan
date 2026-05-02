import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";

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
}

export default function FeedbackVerification({ backendURL }: FeedbackVerificationProps) {
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

      const updated: FeedbackEntry[] = feedbackList.map(f =>
        f.image_hash === feedback.image_hash
          ? { ...f, status: (approved ? "verified" : "rejected") as "pending" | "verified" | "rejected" }
          : f
      );
      setFeedbackList(updated);
      setSelectedFeedback(null);
      setVerificationNotes("");

      Swal.fire({
        title: approved ? "✓ Verified" : "✗ Rejected",
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a1a 0%, #16213e 50%, #0f3460 100%)", padding: "20px" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, rgba(0,255,42,0.1), rgba(100,200,255,0.05))",
        padding: "40px 30px",
        borderRadius: "20px",
        border: "2px solid rgba(0,255,42,0.2)",
        marginBottom: "40px",
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,255,42,0.1)"
      }}>
        <h1 style={{
          color: "#00ff2a",
          marginBottom: "10px",
          fontSize: "36px",
          fontWeight: "700",
          textShadow: "0 0 20px rgba(0,255,42,0.5)"
        }}>
          📋 Feedback Verification Center
        </h1>
        <p style={{ color: "#b0b8ff", margin: 0, fontSize: "16px" }}>
          Review, verify, and approve user feedback to improve AI model accuracy
        </p>
      </div>

      {/* Controls Bar */}
      <div style={{
        display: "flex",
        gap: "15px",
        marginBottom: "30px",
        flexWrap: "wrap",
        alignItems: "center"
      }}>
        {/* Search Input */}
        <input
          type="text"
          placeholder="🔍 Search by disease, hash, or feedback..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: "1",
            minWidth: "300px",
            padding: "14px 20px",
            background: "rgba(255,255,255,0.08)",
            border: "2px solid rgba(0,255,42,0.3)",
            borderRadius: "12px",
            color: "#ffffff",
            fontSize: "14px",
            outline: "none",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(0,255,42,0.6)";
            e.currentTarget.style.background = "rgba(255,255,255,0.12)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(0,255,42,0.3)";
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          }}
        />

        {/* Filter Buttons */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {(["all", "pending", "verified", "rejected"] as const).map(status => (
            <button
              key={status}
              onClick={() => setVerificationStatus(status)}
              style={{
                padding: "12px 20px",
                background: verificationStatus === status
                  ? "linear-gradient(135deg, #00ff2a, #00cc22)"
                  : "rgba(255,255,255,0.08)",
                border: verificationStatus === status
                  ? "2px solid #00ff2a"
                  : "2px solid rgba(255,255,255,0.2)",
                borderRadius: "10px",
                color: verificationStatus === status ? "#000000" : "#ffffff",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px",
                transition: "all 0.3s ease",
                boxShadow: verificationStatus === status ? "0 0 15px rgba(0,255,42,0.4)" : "none"
              }}
              onMouseOver={(e) => {
                if (verificationStatus !== status) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                }
              }}
              onMouseOut={(e) => {
                if (verificationStatus !== status) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }
              }}
            >
              {status === "all" && "📊 All"}
              {status === "pending" && "⏳ Pending"}
              {status === "verified" && "✓ Verified"}
              {status === "rejected" && "✗ Rejected"}
              {` (${feedbackList.filter(f => status === "all" ? true : f.status === status).length})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "25px", minHeight: "600px" }}>
        {/* Left Panel - Feedback List */}
        <div style={{ flex: "0 0 380px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ color: "#00ff2a", marginBottom: "20px", marginTop: 0, fontSize: "20px" }}>
            📝 Feedback Entries
          </h2>

          {loading ? (
            <div style={{ textAlign: "center", color: "#ffffffaa", padding: "40px 20px" }}>
              ⏳ Loading feedback data...
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div style={{
              textAlign: "center",
              color: "#ffffffaa",
              padding: "40px 20px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "12px",
              border: "2px dashed rgba(255,255,255,0.2)"
            }}>
              📭 No feedback entries found
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflow: "auto", paddingRight: "10px" }}>
              {filteredFeedback.map((feedback) => (
                <div
                  key={feedback.image_hash}
                  onClick={() => setSelectedFeedback(feedback)}
                  style={{
                    padding: "16px",
                    background: selectedFeedback?.image_hash === feedback.image_hash
                      ? "linear-gradient(135deg, rgba(0, 255, 42, 0.15), rgba(0, 200, 255, 0.1))"
                      : "rgba(255,255,255,0.06)",
                    border: selectedFeedback?.image_hash === feedback.image_hash
                      ? "2px solid rgba(0, 255, 42, 0.6)"
                      : "2px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: selectedFeedback?.image_hash === feedback.image_hash 
                      ? "0 0 20px rgba(0, 255, 42, 0.2)" 
                      : "none"
                  }}
                  onMouseOver={(e) => {
                    if (selectedFeedback?.image_hash !== feedback.image_hash) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.borderColor = "rgba(0, 255, 42, 0.3)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedFeedback?.image_hash !== feedback.image_hash) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                    }
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#00ff2a", fontWeight: "700", marginBottom: "6px", fontSize: "14px" }}>
                      {feedback.detected_disease}
                    </div>
                    <div style={{ color: "#b0b8ff", fontSize: "12px", marginBottom: "4px" }}>
                      {feedback.feedback_text ? feedback.feedback_text.substring(0, 45) + "..." : "No feedback"}
                    </div>
                    <div style={{ color: "#ffffff88", fontSize: "11px", display: "flex", gap: "10px" }}>
                      <span>📊 {feedback.confidence.toFixed(1)}%</span>
                      <span>📅 {new Date(feedback.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div style={{
                    padding: "6px 12px",
                    background: getStatusColor(feedback.status),
                    color: feedback.status === "verified" ? "#05051e" : feedback.status === "rejected" ? "#ffffff" : "#05051e",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: "700",
                    minWidth: "80px",
                    textAlign: "center",
                    marginLeft: "10px"
                  }}>
                    {getStatusLabel(feedback.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel - Details */}
        <div style={{ flex: 1 }}>
          {selectedFeedback ? (
            <div style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(100,200,255,0.05))",
              border: "2px solid rgba(0,255,42,0.2)",
              borderRadius: "16px",
              padding: "30px",
              position: "sticky",
              top: "20px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
            }}>
              <h2 style={{ color: "#00ff2a", marginBottom: "25px", marginTop: 0, fontSize: "22px" }}>
                🔍 Feedback Details
              </h2>

              {/* Status */}
              <div style={{
                padding: "16px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: "12px",
                marginBottom: "20px",
                border: "1px solid rgba(0,255,42,0.2)"
              }}>
                <div style={{ color: "#b0b8ff", fontSize: "12px", marginBottom: "8px", fontWeight: "600" }}>🏷️ Status</div>
                <div style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  background: getStatusColor(selectedFeedback.status),
                  color: selectedFeedback.status === "verified" ? "#05051e" : selectedFeedback.status === "rejected" ? "#ffffff" : "#05051e",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "14px"
                }}>
                  {getStatusLabel(selectedFeedback.status)}
                </div>
              </div>

              {/* Disease & Confidence */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ color: "#b0b8ff", fontSize: "12px", marginBottom: "8px", fontWeight: "600" }}>🏥 Detected Disease</div>
                <div style={{ color: "#ffffff", fontSize: "18px", fontWeight: "700" }}>
                  {selectedFeedback.detected_disease}
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ color: "#b0b8ff", fontSize: "12px", marginBottom: "8px", fontWeight: "600" }}>📊 AI Confidence</div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}>
                  <div style={{
                    flex: 1,
                    height: "10px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "5px",
                    overflow: "hidden",
                    border: "1px solid rgba(0,255,42,0.2)"
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${selectedFeedback.confidence}%`,
                      background: selectedFeedback.confidence >= 75 
                        ? "linear-gradient(90deg, #00ff2a, #00cc22)" 
                        : selectedFeedback.confidence >= 50 
                        ? "#ffa500" 
                        : "#ff1900"
                    }} />
                  </div>
                  <div style={{ color: "#ffffff", fontWeight: "700", minWidth: "60px", textAlign: "right", fontSize: "14px" }}>
                    {selectedFeedback.confidence.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Timestamp */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ color: "#b0b8ff", fontSize: "12px", marginBottom: "8px", fontWeight: "600" }}>📅 Timestamp</div>
                <div style={{ color: "#ffffff", fontSize: "13px" }}>
                  {new Date(selectedFeedback.timestamp).toLocaleString()}
                </div>
              </div>

              {/* Image Display */}
              {selectedFeedback.image_path && (
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ color: "#b0b8ff", fontSize: "12px", marginBottom: "10px", fontWeight: "600" }}>📷 Feedback Image</div>
                  <div style={{
                    background: "rgba(0,0,0,0.4)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "2px solid rgba(0,255,42,0.3)",
                    height: "280px",
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
                          errorText.style.color = "#ff6b6b";
                          errorText.style.fontSize = "14px";
                          errorText.textContent = "📷 Unable to load image";
                          parent.appendChild(errorText);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* User Assessment */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ color: "#b0b8ff", fontSize: "12px", marginBottom: "8px", fontWeight: "600" }}>👤 User Assessment</div>
                <div style={{
                  padding: "12px",
                  background: selectedFeedback.is_accurate ? "rgba(0, 255, 42, 0.15)" : "rgba(255, 25, 0, 0.15)",
                  border: `2px solid ${selectedFeedback.is_accurate ? "rgba(0, 255, 42, 0.4)" : "rgba(255, 25, 0, 0.4)"}`,
                  borderRadius: "10px",
                  color: selectedFeedback.is_accurate ? "#00ff2a" : "#ff6b6b",
                  fontWeight: "700",
                  textAlign: "center"
                }}>
                  {selectedFeedback.is_accurate ? "✓ User Confirmed Accurate" : "✗ User Marked Inaccurate"}
                </div>
              </div>

              {/* Feedback Text */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ color: "#b0b8ff", fontSize: "12px", marginBottom: "8px", fontWeight: "600" }}>💬 User Feedback</div>
                <div style={{
                  color: "#ffffff",
                  fontSize: "14px",
                  background: "rgba(255,255,255,0.04)",
                  padding: "14px",
                  borderRadius: "10px",
                  minHeight: "70px",
                  maxHeight: "150px",
                  overflow: "auto",
                  border: "1px solid rgba(0,255,42,0.2)"
                }}>
                  {selectedFeedback.feedback_text || "(No detailed feedback provided)"}
                </div>
              </div>

              {/* Action Buttons */}
              {selectedFeedback.status !== "pending" ? (
                <div style={{
                  padding: "14px",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: "10px",
                  border: "1px solid rgba(0,255,42,0.2)",
                  textAlign: "center",
                  color: "#b0b8ff"
                }}>
                  ✓ Already {selectedFeedback.status.toUpperCase()}
                </div>
              ) : (
                <>
                  {/* Notes Input */}
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ color: "#b0b8ff", fontSize: "12px", marginBottom: "8px", fontWeight: "600" }}>📝 Verification Notes</div>
                    <textarea
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      placeholder="Add notes about your verification decision..."
                      style={{
                        width: "100%",
                        height: "90px",
                        padding: "12px",
                        background: "rgba(255,255,255,0.04)",
                        border: "2px solid rgba(0,255,42,0.2)",
                        borderRadius: "10px",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontFamily: "Poppins, sans-serif",
                        resize: "none",
                        outline: "none",
                        transition: "all 0.3s ease"
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "rgba(0,255,42,0.5)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(0,255,42,0.2)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => handleVerify(selectedFeedback, true)}
                      style={{
                        flex: 1,
                        padding: "14px",
                        background: "linear-gradient(135deg, #00ff2a, #00cc22)",
                        border: "none",
                        borderRadius: "10px",
                        color: "#000000",
                        fontWeight: "700",
                        cursor: "pointer",
                        fontSize: "14px",
                        transition: "all 0.3s ease",
                        boxShadow: "0 4px 15px rgba(0,255,42,0.3)"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,255,42,0.5)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,255,42,0.3)";
                      }}
                    >
                      ✓ Verify & Approve
                    </button>
                    <button
                      onClick={() => handleVerify(selectedFeedback, false)}
                      style={{
                        flex: 1,
                        padding: "14px",
                        background: "rgba(255, 25, 0, 0.2)",
                        border: "2px solid rgba(255, 25, 0, 0.5)",
                        borderRadius: "10px",
                        color: "#ff6b6b",
                        fontWeight: "700",
                        cursor: "pointer",
                        fontSize: "14px",
                        transition: "all 0.3s ease"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "rgba(255, 25, 0, 0.3)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "rgba(255, 25, 0, 0.2)";
                        e.currentTarget.style.transform = "translateY(0)";
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
              background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(100,200,255,0.05))",
              border: "2px dashed rgba(0,255,42,0.3)",
              borderRadius: "16px",
              padding: "60px 40px",
              textAlign: "center",
              color: "#b0b8ff"
            }}>
              <span style={{ fontSize: "50px", display: "block", marginBottom: "15px" }}>👈</span>
              <div style={{ fontSize: "16px" }}>Select a feedback entry to view details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
