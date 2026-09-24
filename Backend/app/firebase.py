"""Firestore initialisation. Reads the service account either from the
FIREBASE_SERVICE_ACCOUNT env var (raw JSON) or GOOGLE_APPLICATION_CREDENTIALS
(file path). Returns ``None`` in mock mode so the rest of the app falls back
to seeded sample data.
"""
import json
from functools import lru_cache
from typing import Optional

from .config import settings


@lru_cache
def get_firestore():  # -> google.cloud.firestore.Client | None
    if settings.use_mock:
        return None

    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        if settings.firebase_service_account.strip():
            cred = credentials.Certificate(json.loads(settings.firebase_service_account))
            firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
        else:
            # Falls back to GOOGLE_APPLICATION_CREDENTIALS / ADC.
            firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})
    return firestore.client()
