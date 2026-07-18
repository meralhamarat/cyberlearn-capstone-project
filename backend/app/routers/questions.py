import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.database import get_db
from app.models.db_models import User, Question, EloHistory, StoryProgress
from app.models.schemas import QuestionResponse, AnswerRequest, AnswerResponse
from app.services.elo_service import EloService
from app.services.narrative_service import NarrativeService

router      = APIRouter()
elo_svc     = EloService()
narrative   = NarrativeService()


# ─── SONRAKI SORU ─────────────────────────────────────────────────────────────

@router.get("/next/{user_id}", response_model=QuestionResponse)
async def get_next_question(user_id: int, db: AsyncSession = Depends(get_db)):
    """
    Öğrencinin Elo puanına göre uygun zorlukta soru getir.
    Optimal Challenge Zone: player_elo ± 150 bant.
    """
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    question_res = await db.execute(
        select(Question)
        .where(
            Question.elo_rating >= user.elo_rating - 150,
            Question.elo_rating <= user.elo_rating + 150,
        )
        .order_by(func.random())
    )
    question = question_res.scalar_one_or_none()

    # Bantta soru yoksa tüm havuzdan rastgele ver
    if not question:
        fallback_res = await db.execute(select(Question).order_by(func.random()))
        question = fallback_res.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=404, detail="Soru bulunamadı. Seed çalıştırıldı mı?")

    return QuestionResponse(
        id=question.id,
        text=question.text,
        options=json.loads(question.options),
        elo_rating=question.elo_rating,
    )


# ─── CEVAP DEĞERLENDİR ───────────────────────────────────────────────────────

@router.post("/answer", response_model=AnswerResponse)
async def submit_answer(body: AnswerRequest, db: AsyncSession = Depends(get_db)):
    """
    1. Cevabı kontrol et
    2. Elo'yu güncelle (EloService)
    3. Hikaye eşiğini kontrol et
    4. Eşik geçildiyse GPT narrative üret (NarrativeService)
    5. Tümünü döndür
    """
    u_res = await db.execute(select(User).where(User.id == body.user_id))
    user = u_res.scalar_one_or_none()
    q_res = await db.execute(select(Question).where(Question.id == body.question_id))
    question = q_res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    if not question:
        raise HTTPException(status_code=404, detail="Soru bulunamadı.")

    # Cevap doğruluğu
    correct  = (question.correct_answer.strip().lower() == body.answer.strip().lower())
    old_elo  = user.elo_rating

    # Elo hesapla
    new_elo, delta = elo_svc.calculate_new_elo(old_elo, question.elo_rating, correct)

    # DB güncelle
    user.elo_rating = new_elo
    db.add(EloHistory(
        user_id=user.id,
        elo_after=new_elo,
        delta=delta,
        correct=correct,
    ))
    await db.commit()

    # Hikaye eşik kontrolü
    base_message  = elo_svc.check_story_threshold(old_elo, new_elo)
    story_message = None

    if base_message:
        # GPT ile kişiselleştir
        story_message = narrative.generate_story_update(
            username=f"{user.first_name} {user.last_name}",
            new_elo=new_elo,
            base_message=base_message,
        )
        # Hikaye ilerlemesini kaydet
        db.add(StoryProgress(
            user_id=user.id,
            chapter=new_elo,
            message=story_message,
        ))
        user.story_chapter += 1
        await db.commit()

    return AnswerResponse(
        correct=correct,
        old_elo=old_elo,
        new_elo=new_elo,
        delta=delta,
        story_message=story_message,
    )


# ─── SORU SEED (geliştirme) ──────────────────────────────────────────────────

@router.post("/seed", tags=["Dev"])
async def seed_questions(db: AsyncSession = Depends(get_db)):
    """
    Veritabanına örnek sorular ekle.
    Sadece geliştirme aşamasında kullan: POST /api/questions/seed
    """
    count_res = await db.execute(select(func.count(Question.id)))
    if count_res.scalar() > 0:
        return {"message": "Sorular zaten mevcut."}

    sample_questions = [
        {
            "text": "Python'da bir listedeki tekrar eden elemanları kaldırmak için en Pythonic yöntem nedir?",
            "options": json.dumps(["list(set(lst))", "lst.remove_duplicates()", "filter(lst)", "lst.unique()"]),
            "correct_answer": "list(set(lst))",
            "elo_rating": 950,
            "subject": "python",
        },
        {
            "text": "Big-O notasyonunda binary search'ün zaman karmaşıklığı nedir?",
            "options": json.dumps(["O(n)", "O(log n)", "O(n²)", "O(1)"]),
            "correct_answer": "O(log n)",
            "elo_rating": 1100,
            "subject": "algorithms",
        },
        {
            "text": "REST API'de idempotent olmayan HTTP metodu hangisidir?",
            "options": json.dumps(["GET", "PUT", "DELETE", "POST"]),
            "correct_answer": "POST",
            "elo_rating": 1250,
            "subject": "web",
        },
        {
            "text": "SQL'de LEFT JOIN ile INNER JOIN arasındaki temel fark nedir?",
            "options": json.dumps([
                "LEFT JOIN eşleşmeyenleri de getirir",
                "INNER JOIN daha hızlıdır",
                "LEFT JOIN sadece sol tabloyu döndürür",
                "Fark yoktur"
            ]),
            "correct_answer": "LEFT JOIN eşleşmeyenleri de getirir",
            "elo_rating": 1050,
            "subject": "database",
        },
        {
            "text": "Bir binary tree'nin height'ı O(log n) olan yapısı hangisidir?",
            "options": json.dumps(["Balanced BST", "Linked List", "Min Heap", "Hash Table"]),
            "correct_answer": "Balanced BST",
            "elo_rating": 1400,
            "subject": "algorithms",
        },
        {
            "text": "FastAPI'de async endpoint yazmanın avantajı nedir?",
            "options": json.dumps([
                "I/O beklerken diğer istekleri işleyebilir",
                "Daha az RAM kullanır",
                "Otomatik cache sağlar",
                "Type checking yapar"
            ]),
            "correct_answer": "I/O beklerken diğer istekleri işleyebilir",
            "elo_rating": 1300,
            "subject": "fastapi",
        },
    ]

    for q in sample_questions:
        db.add(Question(**q))
    await db.commit()

    return {"message": f"{len(sample_questions)} soru eklendi.", "count": len(sample_questions)}