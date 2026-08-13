from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(*, user_id: str, tenant_id: str, email: str, role: str = "admin") -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "email": email,
        "kind": "professional",
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.api_secret_key, algorithm=ALGORITHM)


def create_patient_access_token(*, patient_id: str, tenant_id: str, email: str) -> str:
    # Token separado do profissional (claim "kind") — get_current_patient rejeita um
    # token de profissional e vice-versa, mesmo os dois sendo HS256 com o mesmo segredo.
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": patient_id,
        "tenant_id": tenant_id,
        "email": email,
        "kind": "patient",
        "exp": expire,
    }
    return jwt.encode(payload, settings.api_secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.api_secret_key, algorithms=[ALGORITHM])
