"""Audit log viewer. Admins see only their own actions; super-admins see all."""
from fastapi import APIRouter, Depends

from .. import store
from ..permissions import Role
from ..security import CurrentAdmin, get_current_admin

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def list_audit(limit: int = 200, admin: CurrentAdmin = Depends(get_current_admin)):
    rows = store.collection("audit_logs").list()
    if admin.role != Role.SUPERADMIN:
        rows = [r for r in rows if r.get("actorEmail") == admin.email]
    rows.sort(key=lambda r: r.get("timestampMillis", 0), reverse=True)
    return rows[:limit]
