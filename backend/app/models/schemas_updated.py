"""
Updated Pydantic Schemas for Teacher & Class Management
- Clean API contracts
- Validation with Field constraints
- Production-ready responses
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime


# ─── TEACHER MANAGEMENT (Admin Panel) ─────────────────────────────────────

class TeacherCreate(BaseModel):
    """Admin creates a new teacher account"""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: Optional[str] = Field(None, min_length=8)  # Auto-generated if not provided

    class Config:
        from_attributes = True


class TeacherResponse(BaseModel):
    """Teacher details with assigned classrooms"""
    id: int
    first_name: str
    last_name: str
    email: str
    teacher_code: str
    is_verified: bool
    is_active: bool
    created_at: datetime
    classrooms: List["ClassroomBasic"] = []

    class Config:
        from_attributes = True


class TeacherCreateResponse(BaseModel):
    """Response after teacher creation (includes generated password)"""
    id: int
    first_name: str
    last_name: str
    email: str
    teacher_code: str
    generated_password: str  # Include if auto-generated
    message: str

    class Config:
        from_attributes = True


# ─── CLASSROOM MANAGEMENT ─────────────────────────────────────────────────

class ClassroomCreate(BaseModel):
    """Admin creates a new classroom"""
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=3, max_length=50, description="Unique classroom code (e.g., MATH-101)")

    @validator("code")
    def validate_code(cls, v):
        """Ensure code is uppercase and alphanumeric with hyphens"""
        v = v.strip().upper()
        if not all(c.isalnum() or c == "-" for c in v):
            raise ValueError("Code must be alphanumeric with hyphens only")
        return v

    class Config:
        from_attributes = True


class ClassroomBasic(BaseModel):
    """Basic classroom info (no full details)"""
    id: int
    name: Optional[str]
    code: str

    class Config:
        from_attributes = True


class ClassroomOut(BaseModel):
    """Full classroom details with teachers and student count"""
    id: int
    name: Optional[str]
    code: str
    student_count: int = 0
    created_at: datetime
    teachers: List[TeacherBasic] = []

    class Config:
        from_attributes = True


class TeacherBasic(BaseModel):
    """Basic teacher info (for classroom listing)"""
    id: int
    first_name: str
    last_name: str
    email: str
    teacher_code: str

    class Config:
        from_attributes = True


# ─── TEACHER-CLASSROOM ASSIGNMENT ─────────────────────────────────────────

class AssignTeacherRequest(BaseModel):
    """Admin assigns a teacher to a classroom"""
    teacher_id: int


class AssignTeacherResponse(BaseModel):
    """Response after teacher assignment"""
    message: str
    teacher_id: int
    classroom_id: int
    teacher_name: str
    classroom_code: str


# ─── STUDENT REGISTRATION & JOINING ───────────────────────────────────────

class StudentRegisterWithTeacher(BaseModel):
    """
    Simplified student registration using only teacher_code
    
    Student registers and automatically joins the teacher's assigned classroom.
    """
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    teacher_code: str = Field(..., description="Teacher's code (e.g., TCH-ABC123)")

    class Config:
        from_attributes = True


class StudentRegisterWithTeacherResponse(BaseModel):
    """Response after successful student registration"""
    id: int
    email: str
    first_name: str
    last_name: str
    classroom_id: int
    classroom_code: str
    teacher_name: str
    message: str
    verification_code: str  # For dev/testing (remove in production)

    class Config:
        from_attributes = True


class StudentJoinResponse(BaseModel):
    """Response confirming student joined classroom via teacher code"""
    student_id: int
    student_name: str
    teacher_name: str
    classroom_id: int
    classroom_code: str
    classroom_name: Optional[str]
    message: str


# ─── AUTHENTICATION ───────────────────────────────────────────────────────

class UserLogin(BaseModel):
    """User login credentials"""
    email: EmailStr
    password: str


class EmailVerifyRequest(BaseModel):
    """Email verification with code"""
    token: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


class UserResponse(BaseModel):
    """User profile response"""
    id: int
    first_name: str
    last_name: str
    email: str
    role: str  # student|teacher|admin
    is_verified: bool
    is_active: bool
    elo_rating: int
    story_chapter: int
    avatar: str
    teacher_code: Optional[str] = None
    classroom_id: Optional[int] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Authentication response with token and user info"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── QUESTIONS ────────────────────────────────────────────────────────────

class QuestionResponse(BaseModel):
    """Question for quiz"""
    id: int
    text: str
    options: List[str]
    elo_rating: int

    class Config:
        from_attributes = True


class AnswerRequest(BaseModel):
    """Student answer submission"""
    question_id: int
    answer: str
    user_id: int


class AnswerResponse(BaseModel):
    """Answer evaluation response"""
    correct: bool
    old_elo: int
    new_elo: int
    elo_delta: int


# ─── ADMIN MANAGEMENT ──────────────────────────────────────────────────────

class UserStatusUpdate(BaseModel):
    """Update user account status (active/inactive)"""
    is_active: bool


class UserRoleUpdate(BaseModel):
    """Update user role"""
    role: str = Field(..., description="student | teacher | admin")

    @validator("role")
    def validate_role(cls, v):
        if v not in ("student", "teacher", "admin"):
            raise ValueError("Role must be one of: student, teacher, admin")
        return v


class AdminUserResponse(BaseModel):
    """Admin view of user details"""
    id: int
    first_name: str
    last_name: str
    email: str
    role: str
    is_verified: bool
    is_active: bool
    teacher_code: Optional[str]
    classroom_id: Optional[int]
    elo_rating: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── VERIFICATION ────────────────────────────────────────────────────────

class EmailVerificationResponse(BaseModel):
    """Email verification details"""
    id: int
    user_id: int
    user_email: str
    user_name: str
    code: str
    is_used: bool
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True
