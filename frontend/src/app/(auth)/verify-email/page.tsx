"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // İlk kutuya otomatik focus
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const handleDigit = (index: number, value: string) => {
    // Sadece tek rakam kabul et
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    // Sonraki kutuya geç
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) {
      setError("Lütfen 6 haneli kodun tamamını gir.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: code }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Doğrulama başarısız.");
        return;
      }

      // ✅ Başarılı
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm text-center">

        {/* İkon */}
        <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl
                        flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor"
            strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25
                 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5
                 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25
                 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36
                 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">E-postanı Doğrula</h1>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          <span className="text-indigo-300 font-medium">{email || "e-posta adresin"}</span>
          {" "}adresine gönderilen 6 haneli kodu gir.
        </p>
        {success ? (
          <div className="bg-emerald-950/50 border border-emerald-700 rounded-xl px-6 py-5 text-emerald-300 text-sm">
            ✅ Hesabın doğrulandı! Giriş sayfasına yönlendiriliyorsun…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OTP kutuları */}
            <div
              className="flex gap-3 justify-center"
              onPaste={handlePaste}
            >
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`
                    w-12 h-14 text-center text-xl font-bold rounded-xl border
                    bg-slate-800 text-white transition-all duration-150
                    focus:outline-none focus:ring-2 focus:ring-indigo-500
                    ${d
                      ? "border-indigo-500 text-indigo-300"
                      : "border-slate-700 placeholder-slate-600"
                    }
                  `}
                />
              ))}
            </div>

            {/* Hata */}
            {error && (
              <p className="text-red-400 text-sm bg-red-950/50 border border-red-800
                            rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            {/* Gönder */}
            <button
              type="submit"
              disabled={loading || digits.join("").length < 6}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500
                         text-white font-semibold text-sm transition-all duration-200
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Doğrulanıyor…" : "Kodu Doğrula"}
            </button>

            {/* Geri dön */}
            <p className="text-slate-500 text-xs">
              Kod gelmedi mi?{" "}
              <a href="/register" className="text-indigo-400 hover:underline">
                Tekrar kayıt ol
              </a>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="text-slate-400 text-sm">Yükleniyor...</div>
      </main>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}