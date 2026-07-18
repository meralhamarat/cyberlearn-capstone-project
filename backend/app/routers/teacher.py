import json
import os
import shutil
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.db_models import User, Classroom, TeacherClassroom, Document, Question, EloHistory
from app.models.schemas import DocumentOut, QuestionPendingOut
from app.services.jwt_service import get_current_user

router = APIRouter(prefix="/teacher", tags=["teacher"])

UPLOAD_DIR = "uploads/documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def require_teacher(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Bu alana sadece öğretmenler erişebilir.")
    return current_user


# ─── SINIFLAR (sadece okuma) ──────────────────────────────────────────────────

@router.get("/classrooms")
async def list_my_classrooms(
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import case as sa_case
    result = await db.execute(
        select(
            Classroom.id,
            Classroom.name,
            Classroom.code,
            func.count(sa_case((User.role == "student", User.id))).label("student_count"),
        )
        .join(TeacherClassroom, TeacherClassroom.classroom_id == Classroom.id)
        .outerjoin(User, (User.classroom_id == Classroom.id) & (User.role == "student"))
        .where(TeacherClassroom.teacher_id == current_user.id)
        .group_by(Classroom.id, Classroom.name, Classroom.code)
    )
    return [
        {"id": r.id, "name": r.name, "code": r.code, "student_count": r.student_count}
        for r in result.all()
    ]


@router.get("/classrooms/{classroom_id}/students")
async def list_classroom_students(
    classroom_id: int,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    tc_result = await db.execute(
        select(TeacherClassroom).where(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == classroom_id,
        )
    )
    if not tc_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu sınıfa erişim yetkiniz yok.")

    result = await db.execute(
        select(User).where(
            User.classroom_id == classroom_id,
            User.role == "student",
        )
    )
    students = result.scalars().all()

    stats = []
    for s in students:
        history_result = await db.execute(
            select(EloHistory).where(EloHistory.user_id == s.id).order_by(EloHistory.created_at)
        )
        history = history_result.scalars().all()
        total = len(history)
        correct = sum(1 for h in history if h.correct)
        stats.append({
            "id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "email": s.email,
            "elo_rating": s.elo_rating,
            "story_chapter": s.story_chapter,
            "is_verified": s.is_verified,
            "total_answers": total,
            "correct_answers": correct,
            "accuracy": round(correct / total * 100, 1) if total > 0 else 0,
        })

    # Elo'ya göre sırala → sıralama (rank) ekle
    stats.sort(key=lambda x: x["elo_rating"], reverse=True)
    for i, s in enumerate(stats):
        s["rank"] = i + 1

    return stats


# ─── DOKÜMANLAR ───────────────────────────────────────────────────────────────

@router.get("/classrooms/{classroom_id}/documents")
async def list_documents(
    classroom_id: int,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    # Öğretmenin bu sınıfa erişimi var mı?
    tc = await db.execute(
        select(TeacherClassroom).where(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == classroom_id,
        )
    )
    if not tc.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu sınıfa erişim yetkiniz yok.")

    result = await db.execute(
        select(Document)
        .where(Document.classroom_id == classroom_id)
        .order_by(Document.uploaded_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "classroom_id": d.classroom_id,
            "original_name": d.original_name,
            "gpt_status": d.gpt_status,
            "reading_time_seconds": d.reading_time_seconds or 90,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]


@router.post("/classrooms/{classroom_id}/documents", status_code=201)
async def upload_document(
    classroom_id: int,
    file: UploadFile = File(...),
    reading_time_seconds: int = Form(90),
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    # Sınıf erişim kontrolü
    tc = await db.execute(
        select(TeacherClassroom).where(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == classroom_id,
        )
    )
    if not tc.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu sınıfa erişim yetkiniz yok.")

    # Sadece PDF kabul et
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Sadece PDF dosyaları kabul edilmektedir.")

    # Dosyayı kaydet
    safe_name = f"{classroom_id}_{current_user.id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # DB'ye kaydet
    doc = Document(
        classroom_id=classroom_id,
        teacher_id=current_user.id,
        original_name=file.filename,
        file_path=file_path,
        gpt_status="pending",
        reading_time_seconds=max(10, min(reading_time_seconds, 600)),  # 10s - 600s arasında sınırla
    )
    db.add(doc)
    await db.flush()

    # GPT / yerel soru üretimi
    try:
        from app.services.gpt_question_service import generate_questions_from_pdf
        questions, extracted_text = await generate_questions_from_pdf(
            file_path, doc.id, classroom_id, current_user.id
        )
        for q in questions:
            db.add(q)
        doc.story_text = extracted_text
        doc.gpt_status = "done" if questions else "error"
    except Exception as e:
        print(f"[GPT] Soru üretimi başarısız: {e}")
        doc.gpt_status = "error"

    await db.commit()
    return {"id": doc.id, "original_name": doc.original_name, "gpt_status": doc.gpt_status, "reading_time_seconds": doc.reading_time_seconds}


@router.delete("/classrooms/{classroom_id}/documents/{document_id}", status_code=204)
async def delete_document(
    classroom_id: int,
    document_id: int,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    tc = await db.execute(
        select(TeacherClassroom).where(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == classroom_id,
        )
    )
    if not tc.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu sınıfa erişim yetkiniz yok.")

    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.classroom_id == classroom_id)
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Doküman bulunamadı.")

    # İlişkili soruları sil
    await db.execute(delete(Question).where(Question.document_id == document_id))

    # Dosyayı diskten sil
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    await db.delete(doc)
    await db.commit()


@router.post("/documents/{document_id}/regenerate")
async def regenerate_document_questions(
    document_id: int,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Doküman için soruları yeniden üret (mevcut sorular silinir)."""
    doc_res = await db.execute(select(Document).where(Document.id == document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Doküman bulunamadı.")

    if doc.classroom_id:
        tc = await db.execute(
            select(TeacherClassroom).where(
                TeacherClassroom.teacher_id == current_user.id,
                TeacherClassroom.classroom_id == doc.classroom_id,
            )
        )
        if not tc.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Bu dokümana erişim yetkiniz yok.")

    await db.execute(delete(Question).where(Question.document_id == document_id))
    doc.gpt_status = "pending"
    questions = []

    try:
        from app.services.gpt_question_service import generate_questions_from_pdf
        questions, extracted_text = await generate_questions_from_pdf(
            doc.file_path, doc.id, doc.classroom_id, current_user.id
        )
        for q in questions:
            db.add(q)
        doc.story_text = extracted_text or doc.story_text
        doc.gpt_status = "done" if questions else "error"
    except Exception as e:
        print(f"[GPT] Yeniden üretim başarısız: {e}")
        doc.gpt_status = "error"

    await db.commit()
    return {
        "id": doc.id,
        "gpt_status": doc.gpt_status,
        "question_count": len(questions),
    }


# ─── DOKUMAN SORULARI ────────────────────────────────────────────────────────

@router.get("/documents/{document_id}/questions")
async def get_document_questions(
    document_id: int,
    difficulty: str = "all",  # all | kolay | orta | zor | uzman
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Bir dokümana ait üretilmiş soruları döndür (zorluk filtresiyle)."""
    doc_res = await db.execute(select(Document).where(Document.id == document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Doküman bulunamadı.")

    # Öğretmenin bu sınıfa yetkisi var mı?
    if doc.classroom_id:
        tc = await db.execute(
            select(TeacherClassroom).where(
                TeacherClassroom.teacher_id == current_user.id,
                TeacherClassroom.classroom_id == doc.classroom_id,
            )
        )
        if not tc.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Bu dokümana erişim yetkiniz yok.")

    query = select(Question).where(Question.document_id == document_id)

    # Zorluk filtresi (ELO'ya göre)
    if difficulty == "kolay":
        query = query.where(Question.elo_rating <= 900)
    elif difficulty == "orta":
        query = query.where(Question.elo_rating > 900, Question.elo_rating <= 1100)
    elif difficulty == "zor":
        query = query.where(Question.elo_rating > 1100)

    result = await db.execute(query.order_by(Question.elo_rating))
    questions = result.scalars().all()

    return [
        {
            "id": q.id,
            "text": q.text,
            "options": json.loads(q.options),
            "correct_answer": q.correct_answer,
            "elo_rating": q.elo_rating,
            "is_approved": q.is_approved,
            "teacher_analysis": q.teacher_analysis,
        }
        for q in questions
    ]


@router.patch("/questions/{question_id}")
async def update_question(
    question_id: int,
    body: dict,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Öğretmen soru metnini, şıkları veya doğru cevabı düzeltebilir."""
    q_res = await db.execute(select(Question).where(Question.id == question_id))
    question = q_res.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Soru bulunamadı.")

    if question.classroom_id:
        tc = await db.execute(
            select(TeacherClassroom).where(
                TeacherClassroom.teacher_id == current_user.id,
                TeacherClassroom.classroom_id == question.classroom_id,
            )
        )
        if not tc.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Bu soruya erişim yetkiniz yok.")

    if "text" in body:
        question.text = body["text"]
    if "correct_answer" in body:
        question.correct_answer = body["correct_answer"]
    if "options" in body and isinstance(body["options"], list):
        question.options = json.dumps(body["options"], ensure_ascii=False)
    if "elo_rating" in body:
        question.elo_rating = int(body["elo_rating"])
    if "is_approved" in body:
        question.is_approved = bool(body["is_approved"])
    if "teacher_analysis" in body:
        question.teacher_analysis = body["teacher_analysis"]

    await db.commit()
    return {
        "id": question.id,
        "text": question.text,
        "options": json.loads(question.options),
        "correct_answer": question.correct_answer,
        "elo_rating": question.elo_rating,
        "is_approved": question.is_approved,
        "teacher_analysis": question.teacher_analysis,
    }


# ─── SORULAR (ONAY/RED) ───────────────────────────────────────────────────────

@router.get("/classrooms/{classroom_id}/questions/pending")
async def list_pending_questions(
    classroom_id: int,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    tc = await db.execute(
        select(TeacherClassroom).where(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == classroom_id,
        )
    )
    if not tc.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu sınıfa erişim yetkiniz yok.")

    result = await db.execute(
        select(Question)
        .where(
            Question.classroom_id == classroom_id,
            Question.is_approved == False,
        )
        .order_by(Question.created_at.desc())
    )
    questions = result.scalars().all()
    out = []
    for q in questions:
        out.append({
            "id": q.id,
            "text": q.text,
            "options": json.loads(q.options),
            "correct_answer": q.correct_answer,
            "elo_rating": q.elo_rating,
            "is_approved": q.is_approved,
            "classroom_id": q.classroom_id,
            "document_id": q.document_id,
            "teacher_analysis": q.teacher_analysis,
            "created_at": q.created_at.isoformat(),
        })
    return out


@router.get("/classrooms/{classroom_id}/questions/approved")
async def list_approved_questions(
    classroom_id: int,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    tc = await db.execute(
        select(TeacherClassroom).where(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == classroom_id,
        )
    )
    if not tc.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu sınıfa erişim yetkiniz yok.")

    result = await db.execute(
        select(Question)
        .where(
            Question.classroom_id == classroom_id,
            Question.is_approved == True,
        )
        .order_by(Question.created_at.desc())
    )
    questions = result.scalars().all()
    out = []
    for q in questions:
        out.append({
            "id": q.id,
            "text": q.text,
            "options": json.loads(q.options),
            "correct_answer": q.correct_answer,
            "elo_rating": q.elo_rating,
            "is_approved": q.is_approved,
            "teacher_analysis": q.teacher_analysis,
            "created_at": q.created_at.isoformat(),
        })
    return out


@router.post("/questions/{question_id}/approve", status_code=200)
async def approve_question(
    question_id: int,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Soruyu onayla → öğrenci haritasında görünür hale gelir."""
    q_result = await db.execute(select(Question).where(Question.id == question_id))
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Soru bulunamadı.")

    # Öğretmenin bu sınıfa erişimi var mı?
    if question.classroom_id:
        tc = await db.execute(
            select(TeacherClassroom).where(
                TeacherClassroom.teacher_id == current_user.id,
                TeacherClassroom.classroom_id == question.classroom_id,
            )
        )
        if not tc.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Bu soruya erişim yetkiniz yok.")

    question.is_approved = True
    await db.commit()
    return {"message": "Soru onaylandı.", "question_id": question_id}


@router.delete("/questions/{question_id}", status_code=204)
async def reject_question(
    question_id: int,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Soruyu reddet/sil."""
    q_result = await db.execute(select(Question).where(Question.id == question_id))
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Soru bulunamadı.")

    if question.classroom_id:
        tc = await db.execute(
            select(TeacherClassroom).where(
                TeacherClassroom.teacher_id == current_user.id,
                TeacherClassroom.classroom_id == question.classroom_id,
            )
        )
        if not tc.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Bu soruya erişim yetkiniz yok.")

    await db.delete(question)
    await db.commit()
