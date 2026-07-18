"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";

const font = "'Share Tech Mono', monospace";
const accent = "#ff6b35";
const cyan = "#00ffe7";
const green = "#39ff14";
const yellow = "#ffcc00";
const red = "#ff4455";
const purple = "#bc13fe";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Classroom {
  id: number;
  name: string | null;
  code: string;
  student_count: number;
}

interface Doc {
  id: number;
  classroom_id: number;
  original_name: string;
  gpt_status: string;
  reading_time_seconds: number;
  uploaded_at: string;
}

interface Question {
  id: number;
  text: string;
  options: string[];
  correct_answer: string;
  elo_rating: number;
  is_approved: boolean;
  teacher_analysis?: string;
}

type Difficulty = "all" | "kolay" | "orta" | "zor";

const eloLabel = (elo: number) => {
  if (elo <= 900) return { label: "KOLAY", color: green };
  if (elo <= 1100) return { label: "ORTA", color: yellow };
  return { label: "ZOR", color: red };
};

const filterByDifficulty = (items: Question[], level: Difficulty) => {
  if (level === "all") return items;
  if (level === "kolay") return items.filter(q => q.elo_rating <= 900);
  if (level === "orta") return items.filter(q => q.elo_rating > 900 && q.elo_rating <= 1100);
  return items.filter(q => q.elo_rating > 1100);
};

const gptStatusMap: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "SORULAR ÜRETİLİYOR...", color: yellow, icon: "⚡" },
  done:    { label: "GÖREV VERİLERİ HAZIR", color: green,  icon: "✓" },
  error:   { label: "SİSTEM HATASI",         color: red,    icon: "✕" },
};

export default function DocumentsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [readingTime, setReadingTime] = useState(90);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [editForm, setEditForm] = useState<{ text: string; options: string[]; correct_answer: string }>({ text: "", options: [], correct_answer: "" });
  const [selectedQIds, setSelectedQIds] = useState<Set<number>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [openAnalysisIds, setOpenAnalysisIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== "undefined"
    ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
  const headers = { Authorization: `Bearer ${token}` };

  // Sınıfları yükle
  useEffect(() => {
    axios.get<Classroom[]>(`${API}/teacher/classrooms`, { headers })
      .then(r => setClassrooms(r.data))
      .catch(() => setError("Sınıflar yüklenemedi."));
  }, []);

  // Seçilen sınıfın dokümanlarını yükle
  useEffect(() => {
    if (!selectedClassroom) return;
    setSelectedDoc(null);
    setAllQuestions([]);
    setSelectedQIds(new Set());
    axios.get<Doc[]>(`${API}/teacher/classrooms/${selectedClassroom}/documents`, { headers })
      .then(r => setDocuments(r.data))
      .catch(() => setDocuments([]));
  }, [selectedClassroom]);

  // Seçilen dokümanın tüm sorularını yükle (zorluk filtresi istemci tarafında)
  useEffect(() => {
    if (!selectedDoc) return;
    setLoadingQuestions(true);
    setSelectedQIds(new Set());
    axios.get<Question[]>(`${API}/teacher/documents/${selectedDoc.id}/questions?difficulty=all`, { headers })
      .then(r => setAllQuestions(r.data))
      .catch(() => setAllQuestions([]))
      .finally(() => setLoadingQuestions(false));
  }, [selectedDoc]);

  const questions = filterByDifficulty(allQuestions, difficulty);

  const handleUpload = async (file: File) => {
    if (!selectedClassroom) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Sadece PDF dosyaları yüklenebilir."); return; }
    setUploading(true); setError(null); setSuccess(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("reading_time_seconds", readingTime.toString());
    try {
      const uploadRes = await axios.post<Doc>(`${API}/teacher/classrooms/${selectedClassroom}/documents`, formData,
        { headers: { ...headers, "Content-Type": "multipart/form-data" } });
      setSuccess("Doküman yüklendi! GPT soruları üretiyor...");
      const res = await axios.get<Doc[]>(`${API}/teacher/classrooms/${selectedClassroom}/documents`, { headers });
      setDocuments(res.data);
      // Yüklenen dokümanı otomatik seç → soru paneli açılır
      const uploadedDoc = res.data.find(d => d.id === uploadRes.data.id) || res.data[0];
      if (uploadedDoc) setSelectedDoc(uploadedDoc);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || "Yükleme başarısız.");
    } finally { setUploading(false); }
  };

  const handleDelete = async (docId: number) => {
    if (!selectedClassroom) return;
    await axios.delete(`${API}/teacher/classrooms/${selectedClassroom}/documents/${docId}`, { headers });
    setDocuments(prev => prev.filter(d => d.id !== docId));
    if (selectedDoc?.id === docId) { setSelectedDoc(null); setAllQuestions([]); }
  };

  const openEdit = (q: Question) => {
    setEditingQ(q);
    setEditForm({ text: q.text, options: [...q.options], correct_answer: q.correct_answer });
  };

  const saveEdit = async () => {
    if (!editingQ) return;
    try {
      const res = await axios.patch<Question>(`${API}/teacher/questions/${editingQ.id}`, editForm, { headers });
      setAllQuestions(prev => prev.map(q => q.id === editingQ.id ? res.data : q));
      setEditingQ(null);
    } catch { setError("Soru güncellenemedi."); }
  };

  const toggleApprove = async (q: Question) => {
    const res = await axios.patch<Question>(`${API}/teacher/questions/${q.id}`, { is_approved: !q.is_approved }, { headers });
    setAllQuestions(prev => prev.map(x => x.id === q.id ? res.data : x));
  };

  // Toplu seçim
  const toggleSelectQ = (id: number) => {
    setSelectedQIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedQIds.size === questions.length) {
      setSelectedQIds(new Set());
    } else {
      setSelectedQIds(new Set(questions.map(q => q.id)));
    }
  };

  const bulkApprove = async () => {
    if (selectedQIds.size === 0) return;
    setBulkApproving(true);
    try {
      await Promise.all(
        Array.from(selectedQIds).map(id =>
          axios.patch(`${API}/teacher/questions/${id}`, { is_approved: true }, { headers })
        )
      );
      setAllQuestions(prev => prev.map(q => selectedQIds.has(q.id) ? { ...q, is_approved: true } : q));
      setSelectedQIds(new Set());
      setSuccess(`${selectedQIds.size} soru onaylandı!`);
    } catch { setError("Toplu onaylama başarısız."); }
    finally { setBulkApproving(false); }
  };

  const difficulties: { key: Difficulty; label: string; color: string }[] = [
    { key: "all",   label: "TÜMÜ",  color: cyan },
    { key: "kolay", label: "KOLAY", color: green },
    { key: "orta",  label: "ORTA",  color: yellow },
    { key: "zor",   label: "ZOR",   color: red },
  ];

  const toggleAnalysis = (id: number) => {
    setOpenAnalysisIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRegenerate = async () => {
    if (!selectedDoc) return;
    setRegenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await axios.post<{ gpt_status: string; question_count: number }>(
        `${API}/teacher/documents/${selectedDoc.id}/regenerate`, {}, { headers }
      );
      setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, gpt_status: res.data.gpt_status } : d));
      setSelectedDoc(prev => prev ? { ...prev, gpt_status: res.data.gpt_status } : prev);
      const qRes = await axios.get<Question[]>(
        `${API}/teacher/documents/${selectedDoc.id}/questions?difficulty=all`, { headers }
      );
      setAllQuestions(qRes.data);
      if (res.data.question_count > 0) {
        setSuccess(`${res.data.question_count} soru üretildi!`);
      } else {
        setError("Sorular üretilemedi. PDF metni okunamıyor olabilir.");
      }
    } catch {
      setError("Sorular yeniden üretilemedi.");
    } finally {
      setRegenerating(false);
    }
  };

  // İstatistikler (tüm sorular üzerinden)
  const approvedCount = allQuestions.filter(q => q.is_approved).length;
  const easyCount = allQuestions.filter(q => q.elo_rating <= 900).length;
  const mediumCount = allQuestions.filter(q => q.elo_rating > 900 && q.elo_rating <= 1100).length;
  const hardCount = allQuestions.filter(q => q.elo_rating > 1100).length;

  return (
    <div style={{ fontFamily: font, color: "#fff", minHeight: "100vh", padding: "40px 44px" }}>

      {/* Sayfa Başlığı */}
      <div style={{ marginBottom: "36px", borderBottom: "1px solid rgba(255,107,53,0.08)", paddingBottom: "24px" }}>
        <h1 style={{ color: accent, fontSize: "20px", letterSpacing: "6px", margin: "0 0 6px", textShadow: `0 0 20px ${accent}44` }}>
          GÖREV MATERYALLERİ
        </h1>
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", letterSpacing: "2px", margin: 0 }}>
          SINIF SEÇ → PDF YÜKLE → SORULARI DÜZENLE VE ONAYLA
        </p>
      </div>

      {/* ADIM 1: Sınıf Seçimi */}
      <div style={{ marginBottom: "36px" }}>
        <p style={{ color: "rgba(255,255,255,0.18)", fontSize: "9px", letterSpacing: "3px", margin: "0 0 14px" }}>
          ADIM 01 — SINIF SEÇ
        </p>
        {classrooms.length === 0 ? (
          <div style={{ padding: "24px", border: "1px solid rgba(255,107,53,0.1)", background: "rgba(255,107,53,0.02)", textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", letterSpacing: "2px", margin: 0 }}>
              Size atanmış sınıf bulunamadı. Admin panelinden sınıf ataması yapılmalı.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {classrooms.map(c => {
              const active = selectedClassroom === c.id;
              return (
                <button key={c.id} id={`classroom-card-${c.id}`}
                  onClick={() => setSelectedClassroom(c.id)}
                  style={{
                    padding: "20px 28px", cursor: "pointer", fontFamily: font,
                    background: active ? "rgba(255,107,53,0.1)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${active ? accent : "rgba(255,255,255,0.08)"}`,
                    borderLeft: `3px solid ${active ? accent : "rgba(255,255,255,0.08)"}`,
                    boxShadow: active ? `0 0 20px ${accent}22` : "none",
                    transition: "all 0.2s", textAlign: "left",
                  }}>
                  <p style={{ margin: "0 0 4px", color: active ? accent : "rgba(255,255,255,0.6)", fontSize: "13px", letterSpacing: "2px" }}>
                    {c.code}
                  </p>
                  {c.name && c.name !== c.code && (
                    <p style={{ margin: "0 0 8px", color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "1px" }}>{c.name}</p>
                  )}
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.2)", fontSize: "9px", letterSpacing: "1px" }}>
                    {c.student_count} ÖĞRENCİ
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ADIM 2 + 3: Sınıf seçildikten sonra */}
      {selectedClassroom && (
        <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

          {/* Sol: Yükleme + Doküman Listesi */}
          <div style={{ flex: "0 0 380px" }}>
            <p style={{ color: "rgba(255,255,255,0.18)", fontSize: "9px", letterSpacing: "3px", margin: "0 0 14px" }}>
              ADIM 02 — MATERYAL YÜKLE
            </p>

            {/* Okuma Süresi */}
            <div style={{ marginBottom: "14px", display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <p style={{ margin: "0 0 2px", color: "rgba(255,255,255,0.25)", fontSize: "8px", letterSpacing: "2px" }}>TAHMİNİ OKUMA SÜRESİ</p>
                <p style={{ margin: 0, color: cyan, fontSize: "9px", letterSpacing: "1px" }}>
                  Öğrenci bu süre boyunca hikayeyi okur, sonra sorular gelir
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
                <input
                  type="number" min={10} max={600} value={readingTime}
                  onChange={e => setReadingTime(Number(e.target.value))}
                  style={{
                    width: "64px", background: "rgba(0,255,231,0.06)",
                    border: "1px solid rgba(0,255,231,0.2)", color: cyan,
                    padding: "6px 10px", fontFamily: font, fontSize: "14px",
                    textAlign: "center", outline: "none",
                  }}
                />
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>sn</span>
              </div>
            </div>

            {/* Drag & Drop */}
            <div
              id="upload-zone"
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `1px dashed ${dragOver ? cyan : "rgba(255,255,255,0.1)"}`,
                background: dragOver ? "rgba(0,255,231,0.04)" : "rgba(255,255,255,0.01)",
                padding: "36px", textAlign: "center", cursor: uploading ? "not-allowed" : "pointer",
                transition: "all 0.25s", marginBottom: "20px",
              }}>
              <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
              <div style={{ fontSize: "28px", marginBottom: "10px", color: uploading ? yellow : cyan }}>
                {uploading ? "⚡" : "⬆"}
              </div>
              <p style={{ color: uploading ? yellow : "rgba(255,255,255,0.35)", fontSize: "10px", letterSpacing: "2px", margin: "0 0 4px" }}>
                {uploading ? "MATERYAL YÜKLENİYOR... GPT 30 SORU ÜRETİYOR..." : "PDF DOSYASINI SÜRÜKLE VEYA TIKLA"}
              </p>
              <p style={{ color: "rgba(255,255,255,0.12)", fontSize: "8px", letterSpacing: "1px", margin: 0 }}>
                Yalnızca PDF · 30 soru otomatik üretilir (10 kolay · 10 orta · 10 zor)
              </p>
            </div>

            {success && <div style={{ border: `1px solid ${green}44`, background: `${green}08`, padding: "10px 14px", marginBottom: "14px", color: green, fontSize: "10px", letterSpacing: "1px" }}>✓ {success}</div>}
            {error && <div style={{ border: `1px solid ${red}44`, background: `${red}08`, padding: "10px 14px", marginBottom: "14px", color: red, fontSize: "10px", letterSpacing: "1px" }}>⚠ {error}</div>}

            {/* Doküman listesi */}
            <p style={{ color: "rgba(255,255,255,0.18)", fontSize: "9px", letterSpacing: "3px", margin: "0 0 10px" }}>
              YÜKLÜ MATERYALLER ({documents.length})
            </p>
            {documents.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", letterSpacing: "1px" }}>Bu sınıf için henüz materyal yok.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {documents.map(doc => {
                  const st = gptStatusMap[doc.gpt_status] || gptStatusMap.error;
                  const isSelected = selectedDoc?.id === doc.id;
                  return (
                    <div key={doc.id} style={{
                      padding: "14px 18px", cursor: "pointer",
                      background: isSelected ? "rgba(255,107,53,0.06)" : "rgba(255,255,255,0.01)",
                      border: isSelected ? `1px solid ${accent}44` : "1px solid rgba(255,255,255,0.04)",
                      borderLeft: `2px solid ${isSelected ? accent : st.color}`,
                      transition: "all 0.2s",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setSelectedDoc(isSelected ? null : doc)}>
                          <p style={{ margin: "0 0 4px", color: "#fff", fontSize: "11px", letterSpacing: "1px" }}>
                            📄 {doc.original_name}
                          </p>
                          <span style={{ color: st.color, fontSize: "8px", letterSpacing: "2px" }}>
                            {st.icon} {st.label}
                          </span>
                          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "8px", letterSpacing: "1px", marginLeft: "10px" }}>
                            ⏱ {doc.reading_time_seconds}sn okuma
                          </span>
                        </div>
                        <button id={`delete-doc-${doc.id}`}
                          onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                          style={{ background: "transparent", border: `1px solid ${red}33`, color: `${red}88`, padding: "4px 10px", fontSize: "9px", cursor: "pointer", fontFamily: font, letterSpacing: "1px" }}>
                          SİL
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sağ: Sorular Paneli */}
          <div style={{ flex: 1, borderLeft: "1px solid rgba(255,255,255,0.05)", paddingLeft: "24px", minWidth: 0 }}>
            {!selectedDoc ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <p style={{ color: "rgba(255,255,255,0.1)", fontSize: "11px", letterSpacing: "3px" }}>
                  ← BİR MATERYAL SEÇ
                </p>
                <p style={{ color: "rgba(255,255,255,0.07)", fontSize: "9px", letterSpacing: "2px", marginTop: "8px" }}>
                  PDF yükleyince GPT 30 soru üretir ve burada görünür
                </p>
              </div>
            ) : (
              <>
                {/* Panel Başlığı + İstatistikler */}
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                    <div>
                      <p style={{ color: "rgba(255,255,255,0.18)", fontSize: "9px", letterSpacing: "3px", margin: "0 0 4px" }}>
                        ADIM 03 — SORULARI İNCELE VE DÜZENLE
                      </p>
                      <p style={{ color: accent, fontSize: "12px", letterSpacing: "2px", margin: 0 }}>
                        {selectedDoc.original_name}
                      </p>
                    </div>
                    {/* Zorluk filtresi — Uzman seçeneği YOK */}
                    <div style={{ display: "flex", gap: "6px" }}>
                      {difficulties.map(d => (
                        <button key={d.key} onClick={() => setDifficulty(d.key)} style={{
                          background: difficulty === d.key ? `${d.color}18` : "transparent",
                          border: `1px solid ${difficulty === d.key ? d.color : "rgba(255,255,255,0.08)"}`,
                          color: difficulty === d.key ? d.color : "rgba(255,255,255,0.3)",
                          padding: "5px 14px", fontSize: "8px", letterSpacing: "2px",
                          cursor: "pointer", fontFamily: font, transition: "all 0.2s",
                        }}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* İstatistik çubuğu */}
                  {allQuestions.length > 0 && (
                    <div style={{ display: "flex", gap: "16px", padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap" }}>
                      <span style={{ color: green, fontSize: "9px", letterSpacing: "1px" }}>
                        ✓ {approvedCount}/{allQuestions.length} ONAYLANDI
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "9px" }}>|</span>
                      <span style={{ color: green, fontSize: "9px" }}>🟢 {easyCount} KOLAY</span>
                      <span style={{ color: yellow, fontSize: "9px" }}>🟡 {mediumCount} ORTA</span>
                      <span style={{ color: red, fontSize: "9px" }}>🔴 {hardCount} ZOR</span>
                    </div>
                  )}
                </div>

                {/* Toplu Seçim + Onayla Araç Çubuğu */}
                {questions.length > 0 && !loadingQuestions && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", padding: "10px 14px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    {/* Hepsini Seç checkbox */}
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
                      <div
                        onClick={toggleSelectAll}
                        style={{
                          width: "14px", height: "14px",
                          border: `1px solid ${selectedQIds.size === questions.length ? cyan : "rgba(255,255,255,0.25)"}`,
                          background: selectedQIds.size === questions.length ? `${cyan}22` : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        {selectedQIds.size === questions.length && (
                          <span style={{ color: cyan, fontSize: "10px", lineHeight: 1 }}>✓</span>
                        )}
                      </div>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", letterSpacing: "1px" }}>
                        HEPSİNİ SEÇ ({questions.length})
                      </span>
                    </label>

                    {selectedQIds.size > 0 && (
                      <>
                        <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "9px" }}>—</span>
                        <span style={{ color: cyan, fontSize: "9px", letterSpacing: "1px" }}>
                          {selectedQIds.size} SORU SEÇİLDİ
                        </span>
                        <button
                          id="bulk-approve-btn"
                          onClick={bulkApprove}
                          disabled={bulkApproving}
                          style={{
                            marginLeft: "auto",
                            background: bulkApproving ? "rgba(57,255,20,0.05)" : `${green}18`,
                            border: `1px solid ${green}`,
                            color: green, padding: "5px 18px", fontSize: "9px", letterSpacing: "2px",
                            cursor: bulkApproving ? "not-allowed" : "pointer", fontFamily: font,
                          }}
                        >
                          {bulkApproving ? "ONAYLANIYOR..." : `SEÇİLENLERİ ONAYLA (${selectedQIds.size})`}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {loadingQuestions ? (
                  <p style={{ color: yellow, fontSize: "10px", letterSpacing: "3px" }}>⚡ SORULAR YÜKLENİYOR...</p>
                ) : allQuestions.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", border: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                    <p style={{ color: selectedDoc.gpt_status === "error" ? red : "rgba(255,255,255,0.2)", fontSize: "11px", letterSpacing: "2px", margin: "0 0 12px" }}>
                      {selectedDoc.gpt_status === "error"
                        ? "Soru üretimi başarısız. GPT bağlantısı veya PDF metni sorunu olabilir."
                        : selectedDoc.gpt_status === "pending"
                          ? "Sorular üretiliyor, lütfen bekleyin..."
                          : "Bu doküman için henüz soru üretilmedi."}
                    </p>
                    {selectedDoc.gpt_status !== "pending" && (
                      <button
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        style={{
                          background: `${cyan}18`, border: `1px solid ${cyan}`, color: cyan,
                          padding: "8px 20px", fontSize: "9px", letterSpacing: "2px",
                          cursor: regenerating ? "not-allowed" : "pointer", fontFamily: font,
                        }}
                      >
                        {regenerating ? "ÜRETİLİYOR..." : "SORULARI YENİDEN ÜRET"}
                      </button>
                    )}
                  </div>
                ) : questions.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", border: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                    <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "11px", letterSpacing: "2px", margin: 0 }}>
                      Bu zorluk seviyesinde soru bulunamadı.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {questions.map((q, i) => {
                      const diff = eloLabel(q.elo_rating);
                      const isEditing = editingQ?.id === q.id;
                      const isSelected = selectedQIds.has(q.id);
                      return (
                        <div key={q.id} style={{
                          padding: "20px 24px",
                          background: isSelected ? "rgba(0,255,231,0.03)" : "rgba(255,255,255,0.015)",
                          border: `1px solid ${isSelected ? cyan + "44" : "rgba(255,255,255,0.06)"}`,
                          borderLeft: `2px solid ${isSelected ? cyan : diff.color}`,
                          transition: "all 0.2s",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                              {/* Checkbox */}
                              <div
                                onClick={() => toggleSelectQ(q.id)}
                                style={{
                                  width: "14px", height: "14px", flexShrink: 0,
                                  border: `1px solid ${isSelected ? cyan : "rgba(255,255,255,0.2)"}`,
                                  background: isSelected ? `${cyan}22` : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  cursor: "pointer",
                                }}
                              >
                                {isSelected && <span style={{ color: cyan, fontSize: "10px", lineHeight: 1 }}>✓</span>}
                              </div>
                              <div>
                                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "8px", letterSpacing: "2px" }}>
                                  SORU {i + 1} ·{" "}
                                </span>
                                <span style={{ color: diff.color, fontSize: "8px", letterSpacing: "2px", border: `1px solid ${diff.color}33`, padding: "1px 8px" }}>
                                  {diff.label}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                              <button
                                onClick={() => isEditing ? setEditingQ(null) : openEdit(q)}
                                style={{ background: isEditing ? "rgba(188,19,254,0.1)" : "transparent", border: `1px solid ${isEditing ? purple : "rgba(255,255,255,0.12)"}`, color: isEditing ? purple : "rgba(255,255,255,0.4)", padding: "4px 12px", fontSize: "8px", letterSpacing: "1px", cursor: "pointer", fontFamily: font }}>
                                {isEditing ? "İPTAL" : "DÜZENLE"}
                              </button>
                              <button
                                id={`approve-btn-${q.id}`}
                                onClick={() => toggleApprove(q)}
                                style={{ background: q.is_approved ? "rgba(57,255,20,0.08)" : "transparent", border: `1px solid ${q.is_approved ? green : "rgba(255,255,255,0.1)"}`, color: q.is_approved ? green : "rgba(255,255,255,0.3)", padding: "4px 12px", fontSize: "8px", letterSpacing: "1px", cursor: "pointer", fontFamily: font }}>
                                {q.is_approved ? "ONAYLANDI ✓" : "ONAYLA"}
                              </button>
                            </div>
                          </div>

                          {isEditing ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                              <textarea
                                value={editForm.text}
                                onChange={e => setEditForm(prev => ({ ...prev, text: e.target.value }))}
                                rows={3}
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", padding: "10px", fontFamily: font, fontSize: "11px", resize: "vertical", outline: "none" }}
                              />
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {editForm.options.map((opt, oi) => (
                                  <div key={oi} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px", width: "16px" }}>{String.fromCharCode(65 + oi)}.</span>
                                    <input value={opt}
                                      onChange={e => {
                                        const opts = [...editForm.options];
                                        opts[oi] = e.target.value;
                                        setEditForm(prev => ({ ...prev, options: opts }));
                                      }}
                                      style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid ${editForm.correct_answer === opt ? green + "88" : "rgba(255,255,255,0.08)"}`, color: "#fff", padding: "7px 10px", fontFamily: font, fontSize: "11px", outline: "none" }}
                                    />
                                    <button onClick={() => setEditForm(prev => ({ ...prev, correct_answer: opt }))}
                                      style={{ background: editForm.correct_answer === opt ? `${green}18` : "transparent", border: `1px solid ${editForm.correct_answer === opt ? green : "rgba(255,255,255,0.08)"}`, color: editForm.correct_answer === opt ? green : "rgba(255,255,255,0.3)", padding: "4px 10px", fontSize: "8px", cursor: "pointer", fontFamily: font, letterSpacing: "1px", whiteSpace: "nowrap" }}>
                                      {editForm.correct_answer === opt ? "✓ DOĞRU" : "DOĞRU YAP"}
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button onClick={saveEdit}
                                style={{ alignSelf: "flex-end", background: cyan, border: "none", color: "#000", padding: "8px 24px", fontFamily: font, fontSize: "10px", letterSpacing: "2px", cursor: "pointer", fontWeight: "bold" }}>
                                KAYDET →
                              </button>
                            </div>
                          ) : (
                            <>
                              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "12px", lineHeight: 1.6, margin: "0 0 14px" }}>
                                {q.text}
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {q.options.map((opt, oi) => {
                                  const isCorrect = opt === q.correct_answer;
                                  return (
                                    <div key={oi} style={{
                                      display: "flex", alignItems: "center", gap: "10px",
                                      padding: "8px 12px",
                                      background: isCorrect ? `${green}08` : "rgba(255,255,255,0.01)",
                                      border: `1px solid ${isCorrect ? green + "44" : "rgba(255,255,255,0.04)"}`,
                                    }}>
                                      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "9px", width: "16px", flexShrink: 0 }}>
                                        {String.fromCharCode(65 + oi)}.
                                      </span>
                                      <span style={{ color: isCorrect ? green : "rgba(255,255,255,0.55)", fontSize: "11px", flex: 1 }}>
                                        {opt}
                                      </span>
                                      {isCorrect && <span style={{ color: green, fontSize: "9px", letterSpacing: "1px" }}>✓ DOĞRU CEVAP</span>}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Öğretmen Analizi Accordion */}
                              {q.teacher_analysis && (
                                <div style={{ marginTop: "14px" }}>
                                  <button
                                    onClick={() => toggleAnalysis(q.id)}
                                    style={{
                                      display: "flex", alignItems: "center", gap: "8px",
                                      background: "transparent",
                                      border: `1px solid rgba(255,204,0,0.2)`,
                                      color: yellow, padding: "5px 14px",
                                      fontSize: "8px", letterSpacing: "2px",
                                      cursor: "pointer", fontFamily: font,
                                      transition: "all 0.2s",
                                    }}
                                  >
                                    <span style={{ transition: "transform 0.2s", display: "inline-block", transform: openAnalysisIds.has(q.id) ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                                    ÖĞRETMEN ANALİZİ
                                  </button>
                                  {openAnalysisIds.has(q.id) && (
                                    <div style={{
                                      marginTop: "8px",
                                      padding: "14px 16px",
                                      background: "rgba(255,204,0,0.04)",
                                      border: `1px solid rgba(255,204,0,0.15)`,
                                      borderLeft: `3px solid ${yellow}`,
                                    }}>
                                      <p style={{ margin: 0, color: "rgba(255,220,100,0.85)", fontSize: "11px", lineHeight: 1.7, letterSpacing: "0.3px" }}>
                                        {q.teacher_analysis}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
