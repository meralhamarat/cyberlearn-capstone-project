"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CHARACTERS = [
  {
    id: "commander",
    role: "teacher",
    name: "KOMUTAN",
    subtitle: "Öğretmen Paneli",
    desc: "Direnişi yönet. Savaşçılarını eğit. Haritayı kontrol et.",
    color: "#ff6b35",
    glow: "rgba(255,107,53,0.55)",
    image: "/images/commander.png",
  },
  {
    id: "warrior",
    role: "student",
    name: "SAVAŞÇI",
    subtitle: "Öğrenci Paneli",
    desc: "Zihnini geri kazan. Her doğru cevap düşmanı zayıflatır.",
    color: "#00ffe7",
    glow: "rgba(0,255,231,0.55)",
    image: "/images/warrior.png",
  },
];

interface Props {
  userId: number;
  onSelect: (role: string) => void;
}

export default function CharacterSelect({ userId, onSelect }: Props) {
  const router = useRouter(); 
  const [current, setCurrent] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  const char = CHARACTERS[current];

  const handleSelect = async () => {
    setLoading(true);
    // Rol seçimi artık login sonrası JWT token'ından otomatik alınıyor.
    // Doğrudan login sayfasına yönlendir.
    router.push("/login");
    setLoading(false);
  };

  return (
    <motion.div
      style={{
        ...styles.container,
        animation: shaking ? "screenShake 0.5s ease" : "none",
      }}
    >
      <div style={styles.scanlines} />

      {/* --- SOL BUTON (KOMUTAN) --- */}
      <button 
        style={{ 
          ...styles.sideNavBtn, 
          left: "5%", 
          borderColor: current === 0 ? "#ff6b35" : "rgba(255,255,255,0.1)" 
        }} 
        onClick={() => setCurrent(0)}
      >
        <span style={{ fontSize: "10px", opacity: 0.5 }}>SINIF</span> KOMUTAN
      </button>

      {/* --- SAĞ BUTON (SAVAŞÇI) --- */}
      <button 
        style={{ 
          ...styles.sideNavBtn, 
          right: "5%", 
          borderColor: current === 1 ? "#00ffe7" : "rgba(255,255,255,0.1)" 
        }} 
        onClick={() => setCurrent(1)}
      >
        <span style={{ fontSize: "10px", opacity: 0.5 }}></span> SAVAŞÇI
      </button>

      {/* --- ORTA BAŞLIK --- */}
      <div style={styles.centerHeader}>
        <h2 style={styles.titleText}>KARAKTERİNİ SEÇ</h2>
        <div style={{ ...styles.titleUnderline, background: char.color }} />
      </div>

      {/* Arka plan karakter görseli */}
      <AnimatePresence mode="wait">
        <motion.div
          key={char.id + "-bg"}
          style={{
            ...styles.bgImage,
            backgroundImage: `url(${char.image})`,
          }}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.4, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8 }}
        />
      </AnimatePresence>

      {/* Karakter Bilgi Paneli (Ortada) */}
      <motion.div
        style={{ ...styles.infoPanel, borderColor: char.color }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <motion.div
          style={{ ...styles.eyeGlow, background: char.glow }}
          animate={{ opacity: hovering ? 1 : 0 }}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={char.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <p style={{ ...styles.charName, color: char.color }}>{char.name}</p>
            <p style={styles.charSub}>{char.subtitle}</p>
            <p style={styles.charDesc}>{char.desc}</p>
          </motion.div>
        </AnimatePresence>

        <button
          style={{
            ...styles.selectBtn,
            borderColor: char.color,
            color: char.color,
            opacity: loading ? 0.5 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onClick={handleSelect}
          disabled={loading}
        >
          {loading ? "SİSTEME GİRİLİYOR..." : "[ SEÇİMİ ONAYLA ]"}
        </button>
      </motion.div>

      <style>{`
        @keyframes screenShake {
          0%, 100% { transform: translate(0,0); }
          25% { transform: translate(-5px, 5px); }
          50% { transform: translate(5px, -5px); }
          75% { transform: translate(-5px, -5px); }
        }
      `}</style>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    inset: 0,
    background: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Share Tech Mono', monospace",
    overflow: "hidden",
  },
  centerHeader: {
    position: "absolute",
    top: "10%",
    textAlign: "center",
    zIndex: 100,
  },
  titleText: {
    color: "#fff",
    fontSize: "24px",
    letterSpacing: "8px",
    margin: 0,
    textShadow: "0 0 20px rgba(255,255,255,0.3)",
  },
  titleUnderline: {
    height: "2px",
    width: "60px",
    margin: "10px auto",
    transition: "all 0.5s",
  },
  sideNavBtn: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(0,0,0,0.4)",
    backdropFilter: "blur(10px)",
    border: "1px solid",
    color: "#fff",
    padding: "30px 20px",
    cursor: "pointer",
    zIndex: 100,
    letterSpacing: "2px",
    transition: "all 0.3s",
    width: "140px",
    textAlign: "center"
  },
  bgImage: {
    position: "absolute",
    inset: 0,
    backgroundSize: "contain",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  infoPanel: {
    position: "relative",
    zIndex: 5,
    border: "1px solid",
    padding: "2rem",
    width: "350px",
    background: "rgba(0,0,0,0.8)",
    backdropFilter: "blur(15px)",
    textAlign: "center",
  },
  charName: { fontSize: "1.8rem", fontWeight: "bold", margin: "0 0 5px 0" },
  charSub: { fontSize: "12px", opacity: 0.5, marginBottom: "15px" },
  charDesc: { fontSize: "15px", color: "#ffffff", textShadow: "0 0 10px #000, 0 0 20px #000", backgroundColor: "rgba(0, 0, 0, 0.4)", padding: "10px", borderRadius: "5px", lineHeight: "1.6" },
  scanlines: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
    zIndex: 2,
    backgroundSize: "100% 4px, 3px 100%",
  }
};