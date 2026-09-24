"""Login + "who am I". Admin accounts live in the ``admin_users`` collection
with bcrypt-hashed passwords. Tokens are JWTs carrying the role."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from .. import store
from ..permissions import ADMIN_CAPS, Cap, Role, has_cap
from ..schemas import LoginRequest, TokenResponse
from ..security import (CurrentAdmin, create_access_token, get_current_admin,
                        verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _authenticate(email: str, password: str) -> dict:
    email = email.strip().lower()
    rows = store.collection("admin_users").list(where={"email": email})
    if not rows:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    admin = rows[0]
    if not admin.get("active", True):
        raise HTTPException(status_code=403, detail="This admin account is disabled")
    if not verify_password(password, admin.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return admin


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    admin = _authenticate(body.email, body.password)
    token = create_access_token(sub=admin["email"], role=admin["role"], name=admin.get("name", ""))
    return TokenResponse(access_token=token, role=admin["role"],
                         name=admin.get("name", ""), email=admin["email"])


@router.post("/token", response_model=TokenResponse, include_in_schema=False)
def login_form(form: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 password-flow shim so FastAPI's /docs "Authorize" button works."""
    admin = _authenticate(form.username, form.password)
    token = create_access_token(sub=admin["email"], role=admin["role"], name=admin.get("name", ""))
    return TokenResponse(access_token=token, role=admin["role"],
                         name=admin.get("name", ""), email=admin["email"])


@router.get("/me")
def me(admin: CurrentAdmin = Depends(get_current_admin)):
    # Send the resolved capability list so the frontend can hide/show controls.
    caps = [c.value for c in Cap] if admin.role == Role.SUPERADMIN else [c.value for c in ADMIN_CAPS]
    return {"email": admin.email, "name": admin.name, "role": admin.role, "capabilities": caps}
