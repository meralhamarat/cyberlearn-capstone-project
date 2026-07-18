"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Howler dinamik import — SSR hatası almamak için
let Howl: any;
if (typeof window !== "undefined") {
  Howl = require("howler").Howl;
}

const TERMINAL_LINES = [
  "SYS_BOOT_v2.4.1 .................. OK",
  "NEURAL_LINK_CHECK ................. OK",
  "MEMORY_SCAN [████████░░] 80%",
  "FIREWALL_BREACH_DETECTED !!",
  "ENCRYPTING_RESISTANCE_NODE ........ OK",
  "SYSTEM ONLINE — WELCOME, SOLDIER.",
];

interface Props {
  onComplete: () => void;
}

export default function PreLoader({ onComplete }: Props) {
  const [lines, setLines]           = useState<string[]>([]);
  const [glitchActive, setGlitch]   = useState(false);
  const [exit, setExit]             = useState(false);
  const soundRef                    = useRef<any>(null);

useEffect(() => {
    if (typeof window === "undefined" || !Howl) return;

    soundRef.current = new Howl({
      src: ["/sounds/static.mp3"],
      loop: true,
      volume: 0.12,
      html5: true, 
    });

    const playTimer = setTimeout(() => {
      if (soundRef.current) {
        soundRef.current.play();
      }
    }, 100);

    return () => {
      clearTimeout(playTimer);
      if (soundRef.current) {
        soundRef.current.stop();
        soundRef.current.unload(); 
      }
    };
  }, []);


useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < TERMINAL_LINES.length) {
        setLines((prev) => [...prev, TERMINAL_LINES[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setGlitch(true), 800);
        setTimeout(() => {
          // Ses varsa yavaşça azaltarak bitir
          if (soundRef.current) {
            soundRef.current.fade(0.12, 0, 600);
          }
          setExit(true);
        }, 2200);
        setTimeout(onComplete, 2800);
      }
    }, 380);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!exit && (
        <motion.div
          className="preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6 }}
          style={styles.container}
        >
          {/* Tarama çizgileri */}
          <div style={styles.scanlines} />

          {/* Altıgen ikon */}
          <motion.div
            animate={glitchActive ? { x: [0, -5, 5, -3, 3, 0], opacity: [1, 0.7, 1] } : {}}
            transition={{ duration: 0.35, repeat: 4 }}
            style={{ marginBottom: "2.5rem" }}
          >
            <svg width="88" height="88" viewBox="0 0 88 88">
              <polygon
                points="44,4 80,24 80,64 44,84 8,64 8,24"
                fill="none"
                stroke="#00ffe7"
                strokeWidth="2"
              />
              <polygon
                points="44,14 70,29 70,59 44,74 18,59 18,29"
                fill="rgba(0,255,231,0.06)"
                stroke="#00ffe7"
                strokeWidth="1"
                strokeDasharray="5 3"
              />
              <text
                x="44" y="50"
                textAnchor="middle"
                fill="#00ffe7"
                fontSize="13"
                fontFamily="monospace"
                letterSpacing="2"
              >
                SYS
              </text>
            </svg>
          </motion.div>

          {/* Terminal çıktı */}
          <div style={styles.terminal}>
            {lines.map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  ...styles.line,
                  animation: glitchActive && i % 3 === 0
                    ? "glitchLine 0.3s infinite"
                    : "none",
                  color: line?.includes("!!")
                    ? "#ff003c"
                    : line?.includes("ONLINE")
                    ? "#00ff88"
                    : "#00ffe7",
                }}
              >
                {line}
              </motion.p>
            ))}
          </div>

          <style>{`
            @keyframes glitchLine {
              0%   { transform: skewX(0deg); text-shadow: none; }
              25%  { transform: skewX(-4deg); text-shadow: 3px 0 #ff003c; }
              50%  { transform: skewX(2deg);  text-shadow: -3px 0 #00ff88; }
              100% { transform: skewX(0deg); text-shadow: none; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
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
    zIndex: 9999,
    fontFamily: "'Share Tech Mono', monospace",
  },
  scanlines: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,255,231,0.025) 2px, rgba(0,255,231,0.025) 4px)",
  },
  terminal: {
    width: "min(540px, 90vw)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  line: {
    margin: 0,
    fontSize: "13px",
    letterSpacing: "0.04em",
    lineHeight: 1.5,
  },
};