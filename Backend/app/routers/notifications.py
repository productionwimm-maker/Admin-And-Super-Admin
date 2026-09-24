"""Broadcast push notifications. Admins may only save regional drafts;
super-admins may send app-wide. Real delivery uses Firebase Cloud Messaging
(topic send) when not in mock mode and creds are present."""
from fastapi import APIRouter, Depends, HTTPException

from .. import audit, store
from ..config import settings
from ..permissions import Cap, has_cap
from ..schemas import BroadcastBody
from ..security import CurrentAdmin, require

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
COL = "broadcasts"


def _send_fcm(title: str, message: str, audience: str) -> str:
    """Send to an FCM topic ("customers" / "pharmacies" / "all")."""
    if settings.use_mock:
        return "mock-not-sent"
    from firebase_admin import messaging
    topic = {"customers": "customers", "pharmacies": "pharmacies"}.get(audience, "all")
    msg = messaging.Message(notification=messaging.Notification(title=title, body=message), topic=topic)
    return messaging.send(msg)


@router.get("")
def list_broadcasts(admin: CurrentAdmin = Depends(require(Cap.BROADCAST_DRAFT))):
    rows = store.collection(COL).list()
    rows.sort(key=lambda r: r.get("createdAtMillis", 0), reverse=True)
    return rows


@router.post("")
def create_broadcast(body: BroadcastBody,
                     admin: CurrentAdmin = Depends(require(Cap.BROADCAST_DRAFT))):
    sending = body.send
    if sending and not has_cap(admin.role, Cap.BROADCAST_SEND):
        raise HTTPException(403, "Admins can only save drafts — a Super Admin must send")

    status = "DRAFT"
    fcm_id = None
    if sending:
        fcm_id = _send_fcm(body.title, body.message, body.audience)
        status = "SENT"

    rec = store.collection(COL).add({
        "title": body.title, "message": body.message, "audience": body.audience,
        "region": body.region, "status": status, "fcmMessageId": fcm_id,
        "createdBy": admin.email, "createdAtMillis": store.now_ms(),
    })
    audit.log(admin, "broadcast.send" if sending else "broadcast.draft", rec["id"],
              {"audience": body.audience})
    return rec
