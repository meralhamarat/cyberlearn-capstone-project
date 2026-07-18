from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserRegister(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: str
    teacher_code: Optional[str] = None
    class_code: Optional[str] = None

class ClassroomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)


class ClassroomOut(BaseModel):
    id: int
    name: Optional[str] = None
    code: str
    student_count: int = 0

    class Config:
        from_attributes = True


class DocumentOut(BaseModel):
    id: int
    classroom_id: int
    original_name: str
    gpt_status: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class QuestionPendingOut(BaseModel):
    id: int
    text: str
    options: List[str]
    correct_answer: str
    elo_rating: int
    is_approved: bool
    classroom_id: Optional[int] = None
    document_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionApprovalRequest(BaseModel):
    approved: bool

class UserLogin(BaseModel):
    email: EmailStr 
    password: str

class EmailVerifyRequest(BaseModel):
    token: str             # 🆕 email doğrulama token'ı

class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    role: str
    is_verified: bool
    elo_rating: int
    story_chapter: int
    avatar: str = "warrior-1"

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── QUESTIONS ───────────────────────────────────────────────────────────────

class QuestionResponse(BaseModel):
    id: int
    text: str
    options: List[str]
    elo_rating: int

class AnswerRequest(BaseModel):
    question_id: int
    answer: str
    user_id: int           # prod'da JWT'den alınır

class AnswerResponse(BaseModel):
    correct: bool
    old_elo: int
    new_elo: int
    delta: int
    story_message: Optional[str] = None


# ─── STORY ───────────────────────────────────────────────────────────────────

class StoryProgressResponse(BaseModel):
    chapter: int
    message: str
    unlocked_at: datetime

    class Config:
        from_attributes = True

class EloHistoryPoint(BaseModel):
    elo_after: int
    delta: int
    correct: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── ROLE & SESSION ──────────────────────────────────────────────────────────

class RoleOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class SessionOut(BaseModel):
    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True


# ─── ADMIN — KULLANICI YÖNETİMİ ──────────────────────────────────────────────

class UserAdminOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    role: str
    is_verified: bool
    is_active: bool
    teacher_code: Optional[str] = None
    classroom_id: Optional[int] = None
    elo_rating: int
    story_chapter: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserRoleUpdate(BaseModel):
    role: str  # "student" | "teacher" | "admin"


class UserStatusUpdate(BaseModel):
    is_active: bool


class TeacherCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: Optional[str] = None   # Boş bırakılırsa otomatik üretilir


class AssignTeacherRequest(BaseModel):
    teacher_id: int


# ─── TEACHER MANAGEMENT ──────────────────────────────────────────────────────

class TeacherResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    teacher_code: str
    is_verified: bool
    is_active: bool
    created_at: datetime
    classrooms: List[dict] = []

    class Config:
        from_attributes = True


class TeacherCreateResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    teacher_code: str
    generated_password: str
    message: str

    class Config:
        from_attributes = True


class AssignTeacherResponse(BaseModel):
    message: str
    teacher_id: int
    classroom_id: int
    teacher_name: str
    classroom_code: str


# ─── STUDENT REGISTRATION WITH TEACHER CODE ──────────────────────────────────

class StudentRegisterWithTeacher(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    teacher_code: str = Field(..., description="Teacher's code (e.g., TCH-ABC123)")


class StudentRegisterWithTeacherResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    classroom_id: int
    classroom_code: str
    teacher_name: str
    message: str
    verification_code: str

    class Config:
        from_attributes = True
