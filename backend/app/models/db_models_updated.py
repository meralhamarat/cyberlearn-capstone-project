"""
Updated SQLAlchemy Database Models
- Enhanced relationships for Teacher & Class Management
- Production-ready with proper constraints
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    """
    User model supporting: student, teacher, admin roles
    
    Key Fields:
    - teacher_code: Unique code assigned to teachers (e.g., "TCH-ABC123")
    - classroom_id: Assigned classroom (for students)
    - is_active: Account status (admin can deactivate)
    - is_verified: Email verification flag
    """
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_email_role", "email", "role"),
        Index("ix_users_teacher_code", "teacher_code"),
        {"extend_existing": True},
    )

    # ── Identity ──────────────────────────────────────────────────────────
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)

    # ── Account Status ────────────────────────────────────────────────────
    role = Column(String(50), default="student", nullable=False)  # student|teacher|admin
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    teacher_code = Column(String(50), nullable=True, unique=True, index=True)

    # ── Classroom Assignment ──────────────────────────────────────────────
    classroom_id = Column(Integer, ForeignKey("classes.id"), nullable=True, index=True)

    # ── Student Progress ──────────────────────────────────────────────────
    elo_rating = Column(Integer, default=1000)
    story_chapter = Column(Integer, default=1)
    consecutive_failures = Column(Integer, default=0)
    avatar = Column(String(50), default="warrior-1")

    # ── Timestamps ────────────────────────────────────────────────────────
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # ── Relationships ─────────────────────────────────────────────────────
    # Student → Classroom
    classroom = relationship(
        "Classroom",
        back_populates="students",
        foreign_keys=[classroom_id],
        viewonly=True
    )

    # Teacher → TeacherClassroom (many-to-many via junction table)
    teacher_classrooms = relationship(
        "TeacherClassroom",
        back_populates="teacher",
        foreign_keys="TeacherClassroom.teacher_id",
        cascade="all, delete-orphan"
    )

    # Teacher's uploaded documents
    documents = relationship(
        "Document",
        back_populates="teacher",
        foreign_keys="Document.teacher_id"
    )

    # Teacher's created questions
    created_questions = relationship(
        "Question",
        back_populates="created_by_teacher_rel",
        foreign_keys="Question.created_by_teacher"
    )

    # Classrooms created by admin/teacher
    created_classrooms = relationship(
        "Classroom",
        back_populates="creator",
        foreign_keys="Classroom.created_by"
    )

    # Email verification codes
    email_verifications = relationship(
        "EmailVerification",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # ELO rating history
    elo_history = relationship(
        "EloHistory",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # Story progress
    story_progress = relationship(
        "StoryProgress",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class Classroom(Base):
    """
    Classroom model
    
    Key Features:
    - Unique classroom code (e.g., "CLASS-MATH-101")
    - Many-to-many with teachers via TeacherClassroom
    - One-to-many with students
    """
    __tablename__ = "classes"
    __table_args__ = (
        UniqueConstraint("code", name="uq_classroom_code"),
        Index("ix_classroom_created_by", "created_by"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # ── Relationships ─────────────────────────────────────────────────────
    # Admin/Creator
    creator = relationship(
        "User",
        back_populates="created_classrooms",
        foreign_keys=[created_by],
        viewonly=True
    )

    # Students in this classroom
    students = relationship(
        "User",
        back_populates="classroom",
        foreign_keys="User.classroom_id",
        viewonly=True
    )

    # Teachers assigned to this classroom (via TeacherClassroom)
    teacher_classrooms = relationship(
        "TeacherClassroom",
        back_populates="classroom",
        cascade="all, delete-orphan"
    )

    # Documents in this classroom
    documents = relationship(
        "Document",
        back_populates="classroom",
        cascade="all, delete-orphan"
    )

    # Questions in this classroom
    questions = relationship(
        "Question",
        back_populates="classroom"
    )


class TeacherClassroom(Base):
    """
    Junction table: Maps Teachers to Classrooms (many-to-many)
    
    A teacher can manage multiple classrooms.
    A classroom can be managed by multiple teachers (co-teaching).
    """
    __tablename__ = "teacher_classrooms"
    __table_args__ = (
        UniqueConstraint("teacher_id", "classroom_id", name="uq_teacher_classroom"),
        Index("ix_tc_teacher_id", "teacher_id"),
        Index("ix_tc_classroom_id", "classroom_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    assigned_at = Column(DateTime, server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────────────
    teacher = relationship(
        "User",
        back_populates="teacher_classrooms",
        foreign_keys=[teacher_id]
    )

    classroom = relationship(
        "Classroom",
        back_populates="teacher_classrooms",
        foreign_keys=[classroom_id]
    )


class Session(Base):
    """Session/Token tracking for logout and session management"""
    __tablename__ = "sessions"
    __table_args__ = (
        Index("ix_session_user_id", "user_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(Text, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)


class EmailVerification(Base):
    """Email verification codes"""
    __tablename__ = "email_verifications"
    __table_args__ = (
        Index("ix_ev_user_id", "user_id"),
        Index("ix_ev_code", "code"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    code = Column(String(6), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────────────
    user = relationship("User", back_populates="email_verifications")


class Question(Base):
    """Question model for quizzes"""
    __tablename__ = "questions"
    __table_args__ = (
        Index("ix_question_classroom_id", "classroom_id"),
        Index("ix_question_document_id", "document_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True)
    text = Column(Text, nullable=False)
    options = Column(Text, nullable=False)  # JSON array
    correct_answer = Column(String(255), nullable=False)
    elo_rating = Column(Integer, default=1000)
    classroom_id = Column(Integer, ForeignKey("classes.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    created_by_teacher = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_approved = Column(Boolean, default=False)
    teacher_analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # ── Relationships ─────────────────────────────────────────────────────
    classroom = relationship("Classroom", back_populates="questions")
    document = relationship("Document", back_populates="questions")
    created_by_teacher_rel = relationship(
        "User",
        back_populates="created_questions",
        foreign_keys=[created_by_teacher]
    )
    elo_history = relationship("EloHistory", back_populates="question")


class Document(Base):
    """Document model for uploaded course materials"""
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_document_classroom_id", "classroom_id"),
        Index("ix_document_teacher_id", "teacher_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True)
    classroom_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    gpt_status = Column(String(50), default="pending")  # pending|processing|completed|failed
    reading_time_seconds = Column(Integer, default=90)
    story_text = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now(), index=True)

    # ── Relationships ─────────────────────────────────────────────────────
    classroom = relationship("Classroom", back_populates="documents")
    teacher = relationship("User", back_populates="documents", foreign_keys=[teacher_id])
    questions = relationship("Question", back_populates="document")


class EloHistory(Base):
    """ELO rating change history"""
    __tablename__ = "elo_history"
    __table_args__ = (
        Index("ix_eh_user_id", "user_id"),
        Index("ix_eh_question_id", "question_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=True)
    elo_after = Column(Integer, nullable=False)
    delta = Column(Integer, nullable=False)
    correct = Column(Boolean, nullable=False)
    solve_time_seconds = Column(Integer, nullable=True)
    hint_used = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # ── Relationships ─────────────────────────────────────────────────────
    user = relationship("User", back_populates="elo_history")
    question = relationship("Question", back_populates="elo_history")


class StoryProgress(Base):
    """Student story/chapter progress"""
    __tablename__ = "story_progress"
    __table_args__ = (
        Index("ix_sp_user_id", "user_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chapter = Column(Integer, default=1)
    message = Column(Text)
    unlocked_at = Column(DateTime, server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────────────
    user = relationship("User", back_populates="story_progress")
