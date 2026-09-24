"""Append-only audit trail. Every state-changing admin action calls
:func:`log` so the dashboard can answer "who approved / banned / refunded what".
"""
from typing import Any, Dict, Optional

from . import store
from .security import CurrentAdmin


def log(actor: CurrentAdmin, action: str, target: str = "",
        details: Optional[Dict[str, Any]] = None) -> None:
    store.collection("audit_logs").add({
        "actorEmail": actor.email,
        "actorRole": actor.role,
        "action": action,
        "target": target,
        "details": details or {},
        "timestampMillis": store.now_ms(),
    })
