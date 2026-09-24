"""Orders, live delivery status, dispute chats."""
from fastapi import APIRouter, Depends, HTTPException

from .. import store
from ..config import settings
from ..firebase import get_firestore
from ..permissions import Cap
from ..security import CurrentAdmin, require

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("")
def list_orders(status: str | None = None, pharmacyUid: str | None = None,
                admin: CurrentAdmin = Depends(require(Cap.VIEW_ORDERS))):
    rows = store.collection("orders").list()
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if pharmacyUid:
        rows = [r for r in rows if r.get("pharmacyUid") == pharmacyUid]
    rows.sort(key=lambda r: r.get("createdAtMillis", 0), reverse=True)
    return rows


@router.get("/{order_id}")
def order_detail(order_id: str, admin: CurrentAdmin = Depends(require(Cap.VIEW_ORDERS))):
    doc = store.collection("orders").get(order_id)
    if not doc:
        raise HTTPException(404, "Order not found")
    return doc


@router.get("/{order_id}/chat")
def order_chat(order_id: str, admin: CurrentAdmin = Depends(require(Cap.RESOLVE_DISPUTES))):
    """Read the customer<->pharmacy chat thread for dispute resolution."""
    if settings.use_mock:
        doc = store.collection("chats").get(order_id)
        return {"orderId": order_id, "messages": (doc or {}).get("messages", [])}
    # Real Firestore: chats/{orderId}/messages/{messageId}
    db = get_firestore()
    msgs = (db.collection("chats").document(order_id).collection("messages")
            .order_by("timestampMillis").stream())
    return {"orderId": order_id,
            "messages": [dict(m.to_dict() or {}, id=m.id) for m in msgs]}
