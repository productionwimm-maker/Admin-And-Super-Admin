"""A thin collection abstraction used by every router.

In production it delegates to Firestore. In mock mode it operates on the
in-memory dictionaries seeded in ``mock_data.py`` so the dashboard is fully
browsable without any Firebase credentials.

The API surface is deliberately tiny — list / get / set / update / delete /
add / simple equality filter — which is all the dashboard needs.
"""
import time
import uuid
from typing import Any, Dict, List, Optional

from .config import settings
from .firebase import get_firestore
from . import mock_data


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id() -> str:
    return uuid.uuid4().hex


class Collection:
    def __init__(self, name: str):
        self.name = name

    # ── reads ────────────────────────────────────────────────────────────
    def list(self, where: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        where = where or {}
        if settings.use_mock:
            rows = [dict(v, id=k) for k, v in mock_data.store[self.name].items()]
        else:
            db = get_firestore()
            q = db.collection(self.name)
            for field, value in where.items():
                q = q.where(field, "==", value)
            docs = q.stream()
            return [dict(d.to_dict() or {}, id=d.id) for d in docs]
        # mock filtering
        for field, value in where.items():
            rows = [r for r in rows if r.get(field) == value]
        return rows

    def get(self, doc_id: str) -> Optional[Dict[str, Any]]:
        if settings.use_mock:
            row = mock_data.store[self.name].get(doc_id)
            return dict(row, id=doc_id) if row is not None else None
        db = get_firestore()
        snap = db.collection(self.name).document(doc_id).get()
        return dict(snap.to_dict() or {}, id=snap.id) if snap.exists else None

    # ── writes ───────────────────────────────────────────────────────────
    def set(self, doc_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        clean = {k: v for k, v in data.items() if k != "id"}
        if settings.use_mock:
            mock_data.store[self.name][doc_id] = clean
        else:
            get_firestore().collection(self.name).document(doc_id).set(clean)
        return dict(clean, id=doc_id)

    def update(self, doc_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        clean = {k: v for k, v in data.items() if k != "id"}
        if settings.use_mock:
            existing = mock_data.store[self.name].setdefault(doc_id, {})
            existing.update(clean)
        else:
            get_firestore().collection(self.name).document(doc_id).set(clean, merge=True)
        return self.get(doc_id) or {"id": doc_id}

    def add(self, data: Dict[str, Any]) -> Dict[str, Any]:
        doc_id = new_id()
        return self.set(doc_id, data)

    def delete(self, doc_id: str) -> None:
        if settings.use_mock:
            mock_data.store[self.name].pop(doc_id, None)
        else:
            get_firestore().collection(self.name).document(doc_id).delete()


def collection(name: str) -> Collection:
    return Collection(name)
