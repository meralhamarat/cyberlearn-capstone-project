"""
NarrativeService — Elo eşiği geçilince Gemini ile kişisel hikaye üretir.

Jüriye anlatım:
  Elo puanı artık sadece bir sayı değil — öğrencinin
  hikaye içindeki 'güç seviyesini' temsil ediyor.
  Gemini bu bağlamı alıp dramatik, kişiselleştirilmiş
  bir anlatı üretiyor.
"""
import os
from dotenv import load_dotenv

load_dotenv()

_gemini_client = None


def _get_client():
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY tanımlı değil")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


class NarrativeService:

    def generate_story_update(
        self,
        username: str,
        new_elo: int,
        base_message: str,
    ) -> str:
        """
        Elo eşiği geçilince Gemini'ye kişiselleştirilmiş mesaj ürettir.

        Args:
            username:     Öğrencinin adı
            new_elo:      Yeni Elo puanı
            base_message: EloService'in ürettiği temel mesaj

        Returns:
            Gemini'nin ürettiği 1-2 cümlelik dramatik narrative
        """

        prompt = f"""Sen bir siberpunk direnişinin yapay zeka komutanısın.
Öğrencinin adı: {username}
Mevcut zihinsel güç seviyesi (Elo): {new_elo}
Sistem mesajı: "{base_message}"

Bu mesajı 1-2 cümle olarak yeniden yaz:
- Kişisel hitap et ({username} adını kullan)
- Askeri brifing tonu + siberpunk atmosfer
- Motivasyonu yüksek, dramatik
- Türkçe yaz
- Sadece mesajı yaz, açıklama ekleme"""

        try:
            from google.genai import types
            client = _get_client()
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.85,
                    max_output_tokens=200,
                ),
            )
            return response.text.strip()

        except Exception as e:
            # Gemini başarısız olursa base_message'ı kullan — uygulama çökmez
            print(f"[NarrativeService] Gemini hatası: {e}")
            return base_message

    def generate_teacher_insight(
        self,
        student_name: str,
        elo_history: list[int],
        velocity: float,
    ) -> str:
        """
        Öğretmen dashboard'u için öğrencinin öğrenme analizi.
        Öğretmene savaş haritasında gösterilecek Gemini yorumu.
        """

        trend = "yükseliyor" if velocity > 0 else "düşüyor"

        prompt = f"""Sen bir siberpunk eğitim komutanısın. Kısa analiz üretirsin.

Öğrenci adı: {student_name}
Elo geçmişi (son 5): {elo_history[-5:]}
Ortalama öğrenme hızı: {velocity} puan/hamle ({trend})

Bu öğrenciyi 1 cümleyle değerlendir. Askeri brifing tonu, Türkçe."""

        try:
            from google.genai import types
            client = _get_client()
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=100,
                ),
            )
            return response.text.strip()
        except Exception as e:
            print(f"[NarrativeService] Teacher insight hatası: {e}")
            return f"{student_name} — Analiz verisi işleniyor..."