"""Pharmacy subscriptions.

Super-admins define plans (price + duration in any unit) and ROLES (a discount:
normal pays full, grandfather is exempt/free, partners get a %). Admins grant/
extend a pharmacy's subscription. The subscription + role live on the pharmacy's
`pharmacy_accounts/{phone}` doc. "Active right now" = active AND not ended.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import audit, store
from ..security import CurrentAdmin, get_current_admin, require_superadmin

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

PLANS = "subscription_plans"
ROLES = "subscription_roles"
PHARM = "pharmacy_accounts"

DAY_MS = 86_400_000
UNIT_MS = {
    "minute": 60_000,
    "hour": 3_600_000,
    "day": DAY_MS,
    "week": 7 * DAY_MS,
    "month": 30 * DAY_MS,
    "year": 365 * DAY_MS,
}


class PlanBody(BaseModel):
    name: str
    priceRupees: int = Field(ge=0)
    durationValue: int = Field(gt=0, default=1)
    durationUnit: str = "day"  # minute|hour|day|week|month|year
    active: bool = True


class RoleBody(BaseModel):
    name: str
    discountPct: int = Field(ge=0, le=100, default=0)
    exempt: bool = False


class GrantBody(BaseModel):
    planId: Optional[str] = None
    days: Optional[int] = None
    note: str = ""


class RoleAssign(BaseModel):
    role: str


def _plan_record(body: PlanBody) -> dict:
    unit = body.durationUnit if body.durationUnit in UNIT_MS else "day"
    duration_ms = body.durationValue * UNIT_MS[unit]
    return {
        "name": body.name, "priceRupees": body.priceRupees, "active": body.active,
        "durationValue": body.durationValue, "durationUnit": unit,
        "durationMillis": duration_ms, "durationDays": max(1, round(duration_ms / DAY_MS)),
    }


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
        **_plan_record(body), "createdAtMillis": store.now_ms(), "createdBy": admin.email})
    audit.log(admin, "subscription.plan.create", plan_id)
    return rec


@router.put("/plans/{plan_id}")
def update_plan(plan_id: str, body: PlanBody, admin: CurrentAdmin = Depends(require_superadmin)):
    rec = store.collection(PLANS).update(plan_id, _plan_record(body))
    audit.log(admin, "subscription.plan.update", plan_id)
    return rec


@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: str, admin: CurrentAdmin = Depends(require_superadmin)):
    store.collection(PLANS).update(plan_id, {"active": False})
    audit.log(admin, "subscription.plan.deactivate", plan_id)
    return {"ok": True}


# ── Roles / tiers (super-admin) ────────────────────────────────────────────
@router.get("/roles")
def list_roles(admin: CurrentAdmin = Depends(get_current_admin)):
    return store.collection(ROLES).list()


@router.post("/roles")
def upsert_role(body: RoleBody, admin: CurrentAdmin = Depends(require_superadmin)):
    role_id = body.name.strip().lower().replace(" ", "_")
    rec = store.collection(ROLES).set(role_id, {
        "name": body.name, "discountPct": body.discountPct, "exempt": body.exempt,
        "updatedAtMillis": store.now_ms(), "updatedBy": admin.email})
    audit.log(admin, "subscription.role.upsert", role_id)
    return rec


@router.delete("/roles/{role_id}")
def delete_role(role_id: str, admin: CurrentAdmin = Depends(require_superadmin)):
    store.collection(ROLES).delete(role_id)
    audit.log(admin, "subscription.role.delete", role_id)
    return {"ok": True}


@router.post("/pharmacy/{phone}/role")
def set_pharmacy_role(phone: str, body: RoleAssign, admin: CurrentAdmin = Depends(require_superadmin)):
    store.collection(PHARM).update(phone, {"subscriptionRole": body.role})
    audit.log(admin, "subscription.pharmacy.role", phone)
    return {"phone": phone, "role": body.role}


# ── Active pharmacies ──────────────────────────────────────────────────────
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
                "role": p.get("subscriptionRole", "normal"),
            })
    out.sort(key=lambda x: x.get("endMillis", 0))
    return {"count": len(out), "pharmacies": out}


@router.get("/pharmacy/{phone}")
def get_subscription(phone: str, admin: CurrentAdmin = Depends(get_current_admin)):
    p = store.collection(PHARM).get(phone) or {}
    sub = p.get("subscription") or {}
    return {"phone": phone, "subscription": sub, "active": _is_active(sub),
            "role": p.get("subscriptionRole", "normal")}


# ── Grant / extend / revoke (admin) ────────────────────────────────────────
@router.post("/pharmacy/{phone}/grant")
def grant_subscription(phone: str, body: GrantBody, admin: CurrentAdmin = Depends(get_current_admin)):
    days = body.days
    plan_id = body.planId
    if days is None and plan_id:
        plan = store.collection(PLANS).get(plan_id) or {}
        ms = plan.get("durationMillis") or (int(plan.get("durationDays", 0)) * DAY_MS)
        days = max(1, round(ms / DAY_MS))
    days = int(days or 0)
    if days <= 0:
        return {"error": "provide planId or a positive days value"}

    p = store.collection(PHARM).get(phone) or {}
    cur = p.get("subscription") or {}
    now = store.now_ms()
    base = max(now, cur.get("endMillis", 0)) if _is_active(cur) else now
    end = base + days * DAY_MS
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
