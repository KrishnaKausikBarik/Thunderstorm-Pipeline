import os
import random
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Allow CORS for Vercel and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory OTP store (keyed by email) ─────────────────────────
# Note: Vercel serverless functions are ephemeral. In-memory state may be lost
# across requests if cold starts occur or scaled. However, Vercel caches global
# state between warm invocations, which usually works for 5-minute OTPs. 
# A more robust solution uses Firestore/Redis, but this matches the Render behavior.
_otp_store: dict = {}
OTP_EXPIRY_SECONDS = 300  # 5 minutes

# ── Firebase Admin SDK init ──────────────────────────────────────
_firebase_app = None

def _init_firebase():
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


# ── Schemas ──────────────────────────────────────────────────────
class SendOTPRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str


# ── Routes ───────────────────────────────────────────────────────
@app.post("/api/auth/send-otp")
async def send_otp_endpoint(req: SendOTPRequest):
    email = req.email.lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    otp = f"{random.randint(100000, 999999)}"
    _otp_store[email] = {"otp": otp, "created_at": time.time()}

    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_APP_PASSWORD")

    if not smtp_email or not smtp_password:
        raise HTTPException(status_code=500, detail="SMTP_EMAIL and SMTP_APP_PASSWORD env vars are required for sending OTP emails.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Thunderstorm Pipeline – Your sign-in code: {otp}"
    msg["From"] = f"Thunderstorm Pipeline <{smtp_email}>"
    msg["To"] = email

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

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, email, msg.as_string())
    except Exception as e:
        print(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "OTP sent successfully."}


@app.post("/api/auth/verify-otp")
async def verify_otp_endpoint(req: VerifyOTPRequest):
    email = req.email.lower().strip()
    record = _otp_store.get(email)

    if not record:
        raise HTTPException(status_code=400, detail="OTP invalid or expired.")
    if time.time() - record["created_at"] > OTP_EXPIRY_SECONDS:
        _otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP expired.")
    if record["otp"] != req.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid OTP.")

    _otp_store.pop(email, None)

    # Verify user's email in Firebase
    _init_firebase()
    try:
        user = firebase_auth.get_user_by_email(email)
        firebase_auth.update_user(user.uid, email_verified=True)
    except firebase_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found in Firebase.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "Email verified successfully."}
