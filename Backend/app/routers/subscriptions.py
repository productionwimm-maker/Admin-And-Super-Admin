"""Pharmacy subscriptions.

Super-admins define plans (price + duration); admins grant/extend a pharmacy's
subscription (manually now; Razorpay auto-renewal is wired later). The
subscription is stored on the pharmacy's `pharmacy_accounts/{phone}` document so
the app can gate the pharmacy on it. "Active right now" = status active AND the
current period hasn't ended.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import audit, store
from ..security import CurrentAdmin, get_current_admin, require_superadmin

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

PLANS = "subscription_plans"
PHARM = "pharmacy_accounts"


class PlanBody(BaseModel):
    name: str
    priceRupees: int = Field(ge=0)
    durationDays: int = Field(gt=0)
    active: bool = True


class GrantBody(BaseModel):
    planId: Optional[str] = None      # use a plan's duration/price…
    days: Optional[int] = None        # …or override with an explicit number of days
    note: str = ""


def _is_active(sub: dict) -> bool:
    return bool(sub) and sub.get("status") == "active" and sub.get("endMillis", 0) > store.now_ms()


# ── Plans (super-admin) ────────────────────────────────────────────────────
@router.get("/plans")
def list_plans(admin: CurrentAdmin = Depends(get_current_admin)):
    return store.collection(PLANS).list()


@router.post("/plans")
def create_plan(body: PlanBody, admin: CurrentAdmin = Depends(require_superadmin)):
    plan_id = f"plan_{store.now_ms()}"
    rec = store.collection(PLANS).set(plan_id, {
        **body.model_dump(), "createdAtMillis": store.now_ms(), "createdBy": admin.email})
    audit.log(admin, "subscription.plan.create", plan_id)
    return rec


@router.put("/plans/{plan_id}")
def update_plan(plan_id: str, body: PlanBody, admin: CurrentAdmin = Depends(require_superadmin)):
    rec = store.collection(PLANS).update(plan_id, body.model_dump())
    audit.log(admin, "subscription.plan.update", plan_id)
    return rec


@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: str, admin: CurrentAdmin = Depends(require_superadmin)):
    store.collection(PLANS).update(plan_id, {"active": False})
    audit.log(admin, "subscription.plan.deactivate", plan_id)
    return {"ok": True}


# ── Active pharmacies (the "who's subscribed right now" view) ──────────────
@router.get("/active")
def active_pharmacies(admin: CurrentAdmin = Depends(get_current_admin)):
    out = []
    for p in store.collection(PHARM).list():
        sub = p.get("subscription") or {}
        if _is_active(sub):
            out.append({
                "phone": p.get("id") or p.get("phone"),
                "name": p.get("name") or p.get("pharmacyName", ""),
                "plan": sub.get("planId"),
                "endMillis": sub.get("endMillis"),
                "source": sub.get("source", "manual"),
            })
    out.sort(key=lambda x: x.get("endMillis", 0))
    return {"count": len(out), "pharmacies": out}


@router.get("/pharmacy/{phone}")
def get_subscription(phone: str, admin: CurrentAdmin = Depends(get_current_admin)):
    p = store.collection(PHARM).get(phone) or {}
    sub = p.get("subscription") or {}
    return {"phone": phone, "subscription": sub, "active": _is_active(sub)}


# ── Grant / extend / revoke (admin) ────────────────────────────────────────
@router.post("/pharmacy/{phone}/grant")
def grant_subscription(phone: str, body: GrantBody, admin: CurrentAdmin = Depends(get_current_admin)):
    days = body.days
    plan_id = body.planId
    if days is None and plan_id:
        plan = store.collection(PLANS).get(plan_id) or {}
        days = int(plan.get("durationDays", 0))
    days = int(days or 0)
    if days <= 0:
        return {"error": "provide planId or a positive days value"}

    p = store.collection(PHARM).get(phone) or {}
    cur = p.get("subscription") or {}
    now = store.now_ms()
    # Extend from the later of now / current end so renewals stack.
    base = max(now, cur.get("endMillis", 0)) if _is_active(cur) else now
    end = base + days * 86_400_000
    sub = {
        "status": "active", "planId": plan_id, "startMillis": now, "endMillis": end,
        "source": "manual", "note": body.note, "updatedBy": admin.email, "updatedAtMillis": now,
    }
    store.collection(PHARM).update(phone, {"subscription": sub})
    audit.log(admin, "subscription.grant", phone)
    return {"phone": phone, "subscription": sub, "active": True}


@router.post("/pharmacy/{phone}/revoke")
def revoke_subscription(phone: str, admin: CurrentAdmin = Depends(require_superadmin)):
    p = store.collection(PHARM).get(phone) or {}
    sub = p.get("subscription") or {}
    sub.update({"status": "expired", "endMillis": store.now_ms(),
                "updatedBy": admin.email, "updatedAtMillis": store.now_ms()})
    store.collection(PHARM).update(phone, {"subscription": sub})
    audit.log(admin, "subscription.revoke", phone)
    return {"phone": phone, "subscription": sub, "active": False}
