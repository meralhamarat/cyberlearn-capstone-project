"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"commander" | "warrior">("warrior");
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleLogin = async () => {
    setErrorMessage("");

    // Temel boşluk kontrolü
    if (formData.email === "" || formData.password === "") {
      setErrorMessage("❌ Email veya Access Key boş bırakılamaz.");
      return;
    }

    try {
      const res = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Başarılı giriş: Token ve Rolü sakla
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("userRole", data.user.role);
        localStorage.setItem("firstName", data.user.first_name);

        const destination =
          data.user.role === "admin"
            ? "/dashboard/admin"
            : data.user.role === "teacher"
            ? "/dashboard/teacher"
            : "/dashboard/student";

        router.push(destination);
      } else {
        // Backend'den gelen hata mesajını göster
        setErrorMessage(
          `❌ ERİŞİM REDDEDİLDİ: ${data.detail || "Kimlik doğrulanamadı."}`
        );
      }
    } catch (err) {
      setErrorMessage(
        "❌ SİSTEM HATASI: Matrix bağlantısı koptu (Backend çalışmıyor)."
      );
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.scanlines} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={styles.loginCard}
      >
        <div style={styles.tabContainer}>
          <button
            onClick={() => setRole("commander")}
            style={{
              ...styles.tabBtn,
              color: role === "commander" ? "#ff6b35" : "#ffffff",
              borderColor: role === "commander" ? "#ff6b35" : "transparent",
              background:
                role === "commander" ? "rgba(255,107,53,0.1)" : "transparent",
            }}
          >
            KOMUTAN
          </button>
          <button
            onClick={() => setRole("warrior")}
            style={{
              ...styles.tabBtn,
              color: role === "warrior" ? "#00ffe7" : "#ffffff",
              borderColor: role === "warrior" ? "#00ffe7" : "transparent",
              background:
                role === "warrior" ? "rgba(0,255,231,0.1)" : "transparent",
            }}
          >
            SAVAŞÇI
          </button>
        </div>

        <h2
          style={{
            ...styles.title,
            color: role === "commander" ? "#ff6b35" : "#00ffe7",
          }}
        >
          {role === "commander" ? "COMMANDER LOGIN" : "WARRIOR LOGIN"}
        </h2>

        <div style={styles.form}>
          <div style={styles.inputWrapper}>
            <label style={styles.label}>EMAIL</label>
            <input
              type="email"
              style={styles.input}
              placeholder="neural-link@agency.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          <div style={styles.inputWrapper}>
            <label style={styles.label}>ACCESS KEY</label>
            <input
              type="password"
              style={styles.input}
              placeholder="********"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
          </div>

          {/* Hata Mesajı Alanı */}
          <AnimatePresence>
            {errorMessage && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  color: "#ff4444",
                  fontSize: "12px",
                  textAlign: "center",
                  marginBottom: "10px",
                }}
              >
                {errorMessage}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            onClick={handleLogin}
            style={{
              ...styles.submitBtn,
              backgroundColor: role === "commander" ? "#ff6b35" : "#00ffe7",
              boxShadow: `0 0 20px ${
                role === "commander"
                  ? "rgba(255,107,53,0.4)"
                  : "rgba(0,255,231,0.4)"
              }`,
            }}
          >
            ESTABLISH CONNECTION
          </button>

          <p
            style={{
              marginTop: "20px",
              fontSize: "12px",
              textAlign: "center",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Sistemde kaydın yok mu?{" "}
            <span
              onClick={() => router.push("/register")}
              style={{
                color: "#fff",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              YENİ KİMLİK OLUŞTUR
            </span>
          </p>
        </div>
      </motion.div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: "100vh",
    background: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Share Tech Mono', monospace",
    position: "relative",
    overflow: "hidden",
  },
  loginCard: {
    width: "420px",
    padding: "40px",
    background: "rgba(10,10,10,0.9)",
    border: "1px solid rgba(255,255,255,0.1)",
    backdropFilter: "blur(20px)",
    position: "relative",
    zIndex: 10,
  },
  tabContainer: {
    display: "flex",
    gap: "10px",
    marginBottom: "40px",
  },
  tabBtn: {
    flex: 1,
    padding: "12px",
    background: "transparent",
    borderBottom: "2px solid",
    cursor: "pointer",
    fontSize: "12px",
    letterSpacing: "2px",
    transition: "all 0.3s",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
  },
  title: {
    fontSize: "20px",
    letterSpacing: "4px",
    textAlign: "center",
    marginBottom: "30px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
  },
  inputWrapper: {
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "10px",
    letterSpacing: "2px",
    opacity: 0.6,
    color: "#fff",
  },
  input: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "12px",
    color: "#fff",
    outline: "none",
    fontSize: "14px",
    fontFamily: "inherit",
  },
  submitBtn: {
    width: "100%",
    padding: "16px",
    border: "none",
    color: "#000",
    fontWeight: "bold",
    letterSpacing: "2px",
    cursor: "pointer",
    marginTop: "20px",
    transition: "0.3s",
  },
  scanlines: {
    position: "absolute",
    inset: 0,
    background:
      "repeating-linear-gradient(0deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)",
    pointerEvents: "none",
  },
};