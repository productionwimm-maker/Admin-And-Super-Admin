"""Application settings, loaded from environment variables.

On Render you set these in the service's "Environment" tab. For local dev,
copy ``.env.example`` to ``.env`` (python-dotenv style — pydantic-settings
reads it automatically).
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Core ────────────────────────────────────────────────────────────────
    # Secret used to sign admin session JWTs. CHANGE THIS in production.
    jwt_secret: str = "change-me-in-production-please"
    jwt_expire_minutes: int = 60 * 12  # 12 hours

    # Comma-separated list of allowed browser origins for CORS, e.g.
    # "https://wimm-admin-web.onrender.com,http://localhost:5173"
    cors_origins: str = "*"

    # ── Firestore ───────────────────────────────────────────────────────────
    # When true the API serves seeded in-memory sample data and ignores
    # Firebase entirely — useful to deploy & click around before wiring creds.
    use_mock: bool = True

    # Either paste the whole service-account JSON here (FIREBASE_SERVICE_ACCOUNT)
    # or point GOOGLE_APPLICATION_CREDENTIALS at a file. When use_mock=false one
    # of these must be set.
    firebase_service_account: str = ""
    firebase_project_id: str = "where-is-my-medicine-3aaaa"
    firebase_storage_bucket: str = "where-is-my-medicine-3aaaa.firebasestorage.app"

    # ── Seed accounts (created on boot if no admins exist) ───────────────────
    # Default login credentials. Change them in production via env vars.
    seed_superadmin_email: str = "superadmin@whereismymedicine.com"
    seed_superadmin_password: str = "Superadmin@Wimm@2026"
    seed_superadmin_name: str = "Super Admin"

    seed_admin_email: str = "admin@whereismymedicine.com"
    seed_admin_password: str = "Admin@Wimm@2026"
    seed_admin_name: str = "Admin"

    # ── Razorpay (for refunds & payout reconciliation) ───────────────────────
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    @property
    def cors_origin_list(self) -> List[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
