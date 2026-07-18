"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const font = "'Share Tech Mono', monospace";

interface RegisterForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  class_code: string;
  teacher_code: string;
}

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState<RegisterForm>({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    class_code: "",
    teacher_code: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        role: "student",
        class_code: form.class_code,
        teacher_code: form.teacher_code,
      };

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        const detail = data.detail;
        if (Array.isArray(detail)) {
          setError(detail.map((e: { msg: string }) => e.msg).join(", "));
        } else if (typeof detail === "object") {
          setError(detail.msg ?? "Kayıt sırasında bir hata oluştu.");
        } else {
          setError(detail ?? "Kayıt sırasında bir hata oluştu.");
        }
        return;
      }

      router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch {
      setError("Sunucuya bağlanılamadı. Lütfen tekrar dene.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#060608",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: font,
      padding: "24px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,255,231,0.035) 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg,rgba(0,0,0,0.08) 0px,rgba(0,0,0,0.08) 1px,transparent 1px,transparent 3px)",
      }} />

      <div style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <p style={{ margin: "0 0 8px", color: "#00ffe7", fontSize: "20px", letterSpacing: "6px", fontWeight: "bold" }}>
            ⬡ CYBERLEARN
          </p>
          <span style={{
            fontSize: "8px", letterSpacing: "3px", color: "rgba(0,255,231,0.4)",
            border: "1px solid rgba(0,255,231,0.15)", padding: "3px 12px",
            background: "rgba(0,255,231,0.04)",
          }}>
            YENİ ÖĞRENCİ KAYDИ
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(0,255,231,0.1)",
          padding: "36px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}>
          {/* Ad & Soyad */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Field label="AD">
              <input
                id="first_name"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                required
                placeholder="Adın"
                style={inputStyle}
              />
            </Field>
            <Field label="SOYAD">
              <input
                id="last_name"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                required
                placeholder="Soyadın"
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="E-POSTA">
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="ornek@mail.com"
              style={inputStyle}
            />
          </Field>

          <Field label="ŞİFRE">
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
              style={inputStyle}
            />
          </Field>

          {/* Ayırıcı */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "6px" }}>
            <p style={{ color: "rgba(0,255,231,0.4)", fontSize: "8px", letterSpacing: "3px", margin: "0 0 14px" }}>
              SINIF BİLGİLERİ
            </p>
          </div>

          <Field label="SINIF KODU">
            <input
              id="class_code"
              name="class_code"
              value={form.class_code}
              onChange={handleChange}
              required
              placeholder="CLS-101"
              style={inputStyle}
            />
          </Field>

          <Field label="ÖĞRETMEN KODU">
            <input
              id="teacher_code"
              name="teacher_code"
              value={form.teacher_code}
              onChange={handleChange}
              required
              placeholder="TCH-XXXXXXXX"
              style={inputStyle}
            />
          </Field>

          {error && (
            <div style={{
              background: "rgba(255,68,85,0.06)",
              border: "1px solid rgba(255,68,85,0.3)",
              padding: "12px 16px",
              color: "#ff4455",
              fontSize: "11px",
              letterSpacing: "1px",
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            id="register-submit"
            type="submit"
            disabled={loading}
            style={{
              marginTop: "6px",
              width: "100%",
              padding: "14px",
              background: loading ? "rgba(0,255,231,0.1)" : "#00ffe7",
              border: "none",
              color: loading ? "#00ffe7" : "#000",
              fontWeight: "bold",
              fontSize: "11px",
              letterSpacing: "3px",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: font,
              boxShadow: loading ? "none" : "0 0 24px rgba(0,255,231,0.3)",
              transition: "all 0.2s",
            }}
          >
            {loading ? "KAYIT YAPILIYOR..." : "SISTEME KATIL →"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "10px", marginTop: "20px", letterSpacing: "1px" }}>
          Zaten hesabın var mı?{" "}
          <a href="/login" style={{ color: "#00ffe7", textDecoration: "none" }}>
            GİRİŞ YAP
          </a>
        </p>

        <p style={{
          textAlign: "center", marginTop: "16px",
          color: "rgba(255,255,255,0.1)", fontSize: "9px", letterSpacing: "2px",
        }}>
          ÖĞRETMEN HESABI? → YÖNETİCİNİZLE İLETİŞİME GEÇİN
        </p>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
  padding: "10px 14px",
  fontSize: "12px",
  fontFamily: "'Share Tech Mono', monospace",
  outline: "none",
  boxSizing: "border-box",
  letterSpacing: "1px",
  transition: "border-color 0.2s",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ color: "rgba(255,255,255,0.25)", fontSize: "8px", letterSpacing: "3px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}