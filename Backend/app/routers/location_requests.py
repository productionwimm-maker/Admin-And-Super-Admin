"""Pharmacy location-change approval.

A pharmacy's location is locked after it's first set. To change it the pharmacy
submits a request (answering a few questions); the Admin / Super-Admin reviews
it here. Approving sets `locationUnlocked=true` on the pharmacy's account, which
lets the pharmacy app edit the map once; the app re-locks after saving.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import audit, store
from ..security import CurrentAdmin, require_superadmin

router = APIRouter(prefix="/api/location-requests", tags=["location-requests"])
COL = "location_change_requests"


class ReviewBody(BaseModel):
    note: str = ""


@router.get("")
def list_requests(status: str | None = None,
                  admin: CurrentAdmin = Depends(require_superadmin)):
    rows = store.collection(COL).list({"status": status} if status else None)
    rows.sort(key=lambda r: r.get("createdAtMillis", 0), reverse=True)
    return rows


@router.post("/{req_id}/approve")
def approve(req_id: str, body: ReviewBody, admin: CurrentAdmin = Depends(require_superadmin)):
    rec = store.collection(COL).get(req_id)
    if not rec:
        raise HTTPException(404, "Request not found")
    # Normalise to last 10 digits and build the pharmacy_accounts id.
    digits = "".join(c for c in str(rec.get("pharmacyPhone", "")) if c.isdigit())[-10:]
    if not digits:
        raise HTTPException(400, "Request has no pharmacy phone")
    # Unlock the pharmacy so it can edit its location once.
    store.collection("pharmacy_accounts").update(f"+91{digits}", {"locationUnlocked": True})
    store.collection(COL).update(req_id, {
        "status": "approved",
        "reviewedBy": admin.email,
        "reviewNote": body.note,
        "reviewedAtMillis": store.now_ms(),
    })
    audit.log(admin, "location.change.approve", req_id, {"phone": digits})
    return {"ok": True, "status": "approved"}


@router.post("/{req_id}/reject")
def reject(req_id: str, body: ReviewBody, admin: CurrentAdmin = Depends(require_superadmin)):
    rec = store.collection(COL).get(req_id)
    if not rec:
        raise HTTPException(404, "Request not found")
    store.collection(COL).update(req_id, {
        "status": "rejected",
        "reviewedBy": admin.email,
        "reviewNote": body.note,
        "reviewedAtMillis": store.now_ms(),
    })
    audit.log(admin, "location.change.reject", req_id)
    return {"ok": True, "status": "rejected"}
