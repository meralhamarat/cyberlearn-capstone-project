"use client";

import { useState, useEffect } from "react";
import axios from "axios";

const font = "'Share Tech Mono', monospace";
const accent = "#ff6b35";

interface Classroom {
  id: number;
  name: string | null;
  code: string;
}

interface Question {
  id: number;
  text: string;
  options: string[];
  correct_answer: string;
  elo_rating: number;
  is_approved: boolean;
  document_id: number | null;
  created_at: string;
}

function EloLabel({ elo }: { elo: number }) {
  const label =
    elo <= 900 ? { text: "KOLAY", color: "#39ff14" } :
    elo <= 1100 ? { text: "ORTA", color: "#ffcc00" } :
    elo <= 1300 ? { text: "ZOR", color: "#ff6b35" } :
    { text: "UZMAN", color: "#ff4455" };

  return (
    <span style={{
      color: label.color, fontSize: "8px", letterSpacing: "2px",
      border: `1px solid ${label.color}33`, padding: "2px 8px",
      background: `${label.color}08`,
    }}>
      {label.text} · ELO {elo}
    </span>
  );
}

export default function QuestionsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);
  const [pending, setPending] = useState<Question[]>([]);
  const [approved, setApproved] = useState<Question[]>([]);
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const token = typeof window !== "undefined"
    ? localStorage.getItem("token") || localStorage.getItem("access_token")
    : null;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get<Classroom[]>("http://localhost:8000/teacher/classrooms", { headers });
        setClassrooms(res.data);
        if (res.data.length > 0) setSelectedClassroom(res.data[0].id);
      } catch {
        setMessage({ type: "err", text: "Sınıflar yüklenemedi." });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedClassroom) return;
    const load = async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          axios.get<Question[]>(`http://localhost:8000/teacher/classrooms/${selectedClassroom}/questions/pending`, { headers }),
          axios.get<Question[]>(`http://localhost:8000/teacher/classrooms/${selectedClassroom}/questions/approved`, { headers }),
        ]);
        setPending(pRes.data);
        setApproved(aRes.data);
      } catch {
        setPending([]);
        setApproved([]);
      }
    };
    load();
  }, [selectedClassroom]);

  const handleApprove = async (qId: number) => {
    setActionLoading(qId);
    setMessage(null);
    try {
      await axios.post(`http://localhost:8000/teacher/questions/${qId}/approve`, {}, { headers });
      const q = pending.find((p) => p.id === qId);
      if (q) {
        setPending((prev) => prev.filter((p) => p.id !== qId));
        setApproved((prev) => [{ ...q, is_approved: true }, ...prev]);
      }
      setMessage({ type: "ok", text: "Soru onaylandı ve öğrenci haritasına eklendi." });
    } catch {
      setMessage({ type: "err", text: "Onaylama başarısız." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (qId: number) => {
    setActionLoading(qId);
    setMessage(null);
    try {
      await axios.delete(`http://localhost:8000/teacher/questions/${qId}`, { headers });
      setPending((prev) => prev.filter((p) => p.id !== qId));
      setMessage({ type: "ok", text: "Soru reddedildi ve silindi." });
    } catch {
      setMessage({ type: "err", text: "Silme başarısız." });
    } finally {
      setActionLoading(null);
    }
  };

  const displayList = tab === "pending" ? pending : approved;

  if (loading) {
    return (
      <div style={{ padding: "60px", fontFamily: font, color: accent }}>
        <p style={{ letterSpacing: "3px" }}>SORULAR YÜKLENİYOR...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px 44px", fontFamily: font, color: "#fff", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: "36px", borderBottom: "1px solid rgba(255,107,53,0.08)", paddingBottom: "24px" }}>
        <h1 style={{ color: accent, fontSize: "20px", letterSpacing: "6px", margin: "0 0 6px", textShadow: `0 0 20px ${accent}44` }}>
          SORU YÖNETİMİ
        </h1>
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", letterSpacing: "2px", margin: 0 }}>
          GPT'nin ürettiği soruları incele → onayla veya reddet
        </p>
      </div>

      {/* Sınıf seçici */}
      {classrooms.length > 1 && (
        <div style={{ marginBottom: "28px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {classrooms.map((c) => (
            <button
              key={c.id}
              id={`cls-tab-${c.id}`}
              onClick={() => setSelectedClassroom(c.id)}
              style={{
                background: selectedClassroom === c.id ? "rgba(255,107,53,0.1)" : "transparent",
                border: `1px solid ${selectedClassroom === c.id ? accent : "rgba(255,255,255,0.1)"}`,
                color: selectedClassroom === c.id ? accent : "rgba(255,255,255,0.4)",
                padding: "8px 20px", fontSize: "10px", letterSpacing: "2px",
                cursor: "pointer", fontFamily: font, transition: "all 0.2s",
              }}
            >
              {c.name || c.code}
            </button>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "28px" }}>
        {([
          { key: "pending" as const, label: `ONAY BEKLİYEN (${pending.length})` },
          { key: "approved" as const, label: `ONAYLANAN (${approved.length})` },
        ]).map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{
              background: "transparent", border: "none",
              borderBottom: tab === t.key ? `1px solid ${accent}` : "1px solid transparent",
              color: tab === t.key ? accent : "rgba(255,255,255,0.25)",
              padding: "10px 24px", fontSize: "10px", letterSpacing: "2px",
              cursor: "pointer", fontFamily: font, transition: "all 0.2s",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bildirim */}
      {message && (
        <div style={{
          border: `1px solid ${message.type === "ok" ? "rgba(57,255,20,0.3)" : "rgba(255,68,85,0.3)"}`,
          background: message.type === "ok" ? "rgba(57,255,20,0.04)" : "rgba(255,68,85,0.04)",
          padding: "12px 16px", marginBottom: "20px",
          color: message.type === "ok" ? "#39ff14" : "#ff4455",
          fontSize: "11px", letterSpacing: "1px",
        }}>
          {message.type === "ok" ? "✓" : "⚠"} {message.text}
        </div>
      )}

      {/* Soru listesi */}
      {displayList.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px", letterSpacing: "2px" }}>
            {tab === "pending"
              ? "Onay bekleyen soru yok. Dokümanlar sekmesinden PDF yükleyin."
              : "Henüz onaylanmış soru yok."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {displayList.map((q, idx) => (
            <div
              key={q.id}
              id={`question-card-${q.id}`}
              style={{
                background: "rgba(255,255,255,0.01)",
                border: tab === "pending"
                  ? "1px solid rgba(255,204,0,0.1)"
                  : "1px solid rgba(57,255,20,0.1)",
                borderLeft: tab === "pending"
                  ? "2px solid #ffcc00"
                  : "2px solid #39ff14",
                padding: "20px 24px",
              }}
            >
              {/* Soru başlığı */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "9px", letterSpacing: "2px" }}>
                      S-{String(idx + 1).padStart(2, "0")}
                    </span>
                    <EloLabel elo={q.elo_rating} />
                  </div>
                  <p style={{ margin: 0, color: "#fff", fontSize: "13px", lineHeight: 1.6, letterSpacing: "0.5px" }}>
                    {q.text}
                  </p>
                </div>

                {/* Aksiyon butonları (sadece pending için) */}
                {tab === "pending" && (
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    <button
                      id={`approve-${q.id}`}
                      onClick={() => handleApprove(q.id)}
                      disabled={actionLoading === q.id}
                      style={{
                        background: "rgba(57,255,20,0.08)",
                        border: "1px solid rgba(57,255,20,0.3)",
                        color: "#39ff14",
                        padding: "8px 18px",
                        fontSize: "10px", letterSpacing: "2px",
                        cursor: actionLoading === q.id ? "not-allowed" : "pointer",
                        fontFamily: font, transition: "all 0.2s",
                        opacity: actionLoading === q.id ? 0.5 : 1,
                      }}
                    >
                      ✓ ONAYLA
                    </button>
                    <button
                      id={`reject-${q.id}`}
                      onClick={() => handleReject(q.id)}
                      disabled={actionLoading === q.id}
                      style={{
                        background: "rgba(255,68,85,0.06)",
                        border: "1px solid rgba(255,68,85,0.2)",
                        color: "#ff4455",
                        padding: "8px 18px",
                        fontSize: "10px", letterSpacing: "2px",
                        cursor: actionLoading === q.id ? "not-allowed" : "pointer",
                        fontFamily: font, transition: "all 0.2s",
                        opacity: actionLoading === q.id ? 0.5 : 1,
                      }}
                    >
                      ✕ REDDET
                    </button>
                  </div>
                )}
              </div>

              {/* Şıklar */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {q.options.map((opt, i) => {
                  const isCorrect = opt === q.correct_answer;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        background: isCorrect ? "rgba(57,255,20,0.05)" : "rgba(255,255,255,0.02)",
                        border: isCorrect ? "1px solid rgba(57,255,20,0.3)" : "1px solid rgba(255,255,255,0.05)",
                        fontSize: "11px",
                        color: isCorrect ? "#39ff14" : "rgba(255,255,255,0.5)",
                        letterSpacing: "0.5px",
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                      }}
                    >
                      <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <span>{opt}</span>
                      {isCorrect && <span style={{ marginLeft: "auto", flexShrink: 0 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
