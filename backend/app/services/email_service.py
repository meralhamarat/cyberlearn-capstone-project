import random
import string
import smtplib
import asyncio
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)


def generate_verification_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def _send_email_sync(to_email: str, subject: str, html_body: str) -> None:
    """Senkron SMTP gönderimi — asyncio.to_thread içinde çağrılır."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())
    logger.info(f"Email gönderildi: {to_email}")


async def send_verification_email(to_email: str, code: str, username: str) -> None:
    """Async wrapper — event loop'u bloklamaz."""
    subject = "E-posta Doğrulama Kodunuz"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; border-radius: 12px; background: #f9f9f9;">
      <h2 style="color: #1a1a2e;">Merhaba {username} 👋</h2>
      <p style="color: #555;">E-posta adresinizi doğrulamak için aşağıdaki kodu kullanın:</p>
      <div style="text-align:center; margin: 24px 0;">
        <span style="font-size: 40px; font-weight: bold; letter-spacing: 16px; color: #4f46e5;">{code}</span>
      </div>
      <p style="color: #888; font-size: 13px;">Bu kod <strong>15 dakika</strong> geçerlidir. Eğer bu isteği siz yapmadıysanız bu emaili görmezden gelin.</p>
    </div>
    """
    # smtplib blocking I/O'yu thread'e taşı
    await asyncio.to_thread(_send_email_sync, to_email, subject, html_body)