import os
from datetime import datetime, timedelta
from jose import JWTError, jwt # pip install "python-jose[cryptography]" gerekli
from typing import Optional

# GÜVENLİK AYARLARI (Gerçek uygulamada .env dosyasında tutulur)
SECRET_KEY = "cyberlearn_secret_key_99" # Burayı istediğin bir string yap
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 Günlük süre

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Kullanıcı bilgileriyle (payload) bir JWT üretir."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

class JwtService:
    """Frontend/Client mantığı için Python yardımcı sınıfı."""
    TOKEN_KEY = "cyber_token"
    _token_storage = {}  

    @classmethod
    def save_token(cls, token: str) -> None:
        cls._token_storage[cls.TOKEN_KEY] = token

    @classmethod
    def get_token(cls) -> Optional[str]:
        return cls._token_storage.get(cls.TOKEN_KEY)

    @classmethod
    def destroy_token(cls) -> None:
        if cls.TOKEN_KEY in cls._token_storage:
            del cls._token_storage[cls.TOKEN_KEY]

    @classmethod
    def is_authenticated(cls) -> bool:
        return cls.get_token() is not None

    @classmethod
    def get_auth_header(cls) -> dict:
        token = cls.get_token()
        if token:
            return {"Authorization": f"Bearer {token}"}
        return {}
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models.db_models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kimlik bilgileri doğrulanamadı",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Senin dosyanın yukarısındaki SECRET_KEY ve ALGORITHM değişkenlerini kullanıyor
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    # Veritabanından kullanıcı ID'sine göre arama yapıyoruz
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    return user