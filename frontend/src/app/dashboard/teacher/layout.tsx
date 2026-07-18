"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const font = "'Share Tech Mono', monospace";
const accent = "#ff6b35";

const navItems = [
  { href: "/dashboard/teacher", label: "GENEL BAKIŞ", icon: "◈" },
  { href: "/dashboard/teacher/students", label: "ÖĞRENCİLER", icon: "◉" },
  { href: "/dashboard/teacher/documents", label: "DOKÜMANLAR", icon: "◆" },
  { href: "/dashboard/teacher/questions", label: "SORULAR", icon: "■" },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");
    const role = localStorage.getItem("userRole") || localStorage.getItem("role");
    if (!token || role !== "teacher") router.push("/login");
  }, [router]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("role");
    router.push("/login");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060608", fontFamily: font, display: "flex", position: "relative" }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200,
        background: "repeating-linear-gradient(0deg,rgba(0,0,0,0.08) 0px,rgba(0,0,0,0.08) 1px,transparent 1px,transparent 3px)",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,107,53,0.025) 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }} />

      {/* Sidebar */}
      <aside style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: "210px", zIndex: 100,
        background: "rgba(6,6,8,0.92)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255,107,53,0.08)",
        display: "flex", flexDirection: "column",
        padding: "32px 0",
      }}>
        {/* Logo */}
        <div style={{ padding: "0 24px", marginBottom: "48px" }}>
          <p style={{ margin: "0 0 6px", color: accent, fontSize: "15px", letterSpacing: "4px", fontWeight: "bold" }}>
            ⬡ CYBER<br />LEARN
          </p>
          <span style={{
            fontSize: "8px", letterSpacing: "3px", color: "rgba(255,107,53,0.4)",
            border: "1px solid rgba(255,107,53,0.15)", padding: "2px 8px",
            background: "rgba(255,107,53,0.04)",
          }}>KOMUTAN</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <button key={item.href} onClick={() => router.push(item.href)} style={{
                background: active ? "rgba(255,107,53,0.07)" : "transparent",
                border: "none",
                borderLeft: `2px solid ${active ? accent : "transparent"}`,
                color: active ? accent : "rgba(255,255,255,0.3)",
                padding: "12px 24px",
                fontSize: "10px", letterSpacing: "2px",
                cursor: "pointer", fontFamily: font,
                textAlign: "left", display: "flex", alignItems: "center", gap: "12px",
                transition: "all 0.2s",
              }}>
                <span style={{ fontSize: "14px", opacity: active ? 1 : 0.5 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "0 16px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "12px 12px", marginBottom: "8px",
            border: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.02)",
          }}>
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#39ff14", boxShadow: "0 0 6px #39ff14", display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              KOMUTAN_01
            </span>
          </div>
          <button onClick={logout} style={{
            width: "100%", background: "transparent",
            border: "1px solid rgba(255,255,255,0.07)",
            color: "rgba(255,255,255,0.22)", padding: "9px",
            fontSize: "10px", letterSpacing: "2px",
            cursor: "pointer", fontFamily: font, transition: "all 0.2s",
          }}>⏻ ÇIKIŞ YAP</button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ marginLeft: "210px", flex: 1, position: "relative", zIndex: 1, minHeight: "100vh" }}>
        {children}
      </div>
    </div>
  );
}