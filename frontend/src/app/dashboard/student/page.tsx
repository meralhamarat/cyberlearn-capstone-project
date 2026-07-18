"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import GameOverlay from "./GameOverlay";

const font = "'Share Tech Mono', monospace";

const diffColor: Record<string, string> = {
  KOLAY: "#39ff14",
  ORTA: "#ffcc00",
  ZOR: "#ff6b35",
  UZMAN: "#ff4455",
};

function eloToDiff(elo: number): string {
  if (elo <= 900) return "KOLAY";
  if (elo <= 1100) return "ORTA";
  if (elo <= 1300) return "ZOR";
  return "UZMAN";
}

interface Question {
  id: number;
  text: string;
  options: string[];
  elo_rating: number;
}

interface Mission {
  id: number;
  title: string;
  reading_time_seconds: number;
  story_text: string | null;
  x: number;
  y: number;
  zone: string;
  questions: Question[];
}

export default function StudentMapPage() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [userName, setUserName] = useState("SİBER SAVAŞÇI");
  const [userElo, setUserElo] = useState<number>(1000);
  const [userAvatar, setUserAvatar] = useState<string>(
    typeof window !== "undefined"
      ? localStorage.getItem("userAvatar") || "warrior-1"
      : "warrior-1",
  );
  const [loading, setLoading] = useState(true);
  const [gameMode, setGameMode] = useState(false);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") || localStorage.getItem("token")
      : null;

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const fetchData = async () => {
      try {
        try {
          const userRes = await axios.get(
            "http://localhost:8000/auth/me",
            config,
          );
          setUserName(userRes.data.first_name.toUpperCase());
          setUserElo(userRes.data.elo_rating);
          setUserAvatar(userRes.data.avatar || "warrior-1");
          localStorage.setItem(
            "userAvatar",
            userRes.data.avatar || "warrior-1",
          );
        } catch {
          /* varsayılan */
        }

        try {
          const missionRes = await axios.get<Mission[]>(
            "http://localhost:8000/student/me/missions",
            config,
          );
          setMissions(missionRes.data);
        } catch {
          /* boş harita */
        }
      } catch {
        console.error("Veri çekme hatası");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router, token]);

  const selectedMission = missions.find((m) => m.id === selected);

  const closePanel = () => {
    setSelected(null);
    setGameMode(false);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "calc(100vh - 58px)",
          background: "#060608",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: font,
          color: "#00ffe7",
        }}
      >
        <p style={{ letterSpacing: "3px" }}>
          SİSTEM YÜKLENİYOR... SINIF VERİSİ ALINIYOR...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 58px)",
        position: "relative",
        overflow: "hidden",
        background: "#060608",
      }}
    >
      {/* Harita arka planı */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/images/world-map.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.4,
          filter: "contrast(1.2) brightness(0.8)",
          zIndex: 0,
        }}
      />

      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(0,255,231,0.06) 0%, transparent 75%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Kullanıcı bilgi paneli */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          zIndex: 3,
          fontFamily: font,
          borderLeft: "3px solid #00ffe7",
          paddingLeft: "10px",
        }}
      >
        <span
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: "10px",
            letterSpacing: "2px",
          }}
        >
          SINIF AĞINA BAĞLANILDI
        </span>
        <h3
          style={{
            color: "#fff",
            margin: 0,
            fontSize: "16px",
            letterSpacing: "2px",
          }}
        >
          OPERATÖR: {userName}
        </h3>
        <span
          style={{ color: "#00ffe7", fontSize: "10px", letterSpacing: "1px" }}
        >
          ELO: {userElo}
        </span>
      </div>

      {/* ─── Avatar────── */}

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "24px",
          zIndex: 4,
          display: "flex",
          alignItems: "flex-end" /* bacaklar alt çizgiye yapışık */,
        }}
      >
        <img
          src={`/images/avatars/${userAvatar}.png`}
          alt="aktif avatar"
          style={{
            width: "auto",
            height: "350px" /* 80px × 3 */,
            display: "block",
            border: "none" /* border yok */,
            background: "transparent",
            filter:
              "drop-shadow(0 0 10px #00ffe7) drop-shadow(0 0 22px #00ffe7)",
            /* PNG vücut hatlarını sarar */
            userSelect: "none",
            pointerEvents: "none" /* tıklanamaz */,
          }}
        />
      </div>

      {/* Ana içerik */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "calc(100vh - 58px)",
          display: "flex",
          alignItems: "stretch",
          zIndex: 2,
        }}
      >
        {/* Harita alanı */}
        <div style={{ flex: 1, position: "relative" }}>
          {/* Mission bağlantı çizgileri */}
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            {missions.slice(0, -1).map((m, i) => {
              const next = missions[i + 1];
              return (
                <line
                  key={m.id}
                  x1={`${m.x}%`}
                  y1={`${m.y}%`}
                  x2={`${next.x}%`}
                  y2={`${next.y}%`}
                  stroke="rgba(0,255,231,0.2)"
                  strokeWidth="1.5"
                  strokeDasharray="6 5"
                />
              );
            })}
          </svg>

          {/* Boş harita mesajı */}
          {missions.length === 0 && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  color: "rgba(255,255,255,0.2)",
                  fontSize: "13px",
                  letterSpacing: "3px",
                }}
              >
                SINIFIN İÇİN HENÜZ SORU YOK
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.1)",
                  fontSize: "10px",
                  letterSpacing: "2px",
                }}
              >
                Öğretmeniniz PDF doküman yükleyince quizler burada belirecek
              </p>
            </div>
          )}

          {/* Mission node'ları */}
          {missions.map((m) => {
            const avgElo =
              m.questions.length > 0 ? m.questions[0].elo_rating : 1000;
            const diff = eloToDiff(avgElo);
            const color = diffColor[diff];
            const isHov = hovered === m.id;
            const isSel = selected === m.id;

            return (
              <div
                key={m.id}
                id={`mission-node-${m.id}`}
                onMouseEnter={() => setHovered(m.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  setSelected(isSel ? null : m.id);
                  setGameMode(false);
                }}
                style={{
                  position: "absolute",
                  left: `${m.x}%`,
                  top: `${m.y}%`,
                  transform: "translate(-50%, -50%)",
                  cursor: "pointer",
                  zIndex: isSel ? 10 : isHov ? 8 : 5,
                  transition: "all 0.25s",
                }}
              >
                {isSel && (
                  <div
                    style={{
                      position: "absolute",
                      inset: "-14px",
                      borderRadius: "50%",
                      border: `1px solid ${color}`,
                      opacity: 0.4,
                      animation: "pulse 2s infinite",
                    }}
                  />
                )}

                <div
                  style={{
                    width: isSel ? "68px" : isHov ? "62px" : "54px",
                    height: isSel ? "68px" : isHov ? "62px" : "54px",
                    borderRadius: "50%",
                    border: `1px solid ${isSel || isHov ? color : color + "88"}`,
                    background: isSel
                      ? `radial-gradient(circle, ${color}22 0%, rgba(6,6,8,0.9) 70%)`
                      : "rgba(6,6,8,0.85)",
                    boxShadow:
                      isHov || isSel
                        ? `0 0 24px ${color}66, 0 0 8px ${color}44`
                        : "none",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.25s",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span style={{ color, fontSize: "16px", lineHeight: 1 }}>
                    ▶
                  </span>
                  <span
                    style={{
                      color,
                      fontSize: "7px",
                      letterSpacing: "1px",
                      marginTop: "3px",
                      opacity: 0.7,
                    }}
                  >
                    {m.zone}
                  </span>
                </div>

                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    opacity: isHov || isSel ? 1 : 0.5,
                    transition: "opacity 0.2s",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color,
                      fontSize: "8px",
                      letterSpacing: "2px",
                    }}
                  >
                    {m.zone}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      color: diffColor[diff],
                      fontSize: "8px",
                      letterSpacing: "1px",
                    }}
                  >
                    {m.questions.length} SORU
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sağ panel — Görev Detayı */}
        <div
          style={{
            width: selectedMission && !gameMode ? "360px" : "0px",
            overflow: "hidden",
            transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)",
            borderLeft: selectedMission
              ? "1px solid rgba(0,255,231,0.1)"
              : "none",
            background: "rgba(6,6,8,0.95)",
            backdropFilter: "blur(20px)",
            flexShrink: 0,
          }}
        >
          {selectedMission && !gameMode && (
            <div
              style={{
                padding: "36px 28px",
                fontFamily: font,
                height: "100%",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <button
                onClick={closePanel}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.25)",
                  fontSize: "18px",
                  cursor: "pointer",
                  marginBottom: "24px",
                  alignSelf: "flex-start",
                  fontFamily: font,
                }}
              >
                ✕
              </button>

              <span
                style={{
                  fontSize: "8px",
                  letterSpacing: "3px",
                  color: "rgba(0,255,231,0.6)",
                  border: "1px solid rgba(0,255,231,0.15)",
                  padding: "3px 10px",
                  background: "rgba(0,255,231,0.04)",
                  alignSelf: "flex-start",
                }}
              >
                {selectedMission.zone}
              </span>

              <h2
                style={{
                  color: "#fff",
                  fontSize: "20px",
                  letterSpacing: "2px",
                  marginTop: "16px",
                  marginBottom: "8px",
                }}
              >
                {selectedMission.title}
              </h2>

              <p
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  marginBottom: "30px",
                }}
              >
                Görev tespit edildi. İlgili dosyalar şifrelenmiş halde.{" "}
                {selectedMission.questions.length} veri bloğu (soru) içeriyor.
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  padding: "15px 0",
                  marginBottom: "40px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: "1px",
                    }}
                  >
                    OKUMA SÜRESİ
                  </div>
                  <div style={{ fontSize: "14px", color: "#00ffe7" }}>
                    {selectedMission.reading_time_seconds} SN
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: "1px",
                    }}
                  >
                    SORU SAYISI
                  </div>
                  <div style={{ fontSize: "14px", color: "#ff6b35" }}>
                    {selectedMission.questions.length} ADET
                  </div>
                </div>
              </div>

              <button
                onClick={() => setGameMode(true)}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "#00ffe7",
                  border: "none",
                  color: "#000",
                  fontWeight: "bold",
                  fontSize: "14px",
                  letterSpacing: "4px",
                  cursor: "pointer",
                  fontFamily: font,
                  boxShadow: "0 0 20px rgba(0,255,231,0.3)",
                  transition: "all 0.2s",
                }}
              >
                GÖREVE BAŞLA →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Oyun Modu */}
      {gameMode && selectedMission && token && (
        <GameOverlay
          mission={selectedMission}
          token={token}
          onClose={closePanel}
          onComplete={(totalDelta) => {
            setUserElo((prev) => prev + totalDelta);
          }}
        />
      )}
    </div>
  );
}
