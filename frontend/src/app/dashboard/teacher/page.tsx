"use client";

import { useState, useEffect } from "react";
import axios from "axios";

const font = "'Share Tech Mono', monospace";
const accent = "#ff6b35";

// Loglar şimdilik statik kalabilir, tasarımı dolduruyor
const recentActivity = [
  { time: "14:32", name: "Elif Kaya", action: "FIREWALL KIRMIZI tamamladı", score: 92, color: "#39ff14" },
  { time: "14:15", name: "Ahmet Yılmaz", action: "KRİPTO ANAHTARI başladı", score: null, color: "#00ffe7" },
  { time: "13:58", name: "Zeynep Arslan", action: "SİBER GİRİŞ tamamladı", score: 74, color: "#ffcc00" },
  { time: "13:20", name: "Can Demir", action: "sistemden ayrıldı", score: null, color: "rgba(255,255,255,0.2)" },
];

interface Classroom {
  id: number;
  name: string | null;
  code: string;
  student_count: number;
}

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  elo_rating: number;
  story_chapter: number;
  is_verified: boolean;
  classroom_code: string;
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token");
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };

        const classroomsRes = await axios.get<Classroom[]>("http://localhost:8000/teacher/classrooms", { headers });
        const classrooms = classroomsRes.data;

        const allStudents: Student[] = [];
        for (const classroom of classrooms) {
          const studentsRes = await axios.get<Omit<Student, "classroom_code">[]>(
            `http://localhost:8000/teacher/classrooms/${classroom.id}/students`,
            { headers }
          );
          for (const s of studentsRes.data) {
            allStudents.push({ ...s, classroom_code: classroom.code });
          }
        }

        setStudents(allStudents);
      } catch (error) {
        console.error("Öğrenciler yüklenirken hata oluştu:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#060608", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, color: accent }}>
        <p style={{ letterSpacing: "3px" }}>KORUMALI SİSTEM BAĞLANTISI KURULUYOR...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px 44px", fontFamily: font, color: "#fff", background: "#060608", minHeight: "100vh" }}>

      {/* Page header */}
      <div style={{ marginBottom: "44px", borderBottom: "1px solid rgba(255,107,53,0.08)", paddingBottom: "28px" }}>
        <h1 style={{ color: accent, fontSize: "22px", letterSpacing: "6px", margin: "0 0 6px", textShadow: `0 0 24px ${accent}44` }}>
          KOMUTA MERKEZİ
        </h1>
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", letterSpacing: "2px", margin: 0 }}>
          {new Date().toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "44px" }}>
        {[
          { label: "AKTİF ÖĞRENCİ", value: "2", color: "#39ff14" },
          { label: "TAMAMLANAN GÖREV", value: "5", color: accent },
          { label: "ORT. BAŞARI", value: "%81", color: "#00ffe7" },
          // TOPLAM ÖĞRENCİ kartını veritabanından dönen gerçek eleman sayısına bağladık
          { label: "TOPLAM ÖĞRENCİ", value: students.length.toString(), color: "#ffcc00" },
        ].map((s) => (
          <div key={s.label} style={{
            padding: "20px 22px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.055)",
          }}>
            <p style={{ margin: "0 0 10px", color: "rgba(255,255,255,0.22)", fontSize: "8px", letterSpacing: "2px" }}>
              {s.label}
            </p>
            <p style={{ margin: 0, color: s.color, fontSize: "30px", textShadow: `0 0 14px ${s.color}55` }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── YENİ EKLENEN KISIM: ÖĞRENCİ TAKİBİ LİSTESİ ────────────────── */}
      <div style={{ marginBottom: "44px" }}>
        <h3 style={{ color: "rgba(255,255,255,0.18)", fontSize: "9px", letterSpacing: "3px", marginBottom: "20px" }}>
          ÖĞRENCİ TAKİBİ ({students.length} ÖĞRENCİ KAYITLI)
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {students.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", letterSpacing: "1px" }}>
              Sorumlu olduğunuz sınıflarda kayıtlı öğrenci bulunamadı.
            </p>
          ) : (
            students.map((student) => (
              <div key={student.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 24px", background: "rgba(255,255,255,0.01)",
                border: "1px solid rgba(255,255,255,0.03)", borderRadius: "2px"
              }}>
                <div>
                  <h4 style={{ margin: 0, color: "#fff", fontSize: "13px", letterSpacing: "1px" }}>
                    {student.first_name} {student.last_name}
                  </h4>
                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "9px", letterSpacing: "1px" }}>
                    {student.classroom_code}
                  </span>
                </div>
                
                {/* Durum Göstergesi (Aktif/Offline Işığı) */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ 
                    width: "6px", height: "6px", borderRadius: "50%", 
                    background: "#39ff14", boxShadow: "0 0 8px #39ff14" 
                  }}></span>
                  <span style={{ color: "#39ff14", fontSize: "10px", letterSpacing: "1px" }}>AKTİF</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* ────────────────────────────────────────────────────────────── */}

      {/* Recent activity */}
      <div>
        <h3 style={{ color: "rgba(255,255,255,0.18)", fontSize: "9px", letterSpacing: "3px", marginBottom: "16px", margin: "0 0 16px" }}>
          SON AKTİVİTE
        </h3>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {recentActivity.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "16px",
              padding: "14px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", minWidth: "36px" }}>{item.time}</span>
              <span style={{ color: item.color, fontSize: "10px" }}>▸</span>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "11px", flex: 1 }}>
                <span style={{ color: "#fff" }}>{item.name}</span> — {item.action}
              </span>
              {item.score !== null && (
                <span style={{
                  color: item.score >= 80 ? "#39ff14" : item.score >= 60 ? "#ffcc00" : "#ff4455",
                  fontSize: "14px",
                }}>{item.score}</span>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}