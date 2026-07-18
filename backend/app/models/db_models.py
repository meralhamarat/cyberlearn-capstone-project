from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="student")
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    teacher_code = Column(String(50), nullable=True, unique=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classes.id"), nullable=True, index=True)
    elo_rating = Column(Integer, default=1000)
    story_chapter = Column(Integer, default=1)
    consecutive_failures = Column(Integer, default=0)
    avatar = Column(String(50), default="warrior-1")
    created_at = Column(DateTime, server_default=func.now())

    # ── Relationships ──────────────────────────────────────────────────────
    classroom = relationship("Classroom", back_populates="students", foreign_keys=[classroom_id])
    teacher_classrooms = relationship("TeacherClassroom", back_populates="teacher", foreign_keys="TeacherClassroom.teacher_id")
    email_verifications = relationship("EmailVerification", back_populates="user")
    elo_history = relationship("EloHistory", back_populates="user")
    story_progress = relationship("StoryProgress", back_populates="user")
    documents = relationship("Document", back_populates="teacher", foreign_keys="Document.teacher_id")
    created_questions = relationship("Question", back_populates="created_by_teacher_rel", foreign_keys="Question.created_by_teacher")
    created_classrooms = relationship("Classroom", back_populates="creator", foreign_keys="Classroom.created_by")


class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(Text, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)


class EmailVerification(Base):
    __tablename__ = "email_verifications"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    code = Column(String(6), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # ── Relationships ──────────────────────────────────────────────────────
    user = relationship("User", back_populates="email_verifications")


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    text = Column(Text, nullable=False)
    options = Column(Text, nullable=False)
    correct_answer = Column(String(255), nullable=False)
    elo_rating = Column(Integer, default=1000)
    classroom_id = Column(Integer, ForeignKey("classes.id"), nullable=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    created_by_teacher = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_approved = Column(Boolean, default=False)
    teacher_analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # ── Relationships ──────────────────────────────────────────────────────
    classroom = relationship("Classroom", back_populates="questions")
    document = relationship("Document", back_populates="questions")
    created_by_teacher_rel = relationship("User", back_populates="created_questions", foreign_keys=[created_by_teacher])
    elo_history = relationship("EloHistory", back_populates="question")


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    classroom_id = Column(Integer, ForeignKey("classes.id"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    gpt_status = Column(String(50), default="pending")
    reading_time_seconds = Column(Integer, default=90)
    story_text = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now())

    # ── Relationships ──────────────────────────────────────────────────────
    classroom = relationship("Classroom", back_populates="documents")
    teacher = relationship("User", back_populates="documents", foreign_keys=[teacher_id])
    questions = relationship("Question", back_populates="document")


class StoryProgress(Base):
    __tablename__ = "story_progress"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chapter = Column(Integer, default=1)
    message = Column(Text)
    unlocked_at = Column(DateTime, server_default=func.now())

    # ── Relationships ──────────────────────────────────────────────────────
    user = relationship("User", back_populates="story_progress")


class EloHistory(Base):
    __tablename__ = "elo_history"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=True)
    elo_after = Column(Integer, nullable=False)
    delta = Column(Integer, nullable=False)
    correct = Column(Boolean, nullable=False)
    solve_time_seconds = Column(Integer, nullable=True)
    hint_used = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    # ── Relationships ──────────────────────────────────────────────────────
    user = relationship("User", back_populates="elo_history")
    question = relationship("Question", back_populates="elo_history")


class Classroom(Base):
    __tablename__ = "classes"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # ── Relationships ──────────────────────────────────────────────────────
    creator = relationship("User", back_populates="created_classrooms", foreign_keys=[created_by])
    students = relationship("User", back_populates="classroom", foreign_keys="User.classroom_id")
    teacher_classrooms = relationship("TeacherClassroom", back_populates="classroom")
    documents = relationship("Document", back_populates="classroom")
    questions = relationship("Question", back_populates="classroom")


class TeacherClassroom(Base):
    __tablename__ = "teacher_classrooms"
    __table_args__ = (
        UniqueConstraint("teacher_id", "classroom_id", name="uq_teacher_classrooms"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # ── Relationships ──────────────────────────────────────────────────────
    teacher = relationship("User", back_populates="teacher_classrooms", foreign_keys=[teacher_id])
    classroom = relationship("Classroom", back_populates="teacher_classrooms")