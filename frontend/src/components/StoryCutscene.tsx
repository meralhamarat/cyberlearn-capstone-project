"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

let Howl: any;
if (typeof window !== "undefined") {
  Howl = require("howler").Howl;
}

const STORY_TEXT =
  "YIL 2150. İnsanlık zihinlerini siber-işgalcilere kaptırdı. " +
  "Geriye kalan son direnişçileriz. " +
  "Zihnini geri kazanmalı ve dünyayı kurtarmalısın.";

interface Props {
  onComplete: () => void;
}

export default function StoryCutscene({ onComplete }: Props) {
  const musicRef = useRef<any>(null);

  // Synthwave arka plan müziği — /public/sounds/synthwave.mp3 koy
  useEffect(() => {
    if (typeof window === "undefined" || !Howl) return;
    musicRef.current = new Howl({
      src: ["/sounds/synthwave.mp3"],
      loop: true,
      volume: 0,
    });
    musicRef.current.play();
    // 2 saniyede fade-in
    musicRef.current.fade(0, 0.28, 2000);

    return () => {
      musicRef.current?.fade(0.28, 0, 800);
      setTimeout(() => musicRef.current?.stop(), 900);
    };
  }, []);

  const words = STORY_TEXT.split(" ");
  const totalDuration = words.length * 0.11 + 1.5; // son kelime + bekleme

  return (
    <motion.div
      style={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2 }}
    >
      {/* CRT tarama çizgileri */}
      <div style={styles.scanlines} />

      {/* Sol üst köşe dekorasyon */}
      <div style={styles.corner}>[ DIRECTIVE_7 // MISSION BRIEF ]</div>

      {/* Ana hikaye metni */}
      <motion.p style={styles.text}>
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: i * 0.11,
              duration: 0.35,
              ease: "easeOut",
            }}
          >
            {word}{" "}
          </motion.span>
        ))}
      </motion.p>

      {/* Alt çizgi dekor */}
      <motion.div
        style={styles.divider}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: totalDuration - 0.5, duration: 0.8 }}
      />

      {/* Devam butonu — tüm kelimeler çıktıktan sonra görün */}
      <motion.button
        style={styles.btn}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: totalDuration, duration: 0.5 }}
        onClick={onComplete}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background = "rgba(0,255,231,0.12)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background = "transparent";
        }}
      >
        [ GÖREVE BAŞLA ]
      </motion.button>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    inset: 0,
    background: "#000",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    gap: "2rem",
    fontFamily: "'Share Tech Mono', monospace",
    zIndex: 9998,
  },
  scanlines: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,255,231,0.02) 3px, rgba(0,255,231,0.02) 4px)",
  },
  corner: {
    position: "absolute",
    top: "1.5rem",
    left: "2rem",
    fontSize: "11px",
    color: "rgba(0,255,231,0.4)",
    letterSpacing: "0.1em",
  },
  text: {
    maxWidth: "640px",
    fontSize: "clamp(16px, 2.2vw, 22px)",
    color: "#c8ffe8",
    lineHeight: 2,
    textAlign: "center",
    letterSpacing: "0.06em",
    textShadow: "0 0 14px rgba(0,255,231,0.35)",
    margin: 0,
  },
  divider: {
    width: "min(400px, 80vw)",
    height: "1px",
    background: "linear-gradient(to right, transparent, #00ffe7, transparent)",
    transformOrigin: "left",
  },
  btn: {
    background: "transparent",
    border: "1px solid #00ffe7",
    color: "#00ffe7",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: "14px",
    padding: "12px 32px",
    cursor: "pointer",
    letterSpacing: "0.12em",
    transition: "background 0.2s",
  },
};