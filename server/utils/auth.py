import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY   = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", 8))


# ── Token helpers ────────────────────────────────────────────────────────────

def generate_token(user_id: int, username: str, role: str) -> str:
    payload = {
        "sub":      user_id,
        "username": username,
        "role":     role,
        "iat":      datetime.now(timezone.utc),
        "exp":      datetime.now(timezone.utc) + timedelta(hours=EXPIRY_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])


# ── Password helpers ─────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── Decorators ───────────────────────────────────────────────────────────────

def login_required(f):
    """Require a valid JWT in the Authorization header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = decode_token(token)
            request.current_user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


def roles_required(*roles):
    """Require the current user to have one of the specified roles."""
    def decorator(f):
        @wraps(f)
        
        def decorated(*args, **kwargs):
            if request.current_user.get("role") not in roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
