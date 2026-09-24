"""Password hashing, JWT issuing/verification, and the FastAPI auth
dependencies that gate every protected route by capability.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from .config import settings
from .permissions import Cap, Role, has_cap

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

ALGORITHM = "HS256"


# ── Passwords ────────────────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ── Tokens ───────────────────────────────────────────────────────────────────
def create_access_token(*, sub: str, role: str, name: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": sub, "role": role, "name": name, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


class CurrentAdmin(BaseModel):
    email: str
    role: str
    name: str


def get_current_admin(token: Optional[str] = Depends(oauth2_scheme)) -> CurrentAdmin:
    creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise creds_exc
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise creds_exc
    email = payload.get("sub")
    role = payload.get("role")
    if not email or role not in (Role.ADMIN, Role.SUPERADMIN):
        raise creds_exc
    return CurrentAdmin(email=email, role=role, name=payload.get("name", ""))


def require(cap: Cap):
    """Dependency factory: ``Depends(require(Cap.DELETE_PHARMACY))``."""

    def checker(admin: CurrentAdmin = Depends(get_current_admin)) -> CurrentAdmin:
        if not has_cap(admin.role, cap):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your role ({admin.role}) lacks capability '{cap.value}'",
            )
        return admin

    return checker


def require_superadmin(admin: CurrentAdmin = Depends(get_current_admin)) -> CurrentAdmin:
    if admin.role != Role.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Super Admin only")
    return admin
