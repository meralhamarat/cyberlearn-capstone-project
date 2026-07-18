"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PreLoader from "../components/PreLoader";
import StoryCutscene from "../components/StoryCutscene";
import CharacterSelection from "../components/CharacterSelection"; 

type GameStage = "loading" | "story" | "landing" | "char_select";

export default function Home() {
  // Test etmek için burayı "char_select" yapabilirsin
  const [stage, setStage] = useState<GameStage>("loading");

  return (
    <main style={{ backgroundColor: "#000", minHeight: "100vh" }}>
      <AnimatePresence mode="wait">
        
        {stage === "loading" && (
          <PreLoader key="loader" onComplete={() => setStage("story")} />
        )}

        {stage === "story" && (
          <StoryCutscene key="story" onComplete={() => setStage("landing")} />
        )}

        {stage === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.container}
          >
            <motion.h1 style={styles.title}>CYBERLEARN: WAR OF MINDS 2150</motion.h1>
            <p style={styles.text}>Zihnini geri kazan. Sistem seni bekliyor.</p>
            <button onClick={() => setStage("char_select")} style={styles.button}>
              START
            </button>
          </motion.div>
        )}

        {/* 4. AŞAMA: İŞTE BURAYI BÖYLE DÜZELTMELİSİN */}
        {stage === "char_select" && (
          <motion.div 
            key="char" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
             <CharacterSelection 
                userId={1} 
                onSelect={(role) => {
                  console.log("Seçilen karakter rolü:", role);
                  // Buraya seçimden sonraki aşamayı (örneğin dashboard) ekleyebilirsin
                }} 
             />
          </motion.div>
        )}

      </AnimatePresence>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: "100vh",
    background: "#000",
    color: "#00ffe7",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "monospace",
  },
  title: {
    fontSize: "32px",
    letterSpacing: "0.2em",
    marginBottom: "20px",
    textAlign: "center"
  },
  text: {
    opacity: 0.7,
    marginBottom: "40px",
  },
  button: {
    padding: "12px 32px",
    border: "1px solid #00ffe7",
    background: "transparent",
    color: "#00ffe7",
    cursor: "pointer",
    fontSize: "16px",
    letterSpacing: "0.1em",
    transition: "all 0.3s"
  },
};