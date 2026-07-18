from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
import os
from dotenv import load_dotenv

load_dotenv()

# Secret key — .env'den oku
SESSION_SECRET_KEY = os.getenv("SECRET_KEY", "cyberlearn_super_secret_key_change_in_prod")

# İzin verilen CORS originleri — ALLOWED_ORIGINS env var'ından oku
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# Admin paneli şifreleri
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "cyber123")

from app.database import engine
from app.models.db_models import (
    User, EmailVerification, Classroom, TeacherClassroom,
    Document, Question, EloHistory, StoryProgress,
)
from app.routers import auth, questions, story, teacher, student
from app.routers import admin as admin_router

app = FastAPI(title="CyberLearn API")

# ── Upload klasörünü statik olarak sun ──────────────────────────────────────
os.makedirs("uploads/documents", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ════════════════════════════════════════════════════════════════════════════
# 1. MIDDLEWARE  (SessionMiddleware EN ÖNCE olmalı — sqladmin session okur)
# ════════════════════════════════════════════════════════════════════════════
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET_KEY)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ════════════════════════════════════════════════════════════════════════════
# 2. SQLADMIN AUTH
# ════════════════════════════════════════════════════════════════════════════
class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            request.session.update({"admin_token": "cyber_access_granted"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("admin_token")
        return token == "cyber_access_granted"


authentication_backend = AdminAuth(secret_key=SESSION_SECRET_KEY)


# ════════════════════════════════════════════════════════════════════════════
# 3. SQLADMIN PANEL
# ════════════════════════════════════════════════════════════════════════════
admin = Admin(app, engine, base_url="/admin", authentication_backend=authentication_backend)


# ── Kullanıcılar ─────────────────────────────────────────────────────────────
class UserAdmin(ModelView, model=User):
    column_list = [
        User.id, User.first_name, User.last_name, User.email,
        User.role, User.is_verified, User.is_active, User.teacher_code,
        User.classroom_id, User.elo_rating, User.created_at,
    ]
    column_details_list = [
        User.id, User.first_name, User.last_name, User.email,
        User.role, User.is_verified, User.is_active, User.teacher_code,
        User.classroom_id, User.elo_rating, User.story_chapter,
        User.avatar, User.consecutive_failures, User.created_at,
    ]
    column_searchable_list = [User.first_name, User.last_name, User.email, User.teacher_code]

    column_sortable_list = [User.id, User.elo_rating, User.created_at, User.role]

    # ❌ ESKİ: ["hashed_password", "elo_history", "classroom", "teacher_classrooms"]
    # ✅ DOĞRU: Sadece gerçek relationship adlarını yaz (db_models.py ile eşleşmeli)
    form_excluded_columns = [
        "hashed_password",
        "email_verifications",
        "elo_history",
        "story_progress",
        "documents",
        "created_questions",
        "created_classrooms",
        "teacher_classrooms",
        "classroom",
    ]
    page_size = 25
    page_size_options = [10, 25, 50, 100]
    name = "Kullanıcı"
    name_plural = "Kullanıcılar"
    icon = "fa-solid fa-user"
    column_labels = {
        User.id: "ID",
        User.first_name: "Ad",
        User.last_name: "Soyad",
        User.email: "E-posta",
        User.role: "Rol",
        User.is_verified: "Doğrulandı mı?",
        User.teacher_code: "Öğretmen Kodu",
        User.classroom_id: "Sınıf ID",
        User.elo_rating: "ELO Puanı",
        User.story_chapter: "Hikaye Bölümü",
        User.created_at: "Kayıt Tarihi",
    }


# ── Doğrulama Kodları ────────────────────────────────────────────────────────
class VerificationAdmin(ModelView, model=EmailVerification):
    column_list = [
        EmailVerification.id,
        EmailVerification.user_id,
        EmailVerification.code,
        EmailVerification.is_used,
        EmailVerification.expires_at,
        EmailVerification.created_at,
    ]
    column_searchable_list = [EmailVerification.code]

    column_sortable_list = [EmailVerification.id, EmailVerification.is_used, EmailVerification.created_at]

    # ✅ Sadece gerçek relationship adı
    form_excluded_columns = ["user"]

    column_labels = {
        EmailVerification.id: "ID",
        EmailVerification.user_id: "Kullanıcı ID",
        EmailVerification.code: "Doğrulama Kodu",
        EmailVerification.is_used: "Kullanıldı mı?",
        EmailVerification.expires_at: "Son Kullanma",
        EmailVerification.created_at: "Oluşturma Tarihi",
    }
    page_size = 25
    name = "E-posta Doğrulama"
    name_plural = "Doğrulama Kodları"
    icon = "fa-solid fa-envelope"


# ── Sınıflar ─────────────────────────────────────────────────────────────────
class ClassroomAdmin(ModelView, model=Classroom):
    column_list = [
        Classroom.id, Classroom.name, Classroom.code,
        Classroom.created_by, Classroom.created_at,
    ]
    column_searchable_list = [Classroom.name, Classroom.code]
    column_sortable_list = [Classroom.id, Classroom.name, Classroom.code, Classroom.created_at]

    # ✅ Gerçek relationship adları
    form_excluded_columns = ["creator", "students", "teacher_classrooms", "documents", "questions"]

    column_labels = {
        Classroom.id: "ID",
        Classroom.name: "Sınıf Adı",
        Classroom.code: "Sınıf Kodu",
        Classroom.created_by: "Oluşturan (ID)",
        Classroom.created_at: "Oluşturma Tarihi",
    }
    page_size = 25
    name = "Sınıf"
    name_plural = "Sınıflar"
    icon = "fa-solid fa-school"


# ── Öğretmen-Sınıf Atamaları ─────────────────────────────────────────────────
class TeacherClassroomAdmin(ModelView, model=TeacherClassroom):
    column_list = [
        TeacherClassroom.id,
        TeacherClassroom.teacher_id,
        TeacherClassroom.classroom_id,
        TeacherClassroom.created_at,
    ]
    column_sortable_list = [
        TeacherClassroom.id,
        TeacherClassroom.teacher_id,
        TeacherClassroom.classroom_id,
    ]

    # ✅ Gerçek relationship adları
    form_excluded_columns = ["teacher", "classroom"]

    column_labels = {
        TeacherClassroom.id: "ID",
        TeacherClassroom.teacher_id: "Öğretmen ID",
        TeacherClassroom.classroom_id: "Sınıf ID",
        TeacherClassroom.created_at: "Atama Tarihi",
    }
    page_size = 25
    name = "Öğretmen-Sınıf"
    name_plural = "Öğretmen-Sınıf Atamaları"
    icon = "fa-solid fa-chalkboard-teacher"


# ── Dokümanlar ───────────────────────────────────────────────────────────────
class DocumentAdmin(ModelView, model=Document):
    column_list = [
        Document.id, Document.classroom_id, Document.teacher_id,
        Document.original_name, Document.gpt_status,
        Document.reading_time_seconds, Document.uploaded_at,
    ]
    column_searchable_list = [Document.original_name]

    column_sortable_list = [Document.id, Document.gpt_status, Document.uploaded_at, Document.classroom_id]

    # ✅ Gerçek relationship adları
    form_excluded_columns = ["classroom", "teacher", "questions"]

    column_labels = {
        Document.id: "ID",
        Document.classroom_id: "Sınıf ID",
        Document.teacher_id: "Öğretmen ID",
        Document.original_name: "Dosya Adı",
        Document.gpt_status: "GPT Durumu",
        Document.reading_time_seconds: "Okuma Süresi (sn)",
        Document.uploaded_at: "Yüklenme Tarihi",
    }
    page_size = 25
    name = "Doküman"
    name_plural = "Dokümanlar"
    icon = "fa-solid fa-file-pdf"


# ── Sorular ──────────────────────────────────────────────────────────────────
class QuestionAdmin(ModelView, model=Question):
    column_list = [
        Question.id, Question.text, Question.correct_answer,
        Question.classroom_id, Question.document_id,
        Question.is_approved, Question.elo_rating, Question.created_at,
    ]
    column_searchable_list = [Question.text, Question.correct_answer]

    column_sortable_list = [Question.id, Question.elo_rating, Question.is_approved, Question.created_at]

    # ✅ Gerçek relationship adları
    form_excluded_columns = ["classroom", "document", "created_by_teacher_rel", "elo_history"]

    column_labels = {
        Question.id: "ID",
        Question.text: "Soru Metni",
        Question.correct_answer: "Doğru Cevap",
        Question.classroom_id: "Sınıf ID",
        Question.document_id: "Doküman ID",
        Question.is_approved: "Onaylandı mı?",
        Question.elo_rating: "ELO Zorluğu",
        Question.created_at: "Oluşturma Tarihi",
    }
    page_size = 25
    name = "Soru"
    name_plural = "Sorular"
    icon = "fa-solid fa-question-circle"


# ── ELO Geçmişi (Bonus — izleme için) ───────────────────────────────────────
class EloHistoryAdmin(ModelView, model=EloHistory):
    column_list = [
        EloHistory.id, EloHistory.user_id, EloHistory.elo_after,
        EloHistory.delta, EloHistory.correct,
        EloHistory.solve_time_seconds, EloHistory.hint_used, EloHistory.created_at,
    ]

    column_sortable_list = [EloHistory.id, EloHistory.elo_after, EloHistory.created_at]
    form_excluded_columns = ["user", "question"]
    column_labels = {
        EloHistory.id: "ID",
        EloHistory.user_id: "Kullanıcı ID",
        EloHistory.elo_after: "ELO Sonrası",
        EloHistory.delta: "Değişim",
        EloHistory.correct: "Doğru mu?",
        EloHistory.solve_time_seconds: "Çözme Süresi (sn)",
        EloHistory.hint_used: "İpucu Kullanıldı mı?",
        EloHistory.created_at: "Tarih",
    }
    page_size = 50
    name = "ELO Kaydı"
    name_plural = "ELO Geçmişi"
    icon = "fa-solid fa-chart-line"
    can_create = False   # ELO kayıtları sadece sistem tarafından oluşturulur
    can_edit = False


# View'leri kaydet
admin.add_view(UserAdmin)
admin.add_view(VerificationAdmin)
admin.add_view(ClassroomAdmin)
admin.add_view(TeacherClassroomAdmin)
admin.add_view(DocumentAdmin)
admin.add_view(QuestionAdmin)
admin.add_view(EloHistoryAdmin)


# ════════════════════════════════════════════════════════════════════════════
# 4. ROUTERS
# ════════════════════════════════════════════════════════════════════════════
app.include_router(auth.router)
app.include_router(questions.router)
app.include_router(story.router)
app.include_router(teacher.router)
app.include_router(student.router)
app.include_router(admin_router.router)


# ════════════════════════════════════════════════════════════════════════════
# 5. HEALTH CHECK
# ════════════════════════════════════════════════════════════════════════════
@app.get("/")
async def root():
    return {"message": "CyberLearn API Aktif!", "version": "2.0"}
