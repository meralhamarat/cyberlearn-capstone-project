"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const font = "'Share Tech Mono', monospace";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState("SAVAŞÇI");

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");
    const role = localStorage.getItem("userRole") || localStorage.getItem("role");
    if (!token || role !== "student") router.push("/login");
  }, [router]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("role");
    router.push("/login");
  };

  const navLinks = [
    { label: "DÜNYA HARİTASI", href: "/dashboard/student" },
    { label: "PROFİLİM", href: "/dashboard/student/profile" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#060608", fontFamily: font, position: "relative" }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200,
        background: "repeating-linear-gradient(0deg,rgba(0,0,0,0.08) 0px,rgba(0,0,0,0.08) 1px,transparent 1px,transparent 3px)",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,255,231,0.035) 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }} />

      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 150,
        height: "58px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 36px",
        background: "rgba(6,6,8,0.88)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,255,231,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span style={{ color: "#00ffe7", fontSize: "15px", letterSpacing: "5px", fontWeight: "bold" }}>
            ⬡ CYBERLEARN
          </span>
          <span style={{
            fontSize: "8px", letterSpacing: "3px", color: "rgba(0,255,231,0.45)",
            border: "1px solid rgba(0,255,231,0.15)", padding: "3px 10px",
            background: "rgba(0,255,231,0.04)",
          }}>SAVAŞÇI</span>
        </div>

        <div style={{ display: "flex", gap: "2px" }}>
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <button key={link.href} onClick={() => router.push(link.href)} style={{
                background: active ? "rgba(0,255,231,0.07)" : "transparent",
                border: "none",
                borderBottom: `1px solid ${active ? "#00ffe7" : "transparent"}`,
                color: active ? "#00ffe7" : "rgba(255,255,255,0.3)",
                padding: "8px 20px", fontSize: "10px", letterSpacing: "2px",
                cursor: "pointer", fontFamily: font, transition: "all 0.25s",
              }}>{link.label}</button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "#39ff14", boxShadow: "0 0 8px #39ff14", display: "inline-block",
            }} />
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", letterSpacing: "1px" }}>{username}</span>
          </div>
          <button onClick={logout} style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.09)",
            color: "rgba(255,255,255,0.28)", padding: "5px 16px",
            fontSize: "10px", letterSpacing: "2px", cursor: "pointer",
            fontFamily: font, transition: "all 0.2s",
          }}>ÇIKIŞ</button>
        </div>
      </nav>

      <div style={{ paddingTop: "58px", position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}