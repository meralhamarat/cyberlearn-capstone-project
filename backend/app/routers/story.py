from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.db_models import User, Question, EloHistory, StoryProgress
from app.models.schemas import StoryProgressResponse, EloHistoryPoint
from app.services.elo_service import EloService
from app.services.narrative_service import NarrativeService
from app.services.jwt_service import get_current_user

router    = APIRouter()
elo_svc   = EloService()
narrative = NarrativeService()


# ─── ÖĞRENCİ: HİKAYE İLERLEMESİ ─────────────────────────────────────────────

@router.get("/progress/{user_id}", response_model=List[StoryProgressResponse])
def get_story_progress(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Öğrencinin açtığı tüm hikaye bölümlerini getir."""
    if current_user.role != "teacher" and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Erişim reddedildi.")
    progress = (
        db.query(StoryProgress)
        .filter(StoryProgress.user_id == user_id)
        .order_by(StoryProgress.unlocked_at)
        .all()
    )
    return progress


# ─── ÖĞRENCİ: ELO GEÇMİŞİ (öğrenme eğrisi grafiği) ─────────────────────────

@router.get("/elo-history/{user_id}", response_model=List[EloHistoryPoint])
def get_elo_history(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Öğrencinin tüm Elo geçmişi — frontend'de recharts ile çizilir.
    Jüri için: bu veri öğrenme eğrisini gösterir.
    """
    if current_user.role != "teacher" and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Erişim reddedildi.")
    history = (
        db.query(EloHistory)
        .filter(EloHistory.user_id == user_id)
        .order_by(EloHistory.created_at)
        .all()
    )
    return history


# ─── ÖĞRETMEN: TÜM ÖĞRENCİLER DASHBOARD ─────────────────────────────────────

@router.get("/teacher/dashboard")
def teacher_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Öğretmen savaş haritası için tüm öğrencilerin Elo verisini döndür.
    Her öğrenci için: elo, öğrenme hızı, GPT analizi.
    """
    if current_user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sadece öğretmenler erişebilir.")
    students = db.query(User).filter(User.role == "student").all()

    result = []
    for student in students:
        # Elo geçmişini çek
        history = (
            db.query(EloHistory)
            .filter(EloHistory.user_id == student.id)
            .order_by(EloHistory.created_at)
            .all()
        )

        elo_values = [h.elo_after for h in history]
        velocity   = elo_svc.learning_velocity(elo_values)

        student_name = f"{student.first_name} {student.last_name}"

        # GPT analizi (opsiyonel — OPENAI_API_KEY varsa)
        insight = narrative.generate_teacher_insight(
            student_name=student_name,
            elo_history=elo_values,
            velocity=velocity,
        ) if elo_values else "Henüz veri yok."

        result.append({
            "id":            student.id,
            "name":          student_name,
            "elo_rating":    student.elo_rating,
            "story_chapter": student.story_chapter,
            "velocity":      velocity,
            "total_answers": len(history),
            "correct_count": sum(1 for h in history if h.correct),
            "insight":       insight,             # GPT yorumu
            "elo_history":   elo_values[-10:],    # Son 10 hamle
        })

    # Elo'ya göre sırala (savaş haritasında en güçlü üstte)
    result.sort(key=lambda x: x["elo_rating"], reverse=True)
    return {"students": result, "total": len(result)}


# ─── ÖĞRETMEN: TEKİL ÖĞRENCİ DETAY ─────────────────────────────────────────

@router.get("/teacher/student/{student_id}")
def student_detail(student_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Belirli bir öğrencinin tam analizi."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sadece öğretmenler erişebilir.")
    student = db.query(User).filter(
        User.id == student_id, User.role == "student"
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı.")

    history = (
        db.query(EloHistory)
        .filter(EloHistory.user_id == student_id)
        .order_by(EloHistory.created_at)
        .all()
    )

    story = (
        db.query(StoryProgress)
        .filter(StoryProgress.user_id == student_id)
        .all()
    )

    elo_values = [h.elo_after for h in history]

    return {
        "student":       {"id": student.id, "name": f"{student.first_name} {student.last_name}", "elo": student.elo_rating},
        "elo_history":   [{"elo": h.elo_after, "delta": h.delta, "correct": h.correct, "time": str(h.created_at)} for h in history],
        "velocity":      elo_svc.learning_velocity(elo_values),
        "story_unlocked":[{"chapter": s.chapter, "message": s.message} for s in story],
        "accuracy":      round(sum(1 for h in history if h.correct) / len(history) * 100, 1) if history else 0,
    }