"""
Admin Router — Sadece 'admin' rolündeki kullanıcılar erişebilir.
Prefix: /api/admin  (sqladmin /admin ile çakışmaması için)

Endpoint'ler:
  GET    /api/admin/users                          → Kullanıcıları listele
  PATCH  /api/admin/users/{id}/role                → Rol güncelle
  PATCH  /api/admin/users/{id}/status              → Aktif/Pasif yap
  GET    /api/admin/verifications                  → Doğrulama kodlarını listele
  GET    /api/admin/classrooms                     → Sınıfları listele
  POST   /api/admin/classrooms                     → Yeni sınıf oluştur
  DELETE /api/admin/classrooms/{id}                → Sınıfı sil
  GET    /api/admin/teachers                       → Öğretmenleri listele
  POST   /api/admin/teachers                       → Yeni öğretmen oluştur
  POST   /api/admin/classrooms/{id}/assign-teacher → Sınıfa öğretmen ata
  DELETE /api/admin/classrooms/{id}/teachers/{tid} → Öğretmeni sınıftan çıkar
  GET    /api/admin/stats                          → Dashboard istatistikleri
"""

import secrets
import string
from passlib.context import CryptContext
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from typing import Optional

from app.database import get_db
from app.models.db_models import User, Classroom, TeacherClassroom, EmailVerification
from app.models.schemas import (
    ClassroomCreate,
    ClassroomOut,
    TeacherCreate,
    TeacherCreateResponse,
    AssignTeacherRequest,
    AssignTeacherResponse,
)
from app.services.jwt_service import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


# ─── YETKİ KONTROLÜ ──────────────────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bu alana sadece admin erişebilir.")
    return current_user


def _generate_teacher_code(length: int = 8) -> str:
    """TCH- önekli rastgele öğretmen kodu üretir."""
    chars = string.ascii_uppercase + string.digits
    return "TCH-" + "".join(secrets.choice(chars) for _ in range(length))


async def _ensure_unique_teacher_code(db: AsyncSession) -> str:
    """Generates a unique teacher code and ensures uniqueness in database"""
    while True:
        code = _generate_teacher_code()
        existing = await db.execute(select(User).where(User.teacher_code == code))
        if not existing.scalar_one_or_none():
            return code


# ─── KULLANICI YÖNETİMİ ──────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    role: Optional[str] = Query(None, description="Filtre: student | teacher | admin"),
    is_active: Optional[bool] = Query(None, description="Filtre: true | false"),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tüm kullanıcıları listele. Rol ve aktiflik filtresi uygulanabilir."""
    query = select(User).order_by(User.created_at.desc())
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    result = await db.execute(query)
    users = result.scalars().all()

    return [
        {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "email": u.email,
            "role": u.role,
            "is_verified": u.is_verified,
            "is_active": u.is_active,
            "teacher_code": u.teacher_code,
            "classroom_id": u.classroom_id,
            "elo_rating": u.elo_rating,
            "story_chapter": u.story_chapter,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    body: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Kullanıcı rolünü güncelle.
    Body: { "role": "student" | "teacher" | "admin" }
    """
    new_role = body.get("role", "").strip().lower()
    if new_role not in ("student", "teacher", "admin"):
        raise HTTPException(status_code=400, detail="Geçersiz rol. Seçenekler: student, teacher, admin")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    old_role = user.role
    user.role = new_role

    # Öğretmene çevriliyorsa öğretmen kodu oluştur
    if new_role == "teacher" and not user.teacher_code:
        teacher_code = _generate_teacher_code()
        while True:
            code_check = await db.execute(select(User).where(User.teacher_code == teacher_code))
            if not code_check.scalar_one_or_none():
                break
            teacher_code = _generate_teacher_code()
        user.teacher_code = teacher_code

    await db.commit()
    return {
        "id": user.id,
        "email": user.email,
        "old_role": old_role,
        "new_role": user.role,
        "teacher_code": user.teacher_code,
        "message": f"Rol {old_role} → {new_role} olarak güncellendi.",
    }


@router.patch("/users/{user_id}/status")
async def toggle_user_status(
    user_id: int,
    body: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Kullanıcı hesabını aktif/pasif yap.
    Body: { "is_active": true | false }
    """
    if "is_active" not in body:
        raise HTTPException(status_code=400, detail="is_active alanı zorunludur.")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    # Admin kendi hesabını pasif yapamaz
    if user.id == current_user.id and not body["is_active"]:
        raise HTTPException(status_code=400, detail="Kendi hesabınızı pasif yapamazsınız.")

    user.is_active = bool(body["is_active"])
    await db.commit()

    status_text = "aktif" if user.is_active else "pasif"
    return {
        "id": user.id,
        "email": user.email,
        "is_active": user.is_active,
        "message": f"Hesap {status_text} yapıldı.",
    }


# ─── DOĞRULAMA KODLARI ────────────────────────────────────────────────────────

@router.get("/verifications")
async def list_verifications(
    is_used: Optional[bool] = Query(None, description="Filtre: true | false"),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tüm e-posta doğrulama kodlarını listele."""
    query = (
        select(
            EmailVerification.id,
            EmailVerification.user_id,
            EmailVerification.code,
            EmailVerification.is_used,
            EmailVerification.expires_at,
            EmailVerification.created_at,
            User.email.label("user_email"),
            User.first_name.label("user_first_name"),
            User.last_name.label("user_last_name"),
        )
        .outerjoin(User, User.id == EmailVerification.user_id)
        .order_by(EmailVerification.created_at.desc())
    )
    if is_used is not None:
        query = query.where(EmailVerification.is_used == is_used)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "user_email": r.user_email,
            "user_name": f"{r.user_first_name or ''} {r.user_last_name or ''}".strip(),
            "code": r.code,
            "is_used": r.is_used,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ─── SINIFLAR ─────────────────────────────────────────────────────────────────

@router.post("/classrooms", status_code=201)
async def create_classroom(
    body: ClassroomCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Yeni sınıf oluştur (sadece admin)."""
    normalized_code = body.code.strip().upper()

    existing = await db.execute(select(Classroom).where(Classroom.code == normalized_code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu sınıf kodu zaten kullanımda!")

    classroom = Classroom(name=body.name.strip(), code=normalized_code, created_by=current_user.id)
    db.add(classroom)
    try:
        await db.commit()
        await db.refresh(classroom)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Bu sınıf kodu zaten kullanımda!")

    return {"id": classroom.id, "name": classroom.name, "code": classroom.code}


@router.get("/classrooms")
async def list_all_classrooms(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tüm sınıfları öğrenci sayısıyla listele."""
    from sqlalchemy import case as sa_case
    result = await db.execute(
        select(
            Classroom.id,
            Classroom.name,
            Classroom.code,
            Classroom.created_at,
            func.count(sa_case((User.role == "student", User.id))).label("student_count"),
        )
        .outerjoin(User, (User.classroom_id == Classroom.id) & (User.role == "student"))
        .group_by(Classroom.id, Classroom.name, Classroom.code, Classroom.created_at)
        .order_by(Classroom.id)
    )
    rows = result.all()

    # Her sınıf için atanmış öğretmenleri de çek
    out = []
    for r in rows:
        tc_result = await db.execute(
            select(User.id, User.first_name, User.last_name, User.email, User.teacher_code)
            .join(TeacherClassroom, TeacherClassroom.teacher_id == User.id)
            .where(TeacherClassroom.classroom_id == r.id)
        )
        teachers = tc_result.all()
        out.append({
            "id": r.id,
            "name": r.name,
            "code": r.code,
            "student_count": r.student_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "teachers": [
                {
                    "id": t.id,
                    "name": f"{t.first_name} {t.last_name}",
                    "email": t.email,
                    "teacher_code": t.teacher_code,
                }
                for t in teachers
            ],
        })
    return out


@router.delete("/classrooms/{classroom_id}", status_code=204)
async def delete_classroom(
    classroom_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Sınıfı sil (öğrenci yoksa)."""
    classroom = await db.get(Classroom, classroom_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Sınıf bulunamadı.")

    enrolled = await db.execute(
        select(func.count(User.id)).where(User.classroom_id == classroom_id, User.role == "student")
    )
    count = enrolled.scalar() or 0
    if count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Bu sınıfta {count} öğrenci var. Önce öğrencileri taşıyın.",
        )

    await db.delete(classroom)
    await db.commit()


# ─── ÖĞRETMENLER ──────────────────────────────────────────────────────────────

@router.get("/teachers")
async def list_all_teachers(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tüm öğretmenleri ve atandıkları sınıfları listele."""
    result = await db.execute(select(User).where(User.role == "teacher").order_by(User.id))
    teachers = result.scalars().all()

    out = []
    for t in teachers:
        tc_result = await db.execute(
            select(Classroom)
            .join(TeacherClassroom, TeacherClassroom.classroom_id == Classroom.id)
            .where(TeacherClassroom.teacher_id == t.id)
        )
        classrooms = tc_result.scalars().all()
        out.append({
            "id": t.id,
            "first_name": t.first_name,
            "last_name": t.last_name,
            "email": t.email,
            "teacher_code": t.teacher_code,
            "is_verified": t.is_verified,
            "is_active": t.is_active,
            "classrooms": [{"id": c.id, "name": c.name, "code": c.code} for c in classrooms],
        })
    return out


@router.post("/teachers", status_code=201, response_model=TeacherCreateResponse)
async def create_teacher(
    body: TeacherCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Yeni öğretmen hesabı oluştur.
    Body: { first_name, last_name, email, password (opsiyonel) }
    
    Şifre sağlanmadığı takdirde otomatik olarak oluşturulur.
    """
    email = body.email.strip().lower()
    first_name = body.first_name.strip()
    last_name = body.last_name.strip()
    password = body.password or secrets.token_urlsafe(12)

    if not email or not first_name or not last_name:
        raise HTTPException(status_code=400, detail="Ad, soyad ve e-posta zorunludur.")

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı.")

    teacher_code = await _ensure_unique_teacher_code(db)

    hashed = pwd_context.hash(password[:72])
    teacher = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        hashed_password=hashed,
        role="teacher",
        is_verified=True,
        is_active=True,
        teacher_code=teacher_code,
    )
    db.add(teacher)
    
    try:
        await db.commit()
        await db.refresh(teacher)
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Öğretmen oluşturulamadı.")

    return TeacherCreateResponse(
        id=teacher.id,
        first_name=teacher.first_name,
        last_name=teacher.last_name,
        email=teacher.email,
        teacher_code=teacher.teacher_code,
        generated_password=password,
        message=f"✓ Öğretmen '{first_name} {last_name}' {teacher_code} kodu ile oluşturuldu.",
    )


# ─── SINIF ↔ ÖĞRETMEN ATAMA ──────────────────────────────────────────────────

@router.post("/classrooms/{classroom_id}/assign-teacher", status_code=201, response_model=AssignTeacherResponse)
async def assign_teacher_to_classroom(
    classroom_id: int,
    body: AssignTeacherRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Classroom'a öğretmen ata."""
    teacher_id = body.teacher_id
    if not teacher_id:
        raise HTTPException(status_code=400, detail="teacher_id zorunludur.")

    classroom = await db.get(Classroom, classroom_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Sınıf bulunamadı.")

    teacher_result = await db.execute(
        select(User).where(User.id == teacher_id, User.role == "teacher")
    )
    teacher = teacher_result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Öğretmen bulunamadı.")

    existing_tc = await db.execute(
        select(TeacherClassroom).where(
            TeacherClassroom.teacher_id == teacher_id,
            TeacherClassroom.classroom_id == classroom_id,
        )
    )
    if existing_tc.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu öğretmen zaten bu sınıfa atanmış.")

    db.add(TeacherClassroom(teacher_id=teacher_id, classroom_id=classroom_id))
    await db.commit()
    
    return AssignTeacherResponse(
        message=f"✓ {teacher.first_name} {teacher.last_name} → {classroom.name or classroom.code} sınıfına atandı.",
        teacher_id=teacher_id,
        classroom_id=classroom_id,
        teacher_name=f"{teacher.first_name} {teacher.last_name}",
        classroom_code=classroom.code,
    )


@router.delete("/classrooms/{classroom_id}/teachers/{teacher_id}", status_code=204)
async def remove_teacher_from_classroom(
    classroom_id: int,
    teacher_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Classroom'dan öğretmeni çıkar."""
    tc_result = await db.execute(
        select(TeacherClassroom).where(
            TeacherClassroom.teacher_id == teacher_id,
            TeacherClassroom.classroom_id == classroom_id,
        )
    )
    tc = tc_result.scalar_one_or_none()
    if not tc:
        raise HTTPException(status_code=404, detail="Bu atama bulunamadı.")

    await db.delete(tc)
    await db.commit()


# ─── GENEL İSTATİSTİKLER ─────────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard özet istatistikleri."""
    total_students = (await db.execute(
        select(func.count(User.id)).where(User.role == "student")
    )).scalar() or 0

    total_teachers = (await db.execute(
        select(func.count(User.id)).where(User.role == "teacher")
    )).scalar() or 0

    total_classrooms = (await db.execute(
        select(func.count(Classroom.id))
    )).scalar() or 0

    total_active = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar() or 0

    total_inactive = (await db.execute(
        select(func.count(User.id)).where(User.is_active == False)
    )).scalar() or 0

    pending_verifications = (await db.execute(
        select(func.count(EmailVerification.id)).where(EmailVerification.is_used == False)
    )).scalar() or 0

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_classrooms": total_classrooms,
        "total_active_users": total_active,
        "total_inactive_users": total_inactive,
        "pending_verifications": pending_verifications,
    }
