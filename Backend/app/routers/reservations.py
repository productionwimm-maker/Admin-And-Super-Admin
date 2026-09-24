"""In-store reservations (reserve → pharmacy redeem).

Read-only for the dashboard. Reservations themselves are created and redeemed
by the Android app writing directly to Firestore (see
ReservationsFirestoreRepository.kt), mirroring how `orders` are handled. The
dashboard just reads them for reporting — the headline metric being
"verified app customers" = number of redeemed reservations.
"""
from fastapi import APIRouter, Depends, HTTPException

from .. import store
from ..permissions import Cap
from ..security import CurrentAdmin, require

router = APIRouter(prefix="/api/reservations", tags=["reservations"])

COL = "reservations"


@router.get("")
def list_reservations(status: str | None = None, pharmacyUid: str | None = None,
                      admin: CurrentAdmin = Depends(require(Cap.VIEW_RESERVATIONS))):
    rows = store.collection(COL).list()
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if pharmacyUid:
        rows = [r for r in rows if r.get("pharmacyUid") == pharmacyUid]
    rows.sort(key=lambda r: r.get("createdAtMillis", 0), reverse=True)
    return rows


@router.get("/stats")
def reservation_stats(admin: CurrentAdmin = Depends(require(Cap.VIEW_RESERVATIONS))):
    """Counts for the dashboard. `verifiedAppCustomers` = redeemed reservations —
    the headline metric proving customers arrived through the app."""
    rows = store.collection(COL).list()
    redeemed = [r for r in rows if r.get("status") == "REDEEMED"]
    return {
        "total": len(rows),
        "reserved": sum(1 for r in rows if r.get("status") == "RESERVED"),
        "redeemed": len(redeemed),
        "verifiedAppCustomers": len(redeemed),
        "redemptionRate": round(len(redeemed) / len(rows) * 100, 1) if rows else 0.0,
    }


@router.get("/{reservation_id}")
def reservation_detail(reservation_id: str,
                       admin: CurrentAdmin = Depends(require(Cap.VIEW_RESERVATIONS))):
    doc = store.collection(COL).get(reservation_id)
    if not doc:
        raise HTTPException(404, "Reservation not found")
    return doc
