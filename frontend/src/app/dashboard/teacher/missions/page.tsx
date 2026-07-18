"use client";

import { useState } from "react";

const font = "'Share Tech Mono', monospace";
const accent = "#ff6b35";

const existingMissions = [
  { id: 1, name: "SİBER GİRİŞ", zone: "ALPHA", type: "SALDIRI", difficulty: "KOLAY", xp: 150, assigned: 5, completed: 3 },
  { id: 2, name: "FIREWALL KIRMIZI", zone: "BETA", type: "SAVUNMA", difficulty: "ORTA", xp: 300, assigned: 5, completed: 2 },
  { id: 3, name: "KRİPTO ANAHTARI", zone: "GAMMA", type: "ŞİFRELEME", difficulty: "ZOR", xp: 500, assigned: 5, completed: 0 },
];

const diffColor: Record<string, string> = {
  KOLAY: "#39ff14", ORTA: "#ffcc00", ZOR: "#ff6b35", UZMAN: "#ff4455",
};

export default function TeacherMissionsPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [form, setForm] = useState({ name: "", zone: "ALPHA", type: "SALDIRI", difficulty: "KOLAY", xp: "100", desc: "" });

  const handleCreate = (e: React.MouseEvent) => {
    e.preventDefault();
    alert(`Görev oluşturuldu: ${form.name} (backend entegrasyonu gerekli)`);
    setView("list");
  };

  return (
    <div style={{ padding: "40px 44px", fontFamily: font }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        marginBottom: "36px", borderBottom: "1px solid rgba(255,107,53,0.08)", paddingBottom: "24px",
      }}>
        <div>
          <h1 style={{ color: accent, fontSize: "20px", letterSpacing: "5px", margin: "0 0 6px" }}>GÖREV YÖNETİMİ</h1>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", letterSpacing: "2px", margin: 0 }}>
            {existingMissions.length} aktif görev
          </p>
        </div>
        <div style={{ display: "flex", gap: "2px" }}>
          {(["list", "create"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? "rgba(255,107,53,0.1)" : "transparent",
              border: "1px solid rgba(255,107,53,0.2)",
              color: view === v ? accent : "rgba(255,255,255,0.3)",
              padding: "8px 20px", fontSize: "10px", letterSpacing: "2px",
              cursor: "pointer", fontFamily: font, transition: "all 0.2s",
            }}>
              {v === "list" ? "GÖREVLER" : "+ YENİ GÖREV"}
            </button>
          ))}
        </div>
      </div>

      {/* Mission list */}
      {view === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {existingMissions.map((m) => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: "20px",
              padding: "18px 22px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.055)",
              borderLeft: `2px solid ${diffColor[m.difficulty]}44`,
              transition: "background 0.2s",
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 4px", color: "#fff", fontSize: "12px", letterSpacing: "1px" }}>{m.name}</p>
                <div style={{ display: "flex", gap: "12px" }}>
                  <span style={{ color: "#00ffe7", fontSize: "9px" }}>ZONE {m.zone}</span>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }}>{m.type}</span>
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 2px", color: diffColor[m.difficulty], fontSize: "10px" }}>{m.difficulty}</p>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.2)", fontSize: "8px" }}>ZORLUK</p>
              </div>

              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 2px", color: "#ffcc00", fontSize: "14px" }}>{m.xp}</p>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.2)", fontSize: "8px" }}>XP</p>
              </div>

              {/* Completion bar */}
              <div style={{ width: "100px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "8px" }}>TAMAMLAMA</span>
                  <span style={{ color: "#39ff14", fontSize: "8px" }}>{m.completed}/{m.assigned}</span>
                </div>
                <div style={{ height: "2px", background: "rgba(255,255,255,0.07)" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.round((m.completed / m.assigned) * 100)}%`,
                    background: "#39ff14",
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create mission form */}
      {view === "create" && (
        <div style={{ maxWidth: "560px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Name */}
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "2px", marginBottom: "8px" }}>
                GÖREV ADI
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ör. VERİ KALE..."
                style={{
                  width: "100%", padding: "12px 14px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff", fontSize: "12px", fontFamily: font,
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Zone + Type */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: "ZONE", key: "zone", options: ["ALPHA", "BETA", "GAMMA", "DELTA", "OMEGA"] },
                { label: "TÜR", key: "type", options: ["SALDIRI", "SAVUNMA", "ŞİFRELEME", "BOSS"] },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ display: "block", color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "2px", marginBottom: "8px" }}>
                    {field.label}
                  </label>
                  <select
                    value={form[field.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    style={{
                      width: "100%", padding: "12px 14px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#fff", fontSize: "11px", fontFamily: font,
                      outline: "none", appearance: "none",
                    }}
                  >
                    {field.options.map((o) => <option key={o} value={o} style={{ background: "#111" }}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Difficulty + XP */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "2px", marginBottom: "8px" }}>
                  ZORLUK
                </label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  style={{
                    width: "100%", padding: "12px 14px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: diffColor[form.difficulty], fontSize: "11px", fontFamily: font,
                    outline: "none", appearance: "none",
                  }}
                >
                  {["KOLAY", "ORTA", "ZOR", "UZMAN"].map((d) => (
                    <option key={d} value={d} style={{ background: "#111", color: diffColor[d] }}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "2px", marginBottom: "8px" }}>
                  XP ÖDÜLÜ
                </label>
                <input
                  type="number"
                  value={form.xp}
                  onChange={(e) => setForm({ ...form, xp: e.target.value })}
                  style={{
                    width: "100%", padding: "12px 14px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#ffcc00", fontSize: "12px", fontFamily: font,
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ display: "block", color: "rgba(255,255,255,0.3)", fontSize: "9px", letterSpacing: "2px", marginBottom: "8px" }}>
                AÇIKLAMA
              </label>
              <textarea
                value={form.desc}
                onChange={(e) => setForm({ ...form, desc: e.target.value })}
                rows={3}
                placeholder="Görev hakkında kısa açıklama..."
                style={{
                  width: "100%", padding: "12px 14px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff", fontSize: "12px", fontFamily: font,
                  outline: "none", resize: "vertical", boxSizing: "border-box",
                }}
              />
            </div>

            <button
              onClick={handleCreate}
              style={{
                padding: "14px",
                background: accent, border: "none",
                color: "#000", fontWeight: "bold",
                fontSize: "12px", letterSpacing: "3px",
                cursor: "pointer", fontFamily: font,
                boxShadow: `0 0 24px ${accent}44`,
                transition: "all 0.2s",
              }}
            >
              GÖREVI OLUŞTUR →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}