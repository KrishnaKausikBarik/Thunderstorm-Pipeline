"""
Email OTP Authentication Module
Handles OTP generation, email sending (via Gmail SMTP), and Firebase custom token creation.
"""
import os
import random
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

# ── In-memory OTP store (keyed by email) ─────────────────────────
# Structure: { email: { "otp": "123456", "created_at": timestamp } }
_otp_store: dict = {}
OTP_EXPIRY_SECONDS = 300  # 5 minutes

# ── Firebase Admin SDK init ──────────────────────────────────────
_firebase_app = None

def _init_firebase():
    """Lazy-init Firebase Admin SDK (using service account JSON or env var)."""
    global _firebase_app
    if _firebase_app is not None:
        return

    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "service-account.json")
    if os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
    elif os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"):
        import json
        sa_dict = json.loads(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))
        cred = credentials.Certificate(sa_dict)
    else:
        raise RuntimeError(
            "Firebase Admin SDK requires a service account. "
            "Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON env var."
        )
    _firebase_app = firebase_admin.initialize_app(cred)


# ── OTP helpers ──────────────────────────────────────────────────
def generate_otp() -> str:
    return f"{random.randint(100000, 999999)}"


def store_otp(email: str, otp: str):
    _otp_store[email.lower()] = {"otp": otp, "created_at": time.time()}


def verify_otp(email: str, otp: str) -> bool:
    record = _otp_store.get(email.lower())
    if not record:
        return False
    if time.time() - record["created_at"] > OTP_EXPIRY_SECONDS:
        _otp_store.pop(email.lower(), None)
        return False
    if record["otp"] != otp:
        return False
    # OTP is valid — consume it
    _otp_store.pop(email.lower(), None)
    return True


# ── Email sending ────────────────────────────────────────────────
def send_otp_email(to_email: str, otp: str):
    """Send OTP code via Gmail SMTP."""
    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_APP_PASSWORD")

    if not smtp_email or not smtp_password:
        raise RuntimeError(
            "SMTP_EMAIL and SMTP_APP_PASSWORD env vars are required for sending OTP emails."
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Thunderstorm Pipeline – Your sign-in code: {otp}"
    msg["From"] = f"Thunderstorm Pipeline <{smtp_email}>"
    msg["To"] = to_email

    html_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d0d14; border-radius: 16px; border: 1px solid rgba(139,92,246,0.3);">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #ffffff; font-size: 22px; margin: 0;">Thunderstorm Pipeline</h1>
            <p style="color: #a1a1aa; font-size: 14px; margin-top: 8px;">Your one-time verification code</p>
        </div>
        <div style="background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.1)); border: 1px solid rgba(139,92,246,0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #ffffff; font-family: 'Courier New', monospace;">{otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
            This code expires in <strong style="color: #a1a1aa;">5 minutes</strong>.<br>
            If you didn't request this code, you can safely ignore this email.
        </p>
    </div>
    """
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, to_email, msg.as_string())


# ── Firebase custom token ────────────────────────────────────────
def create_custom_token(email: str) -> str:
    """Create a Firebase custom auth token for the given email.
    If a Firebase user with this email doesn't exist, create one first.
    """
    _init_firebase()

    try:
        user = firebase_auth.get_user_by_email(email)
    except firebase_auth.UserNotFoundError:
        user = firebase_auth.create_user(email=email)

    token = firebase_auth.create_custom_token(user.uid)
    return token.decode("utf-8") if isinstance(token, bytes) else token
