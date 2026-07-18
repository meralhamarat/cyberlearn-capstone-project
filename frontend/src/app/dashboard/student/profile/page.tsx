"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";

const font = "'Share Tech Mono', monospace";

interface Profile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  elo_rating: number;
  total_answers: number;
  correct_answers: number;
  accuracy: number;
  elo_trend: number[];
  rank: number | null;
  class_size: number | null;
}

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 200;
  const h = 48;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const lastColor = data[data.length - 1] >= data[0] ? "#39ff14" : "#ff4455";
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={lastColor}
        strokeWidth="1.5"
        opacity="0.8"
      />
      <circle
        cx={parseFloat(pts[pts.length - 1].split(",")[0])}
        cy={parseFloat(pts[pts.length - 1].split(",")[1])}
        r="3"
        fill={lastColor}
      />
    </svg>
  );
}

/* ─── Avatar seçim dropdown'u ──────────────────────────────────────────────
   Kullanıcı adının yanındaki yuvarlak avatara tıklanınca açılır.
   Avatar listesi buraya genişletilebilir.
*/
const AVATAR_OPTIONS = [
  { id: "warrior-1", label: "SAVAŞÇI 1" },
  { id: "warrior-2", label: "SAVAŞÇI 2" },
];

function AvatarPicker({
  currentAvatar,
  onSelect,
}: {
  currentAvatar: string;
  onSelect: (avatar: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* Dışarı tıklanınca kapat */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = async (avatarId: string) => {
    if (avatarId === currentAvatar) {
      setOpen(false);
      return;
    }
    setSaving(true);
    await onSelect(avatarId);
    setSaving(false);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      {/* ── Yuvarlak avatar butonu ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Avatarı değiştir"
        style={{
          /* Yuvarlak kapsayıcı */
          width: "168px",
          height: "168px",
          borderRadius: "50%" /* tam daire */,
          overflow: "hidden" /* taşanı kes */,
          padding: 0,
          border: open ? "2px solid #00ffe7" : "2px solid rgba(0,255,231,0.35)",
          background: "rgba(0,255,231,0.06)",
          cursor: "pointer",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: open ? "0 0 14px rgba(0,255,231,0.4)" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={`/images/avatars/${currentAvatar}.png`}
          alt="avatar"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top", // ← yüzü üstten hizalar
            display: "block",
          }}
        />
      </button>

      {/* Küçük "değiştir" ipucu */}
      <span
        style={{
          position: "absolute",
          bottom: "-14px",
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(0,255,231,0.5)",
          fontSize: "7px",
          letterSpacing: "1px",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        DEĞİŞTİR
      </span>

      {/* ── Dropdown ── */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 20px)",
            left: "0",
            background: "rgba(6,6,8,0.97)",
            border: "1px solid rgba(0,255,231,0.2)",
            borderRadius: "8px",
            padding: "10px",
            backdropFilter: "blur(12px)",
            zIndex: 50,
            minWidth: "160px",
            fontFamily: font,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          <p
            style={{
              margin: "0 0 10px 4px",
              color: "rgba(255,255,255,0.3)",
              fontSize: "8px",
              letterSpacing: "2px",
            }}
          >
            AVATAR SEÇ
          </p>

          {AVATAR_OPTIONS.map((opt) => {
            const active = currentAvatar === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                disabled={saving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "8px 10px",
                  marginBottom: "4px",
                  background: active ? "rgba(0,255,231,0.12)" : "transparent",
                  border: active
                    ? "1px solid rgba(0,255,231,0.4)"
                    : "1px solid rgba(0,255,231,0.08)",
                  borderRadius: "6px",
                  cursor: saving ? "wait" : "pointer",
                  transition: "all 0.15s",
                  color: active ? "#00ffe7" : "rgba(255,255,255,0.7)",
                  fontSize: "9px",
                  letterSpacing: "1px",
                  fontFamily: font,
                }}
              >
                {/* Küçük ön izleme */}
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    border: active
                      ? "1px solid #00ffe7"
                      : "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <img
                    src={`/images/avatars/${opt.id}.png`}
                    alt={opt.label}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>

                <span style={{ flex: 1, textAlign: "left" }}>{opt.label}</span>
                {active && <span style={{ color: "#00ffe7" }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANA SAYFA
═══════════════════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "leaderboard">("overview");
  const [userAvatar, setUserAvatar] = useState<string>("warrior-1");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") || localStorage.getItem("token")
      : null;

  useEffect(() => {
    if (!token) return;
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const load = async () => {
      try {
        const res = await axios.get<Profile & { avatar?: string }>(
          "http://localhost:8000/student/me/profile",
          config,
        );
        setProfile(res.data);
        if (res.data.avatar) setUserAvatar(res.data.avatar);
      } catch {
        /* hata */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  /* Avatar güncelleme — API çağrısı */
  const handleAvatarChange = async (avatar: string) => {
    if (!token) return;
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(
        "http://localhost:8000/auth/me/avatar",
        { avatar },
        config,
      );
      setUserAvatar(avatar);
      localStorage.setItem("userAvatar", avatar); // ← ekleyin
    } catch (err) {
      console.error("Avatar güncellemesi başarısız:", err);
    }
  };
  if (loading || !profile) {
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
        <p style={{ letterSpacing: "3px" }}>PROFİL VERİSİ YÜKLENİYOR...</p>
      </div>
    );
  }

  const eloPercent = Math.min(
    (((profile.elo_rating || 1000) - 800) / 800) * 100,
    100,
  );
  const isStudent = profile.role === "student";

  return (
    <div
      style={{
        minHeight: "calc(100vh - 58px)",
        fontFamily: font,
        padding: "40px 48px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "20px",
          marginBottom: "48px",
        }}
      >
        {/*
          ── Yuvarlak avatar (tıklanabilir, değiştirme buradan) ──
          Kullanıcı adının hemen solunda, daire içinde aktif avatar gösterilir.
          Tıklanınca avatar seçim dropdown'u açılır.
        */}
        <AvatarPicker
          currentAvatar={userAvatar}
          onSelect={handleAvatarChange}
        />

        {/* İsim + ELO barı */}
        <div style={{ flex: 1, paddingTop: "4px" }}>
          <h1
            style={{
              color: "#00ffe7",
              fontSize: "22px",
              letterSpacing: "5px",
              margin: "0 0 4px",
            }}
          >
            {profile.first_name.toUpperCase()} {profile.last_name.toUpperCase()}
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.25)",
              fontSize: "10px",
              letterSpacing: "3px",
              margin: "0 0 16px",
            }}
          >
            {isStudent && profile.rank
              ? `SIRA #${profile.rank} / ${profile.class_size}`
              : profile.role.toUpperCase()}{" "}
            · {profile.email}
          </p>

          {/* ELO bar */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  color: "rgba(255,255,255,0.25)",
                  fontSize: "9px",
                  letterSpacing: "2px",
                }}
              >
                ELO PUANI
              </span>
              <span style={{ color: "#ffcc00", fontSize: "9px" }}>
                {profile.elo_rating}
              </span>
            </div>
            <div
              style={{
                height: "2px",
                background: "rgba(255,255,255,0.07)",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${eloPercent}%`,
                  background: "linear-gradient(90deg, #00ffe7, #39ff14)",
                  boxShadow: "0 0 8px rgba(0,255,231,0.5)",
                  transition: "width 0.8s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* Hızlı istatistikler */}
        <div style={{ display: "flex", gap: "2px" }}>
          {[
            { label: "DOĞRULUK", value: `%${profile.accuracy || 0}` },
            { label: "TOPLAM", value: `${profile.total_answers || 0}` },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "16px 20px",
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: "0 0 6px",
                  color: "rgba(255,255,255,0.25)",
                  fontSize: "8px",
                  letterSpacing: "2px",
                }}
              >
                {s.label}
              </p>
              <p style={{ margin: 0, color: "#00ffe7", fontSize: "20px" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Tab bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          marginBottom: "32px",
        }}
      >
        {[
          { key: "overview" as const, label: "GENEL BAKIŞ" },
          ...(isStudent
            ? [{ key: "leaderboard" as const, label: "SINIF SIRALAMASI" }]
            : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom:
                tab === t.key ? "1px solid #00ffe7" : "1px solid transparent",
              color: tab === t.key ? "#00ffe7" : "rgba(255,255,255,0.25)",
              padding: "10px 24px",
              fontSize: "10px",
              letterSpacing: "2px",
              cursor: "pointer",
              fontFamily: font,
              transition: "all 0.2s",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW ────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            {[
              {
                label: "ELO PUANI",
                value: (profile.elo_rating || 0).toString(),
                color: "#ffcc00",
              },
              {
                label: "DOĞRULUK ORANI",
                value: `%${profile.accuracy || 0}`,
                color: "#39ff14",
              },
              {
                label: "TOPLAM CEVAP",
                value: (profile.total_answers || 0).toString(),
                color: "#00ffe7",
              },
              {
                label: "DOĞRU CEVAP",
                value: (profile.correct_answers || 0).toString(),
                color: "#ff6b35",
              },
              ...(isStudent && profile.rank
                ? [
                    {
                      label: "SINIF SIRALAMASI",
                      value: `#${profile.rank} / ${profile.class_size}`,
                      color: "#bc13fe",
                    },
                  ]
                : []),
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "20px 24px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    color: "rgba(255,255,255,0.25)",
                    fontSize: "9px",
                    letterSpacing: "2px",
                  }}
                >
                  {item.label}
                </p>
                <p style={{ margin: 0, color: item.color, fontSize: "24px" }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {(profile.elo_trend?.length || 0) > 1 && (
            <div
              style={{
                padding: "20px 24px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                style={{
                  margin: "0 0 16px",
                  color: "rgba(255,255,255,0.25)",
                  fontSize: "9px",
                  letterSpacing: "3px",
                }}
              >
                ELO TRENDİ (SON {profile.elo_trend.length} HAMLE)
              </p>
              <MiniSparkline data={profile.elo_trend} />
            </div>
          )}

          {profile.total_answers === 0 && (
            <div
              style={{
                padding: "40px",
                background: "rgba(255,255,255,0.01)",
                border: "1px solid rgba(255,255,255,0.04)",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  color: "rgba(255,255,255,0.2)",
                  fontSize: "12px",
                  letterSpacing: "2px",
                  margin: 0,
                }}
              >
                Henüz hiç soru cevaplamadınız. Haritadan bir quiz seçin!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── LEADERBOARD ─────────────────────────────────────────────────── */}
      {tab === "leaderboard" && isStudent && (
        <div>
          {profile.rank && profile.class_size ? (
            <>
              <div
                style={{
                  padding: "24px",
                  background: "rgba(0,255,231,0.04)",
                  border: "1px solid rgba(0,255,231,0.15)",
                  marginBottom: "24px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    color: "rgba(255,255,255,0.3)",
                    fontSize: "9px",
                    letterSpacing: "3px",
                  }}
                >
                  SINIF SIRALAMASI
                </p>
                <p
                  style={{
                    margin: 0,
                    color: "#00ffe7",
                    fontSize: "40px",
                    letterSpacing: "4px",
                  }}
                >
                  #{profile.rank}
                </p>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "rgba(255,255,255,0.3)",
                    fontSize: "10px",
                    letterSpacing: "2px",
                  }}
                >
                  {profile.class_size} öğrenci içinde · ELO {profile.elo_rating}
                </p>
              </div>

              <div
                style={{
                  padding: "20px 24px",
                  background: "rgba(255,255,255,0.01)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <p
                  style={{
                    color: "rgba(255,255,255,0.2)",
                    fontSize: "11px",
                    letterSpacing: "2px",
                    margin: 0,
                    textAlign: "center",
                  }}
                >
                  Tüm sınıf sıralamasını görmek için öğretmeninizle iletişime
                  geçin.
                </p>
              </div>
            </>
          ) : (
            <p
              style={{
                color: "rgba(255,255,255,0.2)",
                fontSize: "12px",
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              Sıralama verisi henüz mevcut değil.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
