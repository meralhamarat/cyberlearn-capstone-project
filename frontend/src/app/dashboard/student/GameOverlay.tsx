"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";

const font = "'Share Tech Mono', monospace";
const NEON = "#c8ff00";       // Neon sarı-yeşil (Pinterest referansı)
// const NEON_DIM = "#c8ff0022"; // reserved for future use
const CYAN = "#00ffe7";
const RED = "#ff4455";
const GREEN = "#39ff14";
const ORANGE = "#ff6b35";

// ── Yardımcı: Zorluk etiketi
function eloLabel(elo: number): { label: string; color: string; badge: string } {
  if (elo <= 900) return { label: "KOLAY", color: GREEN, badge: "🟢" };
  if (elo <= 1100) return { label: "ORTA", color: "#ffcc00", badge: "🟡" };
  return { label: "ZOR", color: RED, badge: "🔴" };
}

interface Question {
  id: number;
  text: string;
  options: string[];
  elo_rating: number;
}

interface Mission {
  id: number;
  title: string;
  reading_time_seconds: number;
  story_text: string | null;
  questions: Question[];
}

interface AnswerResult {
  correct: boolean;
  correct_answer: string;
  old_elo: number;
  new_elo: number;
  delta: number;
  hint_used: boolean;
  time_message: string | null;
  consecutive_failures: number;
  motivation_triggered: boolean;
}

interface GameOverlayProps {
  mission: Mission;
  token: string;
  onClose: () => void;
  onComplete: (totalDelta: number) => void;
}

// ────────────────────────────────────────────────────────────────
// CyberpunkBox: Pinterest'ten ilham alan neon çerçeve animasyonu
// ────────────────────────────────────────────────────────────────
function CyberpunkBox({
  children,
  show,
  color = NEON,
  width = 480,
}: {
  children: React.ReactNode;
  show: boolean;
  color?: string;
  width?: number;
}) {
  return (
    <div style={{ position: "relative", width, fontFamily: font }}>
      {/* SVG Cyberpunk Çerçeve */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 10,
        }}
        viewBox="0 0 480 520"
        preserveAspectRatio="none"
      >
        {/* Izgara arka planı */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={`${color}15`} strokeWidth="0.5" />
          </pattern>
          <pattern id="gridcross" width="40" height="40" patternUnits="userSpaceOnUse">
            <text x="20" y="24" fill={`${color}20`} fontSize="8" textAnchor="middle" fontFamily="monospace">×</text>
          </pattern>
          {/* Glow filtresi */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="480" height="520" fill="url(#grid)" />
        <rect width="480" height="520" fill="url(#gridcross)" />

        {/* Ana köşe braketleri — Pinterest'teki gibi köşelerden büyüyen */}
        {/* SOL ÜST köşe */}
        <motion.path
          d="M 60 20 L 20 20 L 20 60"
          fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="square"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.0, ease: "easeOut" }}
        />
        {/* SAĞ ÜST köşe */}
        <motion.path
          d="M 420 20 L 460 20 L 460 60"
          fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="square"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        />
        {/* SOL ALT köşe */}
        <motion.path
          d="M 20 460 L 20 500 L 60 500"
          fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="square"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        />
        {/* SAĞ ALT köşe */}
        <motion.path
          d="M 460 460 L 460 500 L 420 500"
          fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="square"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
        />

        {/* Sol kenar — aşağı uzuyor */}
        <motion.line
          x1="20" y1="60" x2="20" y2="460"
          stroke={color} strokeWidth="2" filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        />
        {/* Sağ kenar */}
        <motion.line
          x1="460" y1="60" x2="460" y2="460"
          stroke={color} strokeWidth="2" filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
        />
        {/* Üst kenar */}
        <motion.line
          x1="60" y1="20" x2="420" y2="20"
          stroke={color} strokeWidth="2" filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
        />
        {/* Alt kenar */}
        <motion.line
          x1="60" y1="500" x2="420" y2="500"
          stroke={color} strokeWidth="2" filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
        />

        {/* Üst dekoratif: noktalı çizgi + logo kutusu */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={show ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.3, delay: 0.7 }}
        >
          {/* Üst noktalı çizgiler */}
          <line x1="70" y1="20" x2="200" y2="20" stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <line x1="280" y1="20" x2="410" y2="20" stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          {/* Üst merkez logo kutusu */}
          <rect x="215" y="10" width="50" height="20" fill="#0a0a0f" stroke={color} strokeWidth="1.5" />
          <text x="240" y="25" fill={color} fontSize="10" textAnchor="middle" fontFamily="monospace" fontWeight="bold">▣</text>
          {/* Alt noktalı çizgiler */}
          <line x1="70" y1="500" x2="200" y2="500" stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <line x1="280" y1="500" x2="410" y2="500" stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          {/* Sol kenar içi dekorasyon */}
          <path d="M 20 200 L 10 215 L 20 230" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
          <path d="M 20 290 L 10 305 L 20 320" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
          {/* Sağ kenar içi dekorasyon */}
          <path d="M 460 200 L 470 215 L 460 230" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
          <path d="M 460 290 L 470 305 L 460 320" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
        </motion.g>
      </svg>

      {/* İçerik alanı */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={show ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, delay: 0.75 }}
        style={{
          position: "relative",
          zIndex: 5,
          margin: "20px",
          padding: "28px",
          background: "rgba(6, 6, 8, 0.97)",
          minHeight: "480px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ── HP Çubuğu
function HpBar({
  label, value, maxValue, color, showPercent = false,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  showPercent?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / maxValue) * 100));
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "8px", letterSpacing: "2px" }}>{label}</span>
        <span style={{ color, fontSize: "9px", letterSpacing: "1px", fontVariantNumeric: "tabular-nums" }}>
          {showPercent ? `${Math.round(pct)}%` : `${value} HP`}
        </span>
      </div>
      <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            height: "100%",
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: "2px",
            boxShadow: `0 0 8px ${color}88`,
          }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Ana GameOverlay Bileşeni
// ────────────────────────────────────────────────────────────────
export default function GameOverlay({ mission, token, onClose, onComplete }: GameOverlayProps) {
  const [phase, setPhase] = useState<"story" | "quiz" | "summary">("story");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [totalDelta, setTotalDelta] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [firewallIntegrity, setFirewallIntegrity] = useState(100); // 0-100 %, doğru cevaplarla düşer
  const [hintUsed, setHintUsed] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);
  const [boxVisible, setBoxVisible] = useState(false);
  const [solveStartTime, setSolveStartTime] = useState<number>(Date.now());

  // Yeni soru gelince kutuyu animate et
  useEffect(() => {
    if (phase === "quiz") {
      setBoxVisible(false);
      setHintUsed(false);
      setEliminatedOptions([]);
      setSolveStartTime(Date.now());
      const t = setTimeout(() => setBoxVisible(true), 80);
      return () => clearTimeout(t);
    }
  }, [currentIndex, phase]);

  // Story auto-skip
  useEffect(() => {
    if (phase === "story") {
      const timer = setTimeout(() => setPhase("quiz"), (mission.reading_time_seconds || 30) * 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, mission.reading_time_seconds]);

  const currentQ = mission.questions[currentIndex];

  // Hint: seçili cevap dışındaki rastgele bir şıkkı etkisizleştir
  // (correct_answer frontend'de bilinmiyor — güvenlik gereği)
  const useHint = () => {
    if (hintUsed || !currentQ || answerResult) return;
    // Seçili şık varsa onu koru, yoksa ilk şıkkı koru; geri kalanlardan birini etkisizleştir
    const protected_opt = selectedAnswer || currentQ.options[0];
    const candidates = currentQ.options.filter(o => o !== protected_opt);
    if (candidates.length > 0) {
      const toEliminate = candidates[Math.floor(Math.random() * candidates.length)];
      setEliminatedOptions([toEliminate]);
      setHintUsed(true);
    }
  };

  const handleAnswer = async () => {
    if (!selectedAnswer || submitting || !currentQ) return;
    setSubmitting(true);
    const solveTime = Math.round((Date.now() - solveStartTime) / 1000);
    try {
      const res = await axios.post<AnswerResult>(
        "http://localhost:8000/student/me/answer",
        {
          question_id: currentQ.id,
          answer: selectedAnswer,
          solve_time_seconds: solveTime,
          hint_used: hintUsed,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnswerResult(res.data);
      setTotalDelta(prev => prev + res.data.delta);

      // HP / Firewall güncelle
      if (res.data.correct) {
        // Doğru cevap: firewall'u yüzdeli olarak düşür
        // Kolay: ~8%, Orta: ~14%, Zor: ~22% düşer
        const baseChip =
          currentQ.elo_rating <= 900 ? 8 :
          currentQ.elo_rating <= 1100 ? 14 : 22;
        const speedBonus = solveTime < 15 ? 3 : 0;          // hızlı çözüm bonusu
        const hintPenalty = hintUsed ? -4 : 0;              // ipucu cezası
        const chip = Math.max(4, baseChip + speedBonus + hintPenalty);
        setFirewallIntegrity(prev => Math.max(0, prev - chip));
      } else {
        // Yanlış cevap: oyuncu HP düşer
        const dmg = Math.min(20, Math.max(8, Math.round((1200 - currentQ.elo_rating) / 30) + 8));
        setPlayerHp(prev => Math.max(0, prev - dmg));
      }
    } catch (err) {
      console.error("Cevap gönderilemedi:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    // Kutuyu kapat → sonra bir sonraki soruyu aç
    setBoxVisible(false);
    setTimeout(() => {
      if (currentIndex < mission.questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setAnswerResult(null);
      } else {
        setPhase("summary");
      }
    }, 400);
  };

  const diff = currentQ ? eloLabel(currentQ.elo_rating) : { label: "", color: CYAN, badge: "" };
  const isMotivation = answerResult?.motivation_triggered;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "#060608", fontFamily: font,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Izgara arka planı (tüm ekran) */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(${NEON}08 1px, transparent 1px),
          linear-gradient(90deg, ${NEON}08 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        zIndex: 0,
      }} />

      {/* Top Header */}
      <div style={{
        position: "relative", zIndex: 10,
        padding: "16px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${NEON}15`,
      }}>
        <span style={{ color: NEON, letterSpacing: "3px", fontSize: "11px", textShadow: `0 0 10px ${NEON}88` }}>
          SİSTEM: GÖREV AKTİF // {mission.title.toUpperCase()}
        </span>
        <button onClick={onClose} style={{
          background: "transparent", border: `1px solid ${NEON}44`,
          color: NEON, padding: "5px 16px", cursor: "pointer", fontFamily: font,
          fontSize: "10px", letterSpacing: "2px",
        }}>SİSTEMDEN ÇIK</button>
      </div>

      {/* ── STORY PHASE ── */}
      {phase === "story" && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "40px", position: "relative", zIndex: 5,
          }}
        >
          {/* Story cyberpunk box */}
          <CyberpunkBox show={true} color={CYAN} width={600}>
            <h2 style={{ color: ORANGE, fontSize: "1.4rem", letterSpacing: "5px", marginBottom: "24px", margin: "0 0 24px" }}>
              GÖREV BRİFİNGİ
            </h2>
            <div style={{
              color: "rgba(255,255,255,0.8)", fontSize: "14px", lineHeight: 1.9,
              maxHeight: "320px", overflowY: "auto",
              borderLeft: `2px solid ${CYAN}`, paddingLeft: "16px",
              flex: 1,
            }}>
              {mission.story_text ? (
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{mission.story_text}</p>
              ) : (
                <p style={{ margin: 0 }}>Bağlantı kuruluyor... Veriler şifreleniyor... PDF verisi işleniyor.</p>
              )}
            </div>
            <button onClick={() => setPhase("quiz")} style={{
              marginTop: "28px", alignSelf: "stretch",
              background: CYAN, color: "#000", border: "none",
              padding: "14px", fontSize: "13px", fontWeight: "bold", letterSpacing: "4px",
              cursor: "pointer", fontFamily: font,
              boxShadow: `0 0 20px ${CYAN}44`,
            }}>
              SAVAŞI BAŞLAT →
            </button>
          </CyberpunkBox>
        </motion.div>
      )}

      {/* ── QUIZ PHASE ── */}
      {phase === "quiz" && currentQ && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 5 }}>

          {/* Battle HP çubukları */}
          <div style={{
            display: "flex", gap: "20px", padding: "14px 28px",
            borderBottom: `1px solid ${NEON}10`,
            background: "rgba(6,6,8,0.9)",
          }}>
            <HpBar label="OPERATÖR HP" value={playerHp} maxValue={100} color={CYAN} />
            <div style={{ display: "flex", alignItems: "center", padding: "0 16px", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: `${NEON}88`, fontSize: "14px" }}>⌖</span>
              <span style={{ color: `${NEON}44`, fontSize: "7px", letterSpacing: "1px" }}>HACK</span>
            </div>
            <div style={{ flex: 1 }}>
              <HpBar label="TARGET ICE INTEGRITY" value={firewallIntegrity} maxValue={100} color={RED} showPercent />
              {firewallIntegrity === 0 && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  style={{ color: RED, fontSize: "8px", letterSpacing: "3px", margin: "4px 0 0", textShadow: `0 0 8px ${RED}` }}
                >
                  ⚡ FIREWALL BREACHED
                </motion.p>
              )}
            </div>
          </div>

          {/* Quiz içerik */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}>
            <CyberpunkBox show={boxVisible} color={isMotivation ? "#bc13fe" : NEON}>
              {/* Üst bilgi: soru no + zorluk */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <span style={{ color: `${NEON}99`, fontSize: "9px", letterSpacing: "3px" }}>
                  SORU {currentIndex + 1} / {mission.questions.length}
                </span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {isMotivation && (
                    <span style={{
                      color: "#bc13fe", fontSize: "8px", letterSpacing: "2px",
                      border: "1px solid #bc13fe55", padding: "2px 10px",
                      background: "rgba(188,19,254,0.08)",
                    }}>MOTİVASYON GÖREVİ</span>
                  )}
                  <span style={{
                    color: diff.color, fontSize: "8px", letterSpacing: "2px",
                    border: `1px solid ${diff.color}44`, padding: "2px 10px",
                  }}>
                    {diff.badge} {diff.label}
                  </span>
                </div>
              </div>

              {/* Hint butonu */}
              {!answerResult && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                  <button
                    onClick={useHint}
                    disabled={hintUsed}
                    style={{
                      background: hintUsed ? "rgba(255,204,0,0.05)" : "rgba(255,204,0,0.08)",
                      border: `1px solid ${hintUsed ? "rgba(255,204,0,0.2)" : "rgba(255,204,0,0.5)"}`,
                      color: hintUsed ? "rgba(255,204,0,0.3)" : "#ffcc00",
                      padding: "4px 14px", fontSize: "8px", letterSpacing: "2px",
                      cursor: hintUsed ? "not-allowed" : "pointer", fontFamily: font,
                    }}
                  >
                    {hintUsed ? "💡 İPUCU KULLANILDI · -%40 ELO" : "💡 İPUCU KULLAN"}
                  </button>
                </div>
              )}

              {/* Soru metni */}
              <p style={{
                color: "rgba(255,255,255,0.92)", fontSize: "14px", lineHeight: 1.7,
                margin: "0 0 20px", flex: 1,
              }}>
                {currentQ.text}
              </p>

              {/* Şıklar veya sonuç */}
              {!answerResult ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {currentQ.options.map((opt, i) => {
                    const isElim = eliminatedOptions.includes(opt);
                    const isSel = selectedAnswer === opt;
                    return (
                      <motion.button
                        key={i}
                        onClick={() => { if (!isElim) setSelectedAnswer(opt); }}
                        whileHover={!isElim ? { scale: 1.01 } : {}}
                        style={{
                          background: isElim
                            ? "rgba(255,255,255,0.01)"
                            : isSel
                              ? `${NEON}12`
                              : "rgba(255,255,255,0.03)",
                          border: `1px solid ${isElim ? "rgba(255,255,255,0.04)" : isSel ? NEON : `${NEON}30`}`,
                          color: isElim ? "rgba(255,255,255,0.15)" : isSel ? NEON : "rgba(255,255,255,0.75)",
                          padding: "12px 16px", textAlign: "left",
                          fontFamily: font, fontSize: "12px", cursor: isElim ? "not-allowed" : "pointer",
                          display: "flex", gap: "12px", alignItems: "center",
                          textDecoration: isElim ? "line-through" : "none",
                          transition: "all 0.15s",
                          boxShadow: isSel ? `0 0 12px ${NEON}22` : "none",
                        }}
                      >
                        <span style={{
                          color: isElim ? "rgba(255,255,255,0.1)" : isSel ? NEON : `${NEON}60`,
                          fontSize: "10px", fontWeight: "bold", minWidth: "16px"
                        }}>
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {opt}
                        {isSel && <span style={{ marginLeft: "auto", color: NEON, fontSize: "10px" }}>◀</span>}
                      </motion.button>
                    );
                  })}

                  <motion.button
                    onClick={handleAnswer}
                    disabled={!selectedAnswer || submitting}
                    whileHover={selectedAnswer && !submitting ? { scale: 1.02 } : {}}
                    style={{
                      marginTop: "12px", padding: "13px",
                      background: selectedAnswer ? NEON : "rgba(255,255,255,0.04)",
                      color: selectedAnswer ? "#000" : "rgba(255,255,255,0.2)",
                      border: "none", fontFamily: font, fontWeight: "bold",
                      letterSpacing: "3px", cursor: selectedAnswer ? "pointer" : "not-allowed",
                      fontSize: "11px", transition: "all 0.2s",
                      boxShadow: selectedAnswer ? `0 0 20px ${NEON}44` : "none",
                    }}
                  >
                    {submitting ? "ŞİFRELENİYOR..." : "KİLİDİ AÇ →"}
                  </motion.button>
                </div>
              ) : (
                /* Cevap sonucu */
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: answerResult.correct
                      ? `${GREEN}06` : `${RED}06`,
                    border: `1px solid ${answerResult.correct ? GREEN : RED}44`,
                    padding: "20px", textAlign: "center",
                  }}
                >
                  <h3 style={{
                    color: answerResult.correct ? GREEN : RED,
                    margin: "0 0 8px", letterSpacing: "3px", fontSize: "1.2rem",
                    textShadow: `0 0 15px ${answerResult.correct ? GREEN : RED}88`,
                  }}>
                    {answerResult.correct ? "✓ DOĞRU!" : "✕ YANLIŞ!"}
                  </h3>
                  {!answerResult.correct && (
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px", marginBottom: "10px" }}>
                      Doğru Cevap: <span style={{ color: GREEN }}>{answerResult.correct_answer}</span>
                    </p>
                  )}
                  {answerResult.time_message && (
                    <p style={{ color: "#ffcc00", fontSize: "10px", letterSpacing: "1px", margin: "0 0 8px" }}>
                      {answerResult.time_message}
                    </p>
                  )}
                  {answerResult.hint_used && answerResult.correct && (
                    <p style={{ color: "#ffcc00", fontSize: "10px", margin: "0 0 8px" }}>
                      💡 İpucu kullandın — ELO ödülü azaldı
                    </p>
                  )}
                  <p style={{ color: CYAN, fontSize: "13px", letterSpacing: "1px", margin: "0 0 16px" }}>
                    ELO: {answerResult.old_elo} → {answerResult.new_elo}{" "}
                    <span style={{ color: answerResult.delta >= 0 ? GREEN : RED, fontWeight: "bold" }}>
                      ({answerResult.delta > 0 ? "+" : ""}{answerResult.delta})
                    </span>
                  </p>
                  {isMotivation && (
                    <p style={{ color: "#bc13fe", fontSize: "10px", margin: "0 0 12px", letterSpacing: "1px" }}>
                      ⚡ Bağlantı yeniden kuruldu!
                    </p>
                  )}
                  <button
                    onClick={handleNext}
                    style={{
                      width: "100%", padding: "12px",
                      background: "transparent", border: `1px solid ${NEON}`,
                      color: NEON, fontFamily: font, letterSpacing: "3px",
                      cursor: "pointer", fontSize: "10px",
                      boxShadow: `0 0 10px ${NEON}22`,
                    }}
                  >
                    {currentIndex < mission.questions.length - 1 ? "SONRAKİ PROTOKOL →" : "GÖREVI TAMAMLA →"}
                  </button>
                </motion.div>
              )}
            </CyberpunkBox>
          </div>
        </div>
      )}

      {/* ── SUMMARY PHASE ── */}
      {phase === "summary" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", zIndex: 5,
          }}
        >
          <CyberpunkBox show={true} color={totalDelta >= 0 ? GREEN : RED} width={480}>
            <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <h2 style={{
                color: totalDelta >= 0 ? GREEN : RED,
                fontSize: "1.8rem", letterSpacing: "4px", marginBottom: "8px",
                textShadow: `0 0 20px ${totalDelta >= 0 ? GREEN : RED}88`,
              }}>
                GÖREV TAMAMLANDI
              </h2>
              {/* Firewall durumu */}
              <p style={{
                color: firewallIntegrity === 0 ? RED : `${RED}99`,
                fontSize: "11px", letterSpacing: "3px", margin: "0 0 16px",
              }}>
                {firewallIntegrity === 0
                  ? "⚡ FIREWALL BREACHED — SİSTEM ELE GEÇİRİLDİ"
                  : `🛡 FIREWALL INTEGRITY: %${Math.round(firewallIntegrity)} (Kısmen kırıldı)`}
              </p>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", letterSpacing: "2px", marginBottom: "8px" }}>
                NET ELO DEĞİŞİMİ
              </p>
              <p style={{
                color: totalDelta >= 0 ? GREEN : RED,
                fontWeight: "bold", fontSize: "3rem", margin: "0 0 32px",
                textShadow: `0 0 30px ${totalDelta >= 0 ? GREEN : RED}`,
              }}>
                {totalDelta > 0 ? "+" : ""}{totalDelta}
              </p>
              <button onClick={() => { onComplete(totalDelta); onClose(); }} style={{
                width: "100%", background: NEON, color: "#000", border: "none",
                padding: "14px 40px", fontSize: "13px", fontWeight: "bold", letterSpacing: "4px",
                cursor: "pointer", fontFamily: font,
                boxShadow: `0 0 20px ${NEON}66`,
              }}>
                HARİTAYA DÖN
              </button>
            </div>
          </CyberpunkBox>
        </motion.div>
      )}
    </div>
  );
}
