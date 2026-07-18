"use client";

import { useState, useEffect } from "react";
import axios from "axios";

const font = "'Share Tech Mono', monospace";
const accent = "#ff6b35";

interface Classroom {
  id: number;
  name: string | null;
  code: string;
  student_count: number;
}

interface Student {
  id: number;
  name: string;
  email: string;
  zone: string;
  progress: number;
  xp: number;
  status: string;
  score: number;
  total_answers: number;
  correct_answers: number;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  active:  { label: "AKTİF", color: "#39ff14" },
  idle:    { label: "BOŞ", color: "#ffcc00" },
  offline: { label: "OFFLİNE", color: "#ff4455" },
};

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  const selectedStudent = students.find((s) => s.id === selected);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token");
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

        // Sınıfları çek
        const classroomsRes = await axios.get<Classroom[]>(`${apiUrl}/teacher/classrooms`, { headers });
        const classrooms = classroomsRes.data;

        const allStudents: Student[] = [];
        for (const classroom of classrooms) {
          // Her sınıfa ait öğrencileri çek
          const studentsRes = await axios.get<any[]>(
            `${apiUrl}/teacher/classrooms/${classroom.id}/students`,
            { headers }
          );
          for (const s of studentsRes.data) {
            // backend modelini frontend formatına eşle
            const accuracy = s.accuracy ?? 0;
            const total = s.total_answers ?? 0;
            const correct = s.correct_answers ?? 0;
            const isVerified = s.is_verified ?? false;

            let status = "offline";
            if (isVerified) {
              status = total > 0 ? "active" : "idle";
            }

            allStudents.push({
              id: s.id,
              name: `${s.first_name} ${s.last_name}`,
              email: s.email,
              zone: `ZONE 0${s.story_chapter ?? 1}`,
              progress: Math.round(accuracy),
              xp: s.elo_rating ?? 1000,
              status,
              score: Math.round(accuracy),
              total_answers: total,
              correct_answers: correct,
            });
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
        <p style={{ letterSpacing: "3px" }}>ÖĞRENCİ VERİLERİ YÜKLENİYOR...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px 44px", fontFamily: font }}>
      <div style={{ marginBottom: "36px", borderBottom: "1px solid rgba(255,107,53,0.08)", paddingBottom: "24px" }}>
        <h1 style={{ color: accent, fontSize: "20px", letterSpacing: "5px", margin: "0 0 6px" }}>ÖĞRENCİ TAKİBİ</h1>
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", letterSpacing: "2px", margin: 0 }}>
          {students.length} öğrenci kayıtlı · {students.filter(s => s.status === "active").length} aktif
        </p>
      </div>

      <div style={{ display: "flex", gap: "20px" }}>
        {/* List */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
          {students.length === 0 ? (
            <div style={{ padding: "40px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px", letterSpacing: "2px", margin: 0 }}>
                Sınıflarınızda kayıtlı öğrenci bulunamadı.
              </p>
            </div>
          ) : (
            students.map((s) => {
              const st = statusLabel[s.status] || statusLabel.offline;
              const isSel = selected === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelected(isSel ? null : s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "16px",
                    padding: "16px 20px", cursor: "pointer",
                    background: isSel ? "rgba(255,107,53,0.07)" : "rgba(255,255,255,0.02)",
                    border: isSel ? "1px solid rgba(255,107,53,0.25)" : "1px solid rgba(255,255,255,0.05)",
                    borderLeft: isSel ? `2px solid ${accent}` : "2px solid transparent",
                    transition: "all 0.2s",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "50%",
                    border: `1px solid ${st.color}44`,
                    background: `${st.color}08`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: st.color, fontSize: "10px", flexShrink: 0,
                  }}>
                    {s.name.split(" ").map(n => n[0]).join("")}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 2px", color: "#fff", fontSize: "12px", letterSpacing: "1px" }}>{s.name}</p>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.25)", fontSize: "9px", letterSpacing: "1px" }}>{s.zone}</p>
                  </div>

                  {/* Progress mini */}
                  <div style={{ width: "80px" }}>
                    <div style={{ height: "2px", background: "rgba(255,255,255,0.07)" }}>
                      <div style={{
                        height: "100%", width: `${s.progress}%`,
                        background: s.progress > 60 ? "#39ff14" : s.progress > 30 ? "#ffcc00" : "#ff4455",
                      }} />
                    </div>
                    <p style={{ margin: "3px 0 0", color: "rgba(255,255,255,0.25)", fontSize: "8px", textAlign: "right" }}>
                      Doğruluk: {s.progress}%
                    </p>
                  </div>

                  <span style={{ color: st.color, fontSize: "9px", letterSpacing: "1px", minWidth: "52px", textAlign: "right" }}>
                    ● {st.label}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        <div style={{
          width: selectedStudent ? "280px" : "0px",
          overflow: "hidden",
          transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
          flexShrink: 0,
        }}>
          {selectedStudent && (
            <div style={{
              padding: "24px 20px",
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,107,53,0.12)",
              height: "100%",
            }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "50%",
                border: "1px solid rgba(255,107,53,0.3)",
                background: "rgba(255,107,53,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: accent, fontSize: "12px", marginBottom: "16px",
              }}>
                {selectedStudent.name.split(" ").map(n => n[0]).join("")}
              </div>

              <h3 style={{ color: "#fff", fontSize: "14px", letterSpacing: "2px", margin: "0 0 4px" }}>
                {selectedStudent.name}
              </h3>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px", margin: "0 0 20px" }}>
                {selectedStudent.email}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { label: "MEVCUT ZONE", value: selectedStudent.zone, color: "#00ffe7" },
                  { label: "DOĞRULUK ORANI", value: `%${selectedStudent.progress}`, color: "#ffcc00" },
                  { label: "TOPLAM ELO", value: `${selectedStudent.xp} XP`, color: "#ffcc00" },
                  { label: "DOĞRU / TOPLAM CEVAP", value: `${selectedStudent.correct_answers} / ${selectedStudent.total_answers}`, color: selectedStudent.progress >= 60 ? "#39ff14" : "#ff4455" },
                ].map((row) => (
                  <div key={row.label} style={{
                    display: "flex", justifyContent: "space-between",
                    borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px",
                  }}>
                    <span style={{ color: "rgba(255,255,255,0.22)", fontSize: "9px", letterSpacing: "1px" }}>{row.label}</span>
                    <span style={{ color: row.color as string, fontSize: "11px" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}