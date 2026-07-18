import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.db_models import User, Classroom, Question, EloHistory
from app.services.jwt_service import get_current_user

router = APIRouter(prefix="/student", tags=["student"])


def require_student(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Bu alana sadece öğrenciler erişebilir.")
    return current_user


@router.get("/me/classroom")
async def get_my_classroom(
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.classroom_id:
        raise HTTPException(status_code=404, detail="Henüz bir sınıfa atanmadınız.")

    result = await db.execute(select(Classroom).where(Classroom.id == current_user.classroom_id))
    classroom = result.scalar_one_or_none()
    if not classroom:
        raise HTTPException(status_code=404, detail="Sınıf bulunamadı.")

    return {"id": classroom.id, "name": classroom.name, "code": classroom.code}


@router.get("/me/quizzes")
async def get_my_quizzes(
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Öğrencinin sınıfına ait, öğretmen tarafından onaylanmış sorular.
    Harita üzerinde quiz node'ları olarak gösterilir.
    """
    if not current_user.classroom_id:
        raise HTTPException(status_code=404, detail="Henüz bir sınıfa atanmadınız.")

    result = await db.execute(
        select(Question)
        .where(
            Question.classroom_id == current_user.classroom_id,
            Question.is_approved == True,
        )
        .order_by(Question.elo_rating)
    )
    questions = result.scalars().all()

    # Harita pozisyonlarını elo'ya göre dağıt
    positions = [
        {"x": 18, "y": 35}, {"x": 35, "y": 55}, {"x": 52, "y": 28},
        {"x": 68, "y": 60}, {"x": 82, "y": 32}, {"x": 25, "y": 70},
        {"x": 45, "y": 45}, {"x": 72, "y": 20}, {"x": 88, "y": 55},
        {"x": 58, "y": 75},
    ]

    out = []
    for i, q in enumerate(questions):
        pos = positions[i % len(positions)]
        out.append({
            "id": q.id,
            "text": q.text,
            "options": json.loads(q.options),
            "elo_rating": q.elo_rating,
            "x": pos["x"],
            "y": pos["y"],
            "zone": f"ZONE-{i + 1:02d}",
        })

    return out


@router.get("/me/missions")
async def get_my_missions(
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Haritada her bölge bir görevi (Document) temsil edecek.
    İçerisinde okuma süresi, story text ve o dokümana ait soruları dönecek.
    """
    from app.models.db_models import Document
    if not current_user.classroom_id:
        raise HTTPException(status_code=404, detail="Henüz bir sınıfa atanmadınız.")

    # Sınıfa ait ve gpt_status="done" olan dokümanlar
    docs_result = await db.execute(
        select(Document)
        .where(
            Document.classroom_id == current_user.classroom_id,
            Document.gpt_status == "done"
        )
        .order_by(Document.uploaded_at)
    )
    documents = docs_result.scalars().all()

    # Harita pozisyonları
    positions = [
        {"x": 18, "y": 35}, {"x": 35, "y": 55}, {"x": 52, "y": 28},
        {"x": 68, "y": 60}, {"x": 82, "y": 32}, {"x": 25, "y": 70},
        {"x": 45, "y": 45}, {"x": 72, "y": 20}, {"x": 88, "y": 55},
        {"x": 58, "y": 75},
    ]

    out = []
    for i, doc in enumerate(documents):
        # Bu dokümana ait tüm soruları çek (onay durumu fark etmeksizin)
        q_result = await db.execute(
            select(Question)
            .where(
                Question.document_id == doc.id
            )
            .order_by(Question.elo_rating)
        )
        questions = q_result.scalars().all()
        
        # Eğer soru yoksa bu dokümanı haritada gösterme
        if not questions:
            continue

        pos = positions[len(out) % len(positions)]
        
        out.append({
            "id": doc.id,
            "title": doc.original_name.replace(".pdf", "").replace(".PDF", ""),
            "reading_time_seconds": doc.reading_time_seconds or 90,
            "story_text": doc.story_text,
            "x": pos["x"],
            "y": pos["y"],
            "zone": f"ZONE-{len(out) + 1:02d}",
            "questions": [
                {
                    "id": q.id,
                    "text": q.text,
                    "options": json.loads(q.options),
                    "elo_rating": q.elo_rating,
                }
                for q in questions
            ]
        })

    return out
@router.get("/me/profile")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Öğrenci profili: kişisel bilgi + elo geçmişi + sınıf sıralaması.
    Admin ve öğretmen de bu endpoint'i erişebilir (kendi profilleri için).
    """
    # ELO geçmişi
    history_result = await db.execute(
        select(EloHistory)
        .where(EloHistory.user_id == current_user.id)
        .order_by(EloHistory.created_at)
    )
    history = history_result.scalars().all()

    total = len(history)
    correct = sum(1 for h in history if h.correct)
    elo_trend = [h.elo_after for h in history[-20:]]  # Son 20 hamle

    # Sınıf sıralaması (sadece öğrenciler için)
    rank = None
    class_size = None
    if current_user.role == "student" and current_user.classroom_id:
        # Aynı sınıftaki öğrencileri ELO'ya göre sırala
        classmates_result = await db.execute(
            select(User.id, User.elo_rating)
            .where(
                User.classroom_id == current_user.classroom_id,
                User.role == "student",
            )
            .order_by(User.elo_rating.desc())
        )
        classmates = classmates_result.all()
        class_size = len(classmates)
        for i, (uid, _) in enumerate(classmates):
            if uid == current_user.id:
                rank = i + 1
                break

    return {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "role": current_user.role,
        "elo_rating": current_user.elo_rating,
        "total_answers": total,
        "correct_answers": correct,
        "accuracy": round(correct / total * 100, 1) if total > 0 else 0,
        "elo_trend": elo_trend,
        "rank": rank,
        "class_size": class_size,
    }


@router.post("/me/answer")
async def submit_quiz_answer(
    body: dict,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Öğrenci quiz sorusunu cevaplar.
    Body: {
        question_id: int,
        answer: str,
        solve_time_seconds: int (opsiyonel) — çözme süresi saniye,
        hint_used: bool (opsiyonel) — ipucu kullanıldı mı?
    }
    """
    question_id = body.get("question_id")
    answer = body.get("answer", "").strip()
    solve_time_seconds = body.get("solve_time_seconds")  # Opsiyonel
    hint_used = bool(body.get("hint_used", False))       # Opsiyonel

    if not question_id or not answer:
        raise HTTPException(status_code=400, detail="question_id ve answer zorunludur.")

    q_result = await db.execute(
        select(Question).where(
            Question.id == question_id,
            Question.classroom_id == current_user.classroom_id,
        )
    )
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Soru bulunamadı veya erişim yetkiniz yok.")

    correct = question.correct_answer.strip().lower() == answer.lower()
    old_elo = current_user.elo_rating

    # Gelişmiş ELO: süre + hint faktörlü
    from app.services.elo_service import EloService
    elo_svc = EloService()
    new_elo, delta = elo_svc.calculate_new_elo(
        player_elo=old_elo,
        question_elo=question.elo_rating,
        correct=correct,
        solve_time_seconds=solve_time_seconds,
        hint_used=hint_used,
    )

    # Üst üste başarısız sayacını güncelle
    if correct:
        current_user.consecutive_failures = 0
    else:
        current_user.consecutive_failures = (current_user.consecutive_failures or 0) + 1

    consecutive_failures = current_user.consecutive_failures
    motivation_triggered = elo_svc.should_trigger_motivation(consecutive_failures)

    current_user.elo_rating = new_elo
    db.add(EloHistory(
        user_id=current_user.id,
        question_id=question_id,
        elo_after=new_elo,
        delta=delta,
        correct=correct,
        solve_time_seconds=solve_time_seconds,
        hint_used=hint_used,
    ))
    await db.commit()

    # Zaman faktörü mesajı oluştur
    time_message = None
    if solve_time_seconds and correct:
        from app.services.elo_service import EXPECTED_SOLVE_TIME, _difficulty_level
        difficulty = _difficulty_level(question.elo_rating)
        avg_time = EXPECTED_SOLVE_TIME[difficulty]
        if solve_time_seconds < avg_time * 0.5:
            time_message = f"⚡ Çok hızlı çözdün! Bonus ELO kazandın."
        elif solve_time_seconds > avg_time * 2:
            time_message = f"🐢 Biraz yavaş kaldın, ELO ödülü azaldı."

    return {
        "correct": correct,
        "correct_answer": question.correct_answer,
        "old_elo": old_elo,
        "new_elo": new_elo,
        "delta": delta,
        "hint_used": hint_used,
        "time_message": time_message,
        "consecutive_failures": consecutive_failures,
        "motivation_triggered": motivation_triggered,
    }
