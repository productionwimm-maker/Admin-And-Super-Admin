"""WIMM Admin Dashboard API.

Run locally:  uvicorn app.main:app --reload --port 8000
On Render:    uvicorn app.main:app --host 0.0.0.0 --port $PORT
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import store
from .config import settings
from .permissions import Role
from .routers import (admins, analytics, audit, auth, catalog, complaints, config,
                      coverage, customers, finance, notifications, orders,
                      pharmacies, reservations, app_update, poster, surveys)
from .security import hash_password

log = logging.getLogger("wimm.admin")

app = FastAPI(
    title="WhereIsMyMedicine — Admin & Super Admin API",
    version="1.0.0",
    description="Backend for the WIMM admin dashboard. Roles: admin, superadmin.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, pharmacies, orders, reservations, complaints, customers, finance, analytics,
          catalog, notifications, admins, audit, config, app_update, poster, coverage, surveys):
    app.include_router(r.router)


@app.on_event("startup")
def seed_superadmin():
    """Create the default Admin + Super Admin accounts if none exist yet."""
    existing = store.collection("admin_users").list()
    if existing:
        return

    def _seed(email: str, name: str, role: str, password: str) -> None:
        store.collection("admin_users").add({
            "email": email.strip().lower(),
            "name": name,
            "role": role,
            "regions": [],
            "active": True,
            "passwordHash": hash_password(password),
            "createdAtMillis": store.now_ms(),
            "createdBy": "system",
        })

    _seed(settings.seed_superadmin_email, settings.seed_superadmin_name,
          Role.SUPERADMIN.value, settings.seed_superadmin_password)
    _seed(settings.seed_admin_email, settings.seed_admin_name,
          Role.ADMIN.value, settings.seed_admin_password)
    log.warning("Seeded default admin + super-admin (mock=%s). Change the passwords after first login.",
                settings.use_mock)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "mock": settings.use_mock, "project": settings.firebase_project_id}
