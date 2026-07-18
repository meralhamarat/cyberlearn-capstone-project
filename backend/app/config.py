from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Veritabanı
    DATABASE_URL: str = ""
    # JWT
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    # Gemini AI
    GEMINI_API_KEY: str = ""
    # Diğer
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"
    RESEND_API_KEY: str = ""
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    # Admin
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "cyber123"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()