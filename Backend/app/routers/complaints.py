"""Customer complaints against pharmacies.

Customers file complaints from the Android app (writing directly to the
`complaints` Firestore collection). The dashboard lists them and lets an
admin/super-admin take one of a fixed set of actions, which is written back so
the customer sees it under "My Complaints" in the app.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import store
from ..permissions import Cap
from ..security import CurrentAdmin, require

router = APIRouter(prefix="/api/complaints", tags=["complaints"])

COL = "complaints"

# The fixed action vocabulary offered to admins (kept in sync with the panel UI).
ACTIONS = [
    "Warning issued",
    "Refund customer",
    "Temporarily suspend pharmacy",
    "Remove pharmacy offer",
    "Asked pharmacy for explanation",
    "Escalate to super-admin",
    "Mark as false report",
    "Blacklist pharmacy",
    "Adjust pharmacy rating",
    "Contacted customer",
    "Contacted pharmacy",
    "Issued apology credit",
    "Flagged for follow-up",
    "No action needed",
    "Resolved",
]

STATUSES = {"OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"}


class ComplaintAction(BaseModel):
    action: str
    note: str = ""
    status: str = "IN_REVIEW"


@router.get("")
def list_complaints(status: str | None = None, pharmacyUid: str | None = None,
                    admin: CurrentAdmin = Depends(require(Cap.VIEW_COMPLAINTS))):
    rows = store.collection(COL).list()
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if pharmacyUid:
        rows = [r for r in rows if r.get("pharmacyUid") == pharmacyUid]
    rows.sort(key=lambda r: r.get("createdAtMillis", 0), reverse=True)
    return rows


@router.get("/stats")
def complaint_stats(admin: CurrentAdmin = Depends(require(Cap.VIEW_COMPLAINTS))):
    rows = store.collection(COL).list()
    return {
        "total": len(rows),
        "open": sum(1 for r in rows if r.get("status") == "OPEN"),
        "inReview": sum(1 for r in rows if r.get("status") == "IN_REVIEW"),
        "resolved": sum(1 for r in rows if r.get("status") == "RESOLVED"),
        "dismissed": sum(1 for r in rows if r.get("status") == "DISMISSED"),
        "actions": ACTIONS,
    }


@router.get("/{complaint_id}")
def complaint_detail(complaint_id: str,
                     admin: CurrentAdmin = Depends(require(Cap.VIEW_COMPLAINTS))):
    doc = store.collection(COL).get(complaint_id)
    if not doc:
        raise HTTPException(404, "Complaint not found")
    return doc


@router.post("/{complaint_id}/action")
def take_action(complaint_id: str, body: ComplaintAction,
                admin: CurrentAdmin = Depends(require(Cap.MANAGE_COMPLAINTS))):
    doc = store.collection(COL).get(complaint_id)
    if not doc:
        raise HTTPException(404, "Complaint not found")
    if body.action not in ACTIONS:
        raise HTTPException(422, "Unknown action")
    status = body.status if body.status in STATUSES else "IN_REVIEW"
    return store.collection(COL).update(complaint_id, {
        "adminAction": body.action,
        "adminNote": body.note,
        "status": status,
        "actionByRole": admin.role,
        "actionAtMillis": store.now_ms(),
    })
