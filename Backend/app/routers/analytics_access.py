"""Gated analytics access — approval + monthly unlock-date control.

A pharmacy requests analytics access (with a reason) from the app. Admin OR
super-admin can approve/revoke. Only a super-admin can change the monthly
unlock date (mode + custom day); changing it stamps `dateChangedAtMillis`, which
the pharmacy app watches to notify the pharmacy. Date math (incl. short-month
fallback to month-end) is done in the app + the reminders Cloud Function.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import audit, store
from ..security import CurrentAdmin, get_current_admin, require_superadmin

router = APIRouter(prefix="/api/analytics-access", tags=["analytics-access"])
COL = "analytics_access"

VALID_MODES = ("joinDay", "monthStart", "monthEnd", "custom")


class ApproveBody(BaseModel):
    note: str = ""


class DateBody(BaseModel):
    dateMode: str = "joinDay"
    customDay: int = 1


@router.get("")
def list_access(status: str | None = None,
                admin: CurrentAdmin = Depends(get_current_admin)):
    rows = store.collection(COL).list()
    rows.sort(key=lambda r: r.get("requestedAtMillis", 0), reverse=True)
    if status == "pending":
        rows = [r for r in rows if not r.get("approved")]
    elif status == "approved":
        rows = [r for r in rows if r.get("approved")]
    return rows


@router.post("/{uid}/approve")
def approve(uid: str, body: ApproveBody, admin: CurrentAdmin = Depends(get_current_admin)):
    if not store.collection(COL).get(uid):
        raise HTTPException(404, "Request not found")
    store.collection(COL).update(uid, {
        "approved": True,
        "approvedAtMillis": store.now_ms(),
        "approvedBy": admin.email,
        "status": "APPROVED",
    })
    audit.log(admin, "analytics.access.approve", uid, {"note": body.note})
    return {"ok": True, "approved": True}


@router.post("/{uid}/revoke")
def revoke(uid: str, admin: CurrentAdmin = Depends(get_current_admin)):
    if not store.collection(COL).get(uid):
        raise HTTPException(404, "Request not found")
    store.collection(COL).update(uid, {"approved": False, "status": "REVOKED"})
    audit.log(admin, "analytics.access.revoke", uid)
    return {"ok": True, "approved": False}


@router.post("/{uid}/date")
def set_date(uid: str, body: DateBody, admin: CurrentAdmin = Depends(require_superadmin)):
    if body.dateMode not in VALID_MODES:
        raise HTTPException(400, "Invalid dateMode")
    if not store.collection(COL).get(uid):
        raise HTTPException(404, "Request not found")
    store.collection(COL).update(uid, {
        "dateMode": body.dateMode,
        "customDay": max(1, min(31, int(body.customDay or 1))),
        "dateChangedAtMillis": store.now_ms(),
    })
    audit.log(admin, "analytics.access.date", uid, {"mode": body.dateMode, "day": body.customDay})
    return {"ok": True}
