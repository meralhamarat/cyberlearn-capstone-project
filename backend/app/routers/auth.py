from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from passlib.context import CryptContext
from datetime import datetime, timedelta

from app.services.jwt_service import create_access_token, get_current_user
from app.database import get_db
from app.models.db_models import User, Session, EmailVerification, Classroom, TeacherClassroom
from app.models.schemas import (
    UserRegister,
    UserLogin,
    TokenResponse,
    EmailVerifyRequest,
    UserResponse,
    StudentRegisterWithTeacher,
    StudentRegisterWithTeacherResponse,
)
from app.services.email_service import send_verification_email, generate_verification_code

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


@router.post("/register", status_code=201)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    normalized_class_code = body.class_code.strip().upper() if body.class_code else None
    normalized_teacher_code = body.teacher_code.strip().upper() if body.teacher_code else None

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")

    selected_classroom_id = None

    # Sadece öğrenci kaydolabilir; öğretmen hesapları admin tarafından oluşturulur
    if body.role != "student":
        raise HTTPException(
            status_code=400,
            detail="Sadece öğrenci hesabı oluşturabilirsiniz. Öğretmen hesapları admin tarafından açılır.",
        )

    if not normalized_class_code:
        raise HTTPException(status_code=400, detail="Sınıf kodu gereklidir!")
    if not normalized_teacher_code:
        raise HTTPException(status_code=400, detail="Öğretmen kodu gereklidir!")

    teacher_result = await db.execute(
        select(User).where(
            User.role == "teacher",
            func.upper(User.teacher_code) == normalized_teacher_code,
        )
    )
    matched_teacher = teacher_result.scalar_one_or_none()
    if not matched_teacher:
        raise HTTPException(status_code=400, detail="Geçersiz öğretmen kodu!")

    class_result = await db.execute(
        select(Classroom).where(func.upper(Classroom.code) == normalized_class_code)
    )
    selected_class = class_result.scalar_one_or_none()
    if not selected_class:
        raise HTTPException(
            status_code=400,
            detail="Geçersiz sınıf kodu! Öğretmenin önce sınıfı oluşturması gerekiyor.",
        )

    tc_result = await db.execute(
        select(TeacherClassroom).where(
            TeacherClassroom.teacher_id == matched_teacher.id,
            TeacherClassroom.classroom_id == selected_class.id,
        )
    )
    if not tc_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Bu öğretmen bu sınıfı yönetmiyor!",
        )

    selected_classroom_id = selected_class.id


    hashed = pwd_context.hash(body.password[:72])
    user = User(
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        hashed_password=hashed,
        role=body.role,
        is_verified=False,
        teacher_code=None,
        classroom_id=selected_classroom_id,
    )
    db.add(user)
    await db.flush()

    code = generate_verification_code()
    verification = EmailVerification(
        user_id=user.id,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=15),
    )
    db.add(verification)
    await db.commit()

    try:
        await send_verification_email(body.email, code, body.first_name)
    except Exception as e:
        # SMTP hatası olursa kodu loglayarak devam et
        import logging
        logging.getLogger(__name__).error(f"[EMAIL HATA] {type(e).__name__}: {e} | Doğrulama kodu: {code}")
    
    # Development mode: return code for testing
    return {
        "message": "Kayıt başarılı! Email kutunu kontrol et, kodunu gir.",
        "verification_code": code  # Remove this line in production!
    }


# ─── STUDENT REGISTRATION WITH TEACHER CODE ──────────────────────────────────

@router.post("/register/teacher-code", response_model=StudentRegisterWithTeacherResponse, status_code=201)
async def register_student_with_teacher(
    body: StudentRegisterWithTeacher,
    db: AsyncSession = Depends(get_db),
):
    """
    Basitleştirilmiş öğrenci kaydı öğretmen kodu kullanarak.
    
    Flow:
    1. Öğrenci sağlar: first_name, last_name, email, password, teacher_code
    2. Sistem öğretmenin var olup, aktif olduğunu kontrol eder
    3. Öğrenci otomatik olarak öğretmenin atandığı ilk sınıfa katılır
    4. Email doğrulama kodu gönderilir
    
    Args:
        body: StudentRegisterWithTeacher
        
    Returns:
        StudentRegisterWithTeacherResponse with verification code
        
    Raises:
        400: Email zaten kayıtlı
        400: Geçersiz öğretmen kodu
        400: Öğretmenin sınıfı yok
    """
    email = body.email.strip().lower()
    first_name = body.first_name.strip()
    last_name = body.last_name.strip()
    password = body.password[:72]  # bcrypt limit
    normalized_teacher_code = body.teacher_code.strip().upper()

    # 1. Email benzersizliğini kontrol et
    existing_email = await db.execute(
        select(User).where(User.email == email)
    )
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Bu email zaten kayıtlı.",
        )

    # 2. Öğretmen kodunu doğrula ve öğretmeni al
    teacher_result = await db.execute(
        select(User).where(
            User.role == "teacher",
            User.teacher_code == normalized_teacher_code,
            User.is_active == True,
        )
    )
    teacher = teacher_result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(
            status_code=400,
            detail="Geçersiz öğretmen kodu veya öğretmen hesabı deaktif.",
        )

    # 3. Öğretmenin ilk atanmış sınıfını al
    classroom_result = await db.execute(
        select(Classroom)
        .join(TeacherClassroom, TeacherClassroom.classroom_id == Classroom.id)
        .where(TeacherClassroom.teacher_id == teacher.id)
        .order_by(Classroom.code)
        .limit(1)
    )
    classroom = classroom_result.scalar_one_or_none()
    if not classroom:
        raise HTTPException(
            status_code=400,
            detail="Öğretmenin atandığı sınıf yok. Lütfen yöneticiye başvurun.",
        )

    # 4. Öğrenci hesabı oluştur
    hashed = pwd_context.hash(password)
    student = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        hashed_password=hashed,
        role="student",
        is_verified=False,
        is_active=True,
        classroom_id=classroom.id,
    )
    db.add(student)
    await db.flush()  # Get student ID

    # 5. Email doğrulama kodu oluştur
    verification_code = generate_verification_code()
    verification = EmailVerification(
        user_id=student.id,
        code=verification_code,
        expires_at=datetime.utcnow() + timedelta(minutes=15),
    )
    db.add(verification)
    await db.commit()

    # 6. Email gönder (best effort - email servisi down olsa bile devam et)
    try:
        await send_verification_email(email, verification_code, first_name)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(
            f"[EMAIL HATA] {type(e).__name__}: {e} | Doğrulama kodu: {verification_code}"
        )

    return StudentRegisterWithTeacherResponse(
        id=student.id,
        email=student.email,
        first_name=student.first_name,
        last_name=student.last_name,
        classroom_id=classroom.id,
        classroom_code=classroom.code,
        teacher_name=f"{teacher.first_name} {teacher.last_name}",
        message=f"✓ Kayıt başarılı! Email kutunu kontrol et, doğrulama kodunu gir.",
        verification_code=verification_code,  # Prod'ta kaldır!
    )


@router.post("/verify-email")
async def verify_email(body: EmailVerifyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EmailVerification)
        .where(EmailVerification.code == body.token)
        .where(EmailVerification.is_used == False)
        .order_by(EmailVerification.created_at.desc())
    )
    verification = result.scalar_one_or_none()

    if not verification:
        raise HTTPException(status_code=400, detail="Geçersiz kod")
    if verification.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Kodun süresi dolmuş")

    result2 = await db.execute(select(User).where(User.id == verification.user_id))
    user = result2.scalar_one_or_none()
    user.is_verified = True
    verification.is_used = True

    await db.commit()
    return {"message": "✅ Email doğrulandı! Giriş yapabilirsin."}


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not pwd_context.verify(body.password[:72], user.hashed_password):
        raise HTTPException(status_code=401, detail="Email veya şifre hatalı")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Önce emailini doğrula")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Hesabınız pasif yapılmıştır. Lütfen yönetici ile iletişime geçin.")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    session = Session(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(minutes=30),
    )
    db.add(session)
    await db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            is_verified=user.is_verified,
            role=user.role,
            elo_rating=user.elo_rating,
            story_chapter=user.story_chapter,
            avatar=user.avatar or "warrior-1",
        ),
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        email=current_user.email,
        role=current_user.role,
        is_verified=current_user.is_verified,
        elo_rating=current_user.elo_rating,
        story_chapter=current_user.story_chapter,
        avatar=current_user.avatar or "warrior-1",
    )


@router.put("/me/avatar")
async def update_avatar(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Öğrencinin avatar seçimini güncelle.
    Body: {"avatar": "warrior-1" | "warrior-2"}
    """
    avatar = body.get("avatar", "").strip()
    if avatar not in ["warrior-1", "warrior-2"]:
        raise HTTPException(status_code=400, detail="Geçersiz avatar seçimi. warrior-1 veya warrior-2 olmalı.")
    
    current_user.avatar = avatar
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    return UserResponse(
        id=current_user.id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        email=current_user.email,
        role=current_user.role,
        is_verified=current_user.is_verified,
        elo_rating=current_user.elo_rating,
        story_chapter=current_user.story_chapter,
        avatar=current_user.avatar,
    )
