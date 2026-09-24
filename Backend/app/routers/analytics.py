"""Demand, coverage gaps, top medicines and fulfillment analytics, plus the
dashboard overview counters."""
from collections import Counter

from fastapi import APIRouter, Depends

from .. import store
from ..permissions import Cap
from ..security import CurrentAdmin, require

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
def overview(admin: CurrentAdmin = Depends(require(Cap.VIEW_ANALYTICS))):
    accounts = store.collection("pharmacy_accounts").list()
    orders = store.collection("orders").list()
    customers = store.collection("customers").list()
    reservations = store.collection("reservations").list()
    paid = [o for o in orders if o.get("paymentStatus") == "PAID"]
    redeemed_reservations = [r for r in reservations if r.get("status") == "REDEEMED"]
    return {
        "pendingApprovals": sum(1 for a in accounts
                                if a.get("verificationStatus", "pending") == "pending"),
        "totalPharmacies": len(accounts),
        "verifiedPharmacies": sum(1 for a in accounts if a.get("verified")),
        "suspendedPharmacies": sum(1 for a in accounts if a.get("suspended")),
        "totalCustomers": len(customers),
        "blockedCustomers": sum(1 for c in customers if c.get("blocked")),
        "totalOrders": len(orders),
        "openOrders": sum(1 for o in orders if o.get("status") in ("PLACED", "CONFIRMED", "OUT_FOR_DELIVERY")),
        "gmv": sum(o.get("totalAmount", 0) for o in paid),
        "totalReservations": len(reservations),
        # Redeemed reservations = customers proven to have arrived via the app.
        "verifiedAppCustomers": len(redeemed_reservations),
    }


@router.get("/fulfillment")
def fulfillment(admin: CurrentAdmin = Depends(require(Cap.VIEW_ANALYTICS))):
    orders = store.collection("orders").list()
    by_status = Counter(o.get("status", "UNKNOWN") for o in orders)
    delivered = by_status.get("DELIVERED", 0)
    rate = round(delivered / len(orders) * 100, 1) if orders else 0.0
    return {"byStatus": dict(by_status), "fulfillmentRate": rate, "totalOrders": len(orders)}


@router.get("/demand")
def demand(admin: CurrentAdmin = Depends(require(Cap.VIEW_ANALYTICS))):
    """Top requested medicines + state coverage gaps."""
    items = Counter()
    for o in store.collection("orders").list():
        for part in o.get("itemsSummary", "").split(","):
            name = part.strip().split(" x")[0].strip()
            if name:
                items[name] += 1
    top_medicines = [{"name": n, "count": c} for n, c in items.most_common(10)]

    accounts = store.collection("pharmacy_accounts").list()
    by_state = Counter(a.get("state", "Unknown") for a in accounts)
    verified_by_state = Counter(a.get("state", "Unknown") for a in accounts if a.get("verified"))
    coverage = [{"state": s, "pharmacies": n, "verified": verified_by_state.get(s, 0)}
                for s, n in by_state.most_common()]
    return {"topMedicines": top_medicines, "coverageByState": coverage}
