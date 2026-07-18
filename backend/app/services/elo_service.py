"""
EloService — Siberpunk Eğitim Platformu'nun kalbi.

Jüriye anlatım:
  E  = 1 / (1 + 10^((Qelo - Pelo) / 400))  → beklenen başarı olasılığı
  Δ  = K × (gerçek − beklenen)              → puan değişimi

Gelişmiş faktörler:
  - Çözme süresi: Ortalamadan hızlı → K büyür (çok iyi biliyor)
                   Ortalamadan yavaş → K küçülür (zorlandı)
  - İpucu kullanımı: Hint açıldıysa maksimum kazanılabilecek ELO %40 azalır
  - Üst üste 3 başarısız: Motivasyon sorusu tetiklenir (başarı olasılığı ~%80)
"""

from typing import Optional, Tuple


# Zorluk seviyesine göre beklenen ortalama çözme süresi (saniye)
EXPECTED_SOLVE_TIME = {
    "kolay": 20,   # ELO <= 900
    "orta": 40,    # ELO 901-1100
    "zor": 70,     # ELO > 1100
}


def _difficulty_level(question_elo: int) -> str:
    if question_elo <= 900:
        return "kolay"
    if question_elo <= 1100:
        return "orta"
    return "zor"


class EloService:

    # ── K-FAKTÖRÜ ─────────────────────────────────────────────────────────
    def k_factor(self, elo: int) -> int:
        """
        Yeni öğrenciler (düşük Elo) büyük adımlarla ilerler.
        Deneyimliler (yüksek Elo) sistemi stabilize eder.
        """
        if elo < 1200:
            return 40   # Hızlı adaptasyon
        if elo < 1600:
            return 20   # Orta seviye
        return 10       # Elit — yavaş ama hassas

    # ── BEKLENEN SKOR ─────────────────────────────────────────────────────
    def expected_score(self, player_elo: int, question_elo: int) -> float:
        """
        Öğrencinin bu soruyu doğru çözme olasılığı.
        Örnek: player=1000, question=1200 → E ≈ 0.24 (%24 şans)
        """
        return 1 / (1 + 10 ** ((question_elo - player_elo) / 400))

    # ── ZAMAN FAKTÖRÜ ─────────────────────────────────────────────────────
    def time_multiplier(self, solve_time_seconds: Optional[int], question_elo: int) -> float:
        """
        Çözme süresine göre K faktörü çarpanı hesaplar.

        - Ortalama sürenin %50'sinden hızlı çözme → 1.4x (çok iyi biliyor)
        - Ortalama süre civarı (±%50) → 1.0x (normal)
        - Ortalama sürenin 2 katından yavaş → 0.6x (zorlandı)

        Returns: float çarpan (0.6 - 1.4 arası)
        """
        if not solve_time_seconds or solve_time_seconds <= 0:
            return 1.0

        difficulty = _difficulty_level(question_elo)
        avg_time = EXPECTED_SOLVE_TIME[difficulty]

        ratio = solve_time_seconds / avg_time

        if ratio < 0.5:
            return 1.4   # Çok hızlı → büyük ödül
        elif ratio < 1.5:
            return 1.0   # Normal süre
        elif ratio < 2.5:
            return 0.8   # Biraz yavaş
        else:
            return 0.6   # Çok yavaş → küçük değişim

    # ── GELİŞMİŞ ELO GÜNCELLEME ──────────────────────────────────────────
    def calculate_new_elo(
        self,
        player_elo: int,
        question_elo: int,
        correct: bool,
        solve_time_seconds: Optional[int] = None,
        hint_used: bool = False,
    ) -> Tuple[int, int]:
        """
        Cevap sonrası yeni Elo ve delta değerini döndürür.

        Faktörler:
        - correct: Doğru/yanlış
        - solve_time_seconds: Çözme süresi (saniye) — hızlı çözene bonus
        - hint_used: İpucu kullandıysa maksimum kazanç %40 azalır

        Returns: (new_elo, delta)
        """
        expected = self.expected_score(player_elo, question_elo)
        actual = 1.0 if correct else 0.0
        k = self.k_factor(player_elo)

        # Zaman çarpanı uygula
        time_mult = self.time_multiplier(solve_time_seconds, question_elo)
        k_adjusted = k * time_mult

        # Ham delta
        raw_delta = k_adjusted * (actual - expected)

        # İpucu kullanıldıysa kazanılabilecek maksimum ELO ödülünü %40 azalt
        # (sadece doğru cevaplarda negatif etkisi olur — yanlış cevapta zaten kayıp var)
        if hint_used and correct:
            raw_delta *= 0.6  # %40 azalt → %60 oranıyla al

        delta = round(raw_delta)
        new_elo = max(700, player_elo + delta)   # Minimum taban: 700
        return new_elo, delta

    # ── MOTİVASYON SORUSU KONTROLÜ ────────────────────────────────────────
    def should_trigger_motivation(self, consecutive_failures: int) -> bool:
        """
        Üst üste 3 veya daha fazla başarısız cevap sonrasında
        motivasyon sorusu tetiklenmeli mi?
        """
        return consecutive_failures >= 3

    def motivation_question_elo_target(self, player_elo: int) -> int:
        """
        Motivasyon sorusu için hedef ELO aralığı.
        Öğrencinin mevcut ELO'sundan 200 puan düşük → başarı olasılığı ~%80
        """
        return max(700, player_elo - 200)

    # ── HİKAYE EŞIK KONTROLÜ ──────────────────────────────────────────────
    def check_story_threshold(
        self, old_elo: int, new_elo: int
    ) -> Optional[str]:
        """
        Öğrenci bir Elo eşiğini geçtiyse hikaye mesajı döndür.
        Bu mesaj NarrativeService tarafından GPT ile zenginleştirilir.
        """
        thresholds = {
            1000: "Hafızan güçleniyor. Robotların zihin kontrolü zayıflıyor...",
            1200: "Direnişçiler seni fark etti. Ağa kabul edildin.",
            1400: "Siber savunma protokollerin aktif. Düşman saldırıları %40 azaldı.",
            1600: "ELİT SEVİYE. Komuta merkezine erişim açıldı.",
            1800: "Sistem sana boyun eğiyor. Final savaşı yakın.",
        }
        for threshold, message in thresholds.items():
            if old_elo < threshold <= new_elo:
                return message
        return None

    # ── ÖĞRENME HIZI ANALİZİ (jüri için) ─────────────────────────────────
    def learning_velocity(self, elo_history: list[int]) -> float:
        """
        Son N hamledeki ortalama Elo artışı — öğrenme hızı metriği.
        Öğretmen dashboard'unda gösterilir.
        """
        if len(elo_history) < 2:
            return 0.0
        deltas = [elo_history[i] - elo_history[i - 1] for i in range(1, len(elo_history))]
        return round(sum(deltas) / len(deltas), 2)