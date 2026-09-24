"""Pharmacy signup review, verified gate, directory, suspend / delete /
discount / location overrides."""
from fastapi import APIRouter, Depends, HTTPException

from .. import audit, store
from ..permissions import ADMIN_MAX_DISCOUNT_PERCENT, Cap, has_cap
from ..schemas import DiscountBody, LocationBody, ReasonBody
from ..security import CurrentAdmin, require, require_superadmin

router = APIRouter(prefix="/api/pharmacies", tags=["pharmacies"])

ACCOUNTS = "pharmacy_accounts"
PRESENCE = "pharmacies"


def _presence_doc_for_phone(phone: str):
    """The public pharmacies/{uid} doc carries `phone`; match on it."""
    for row in store.collection(PRESENCE).list():
        if row.get("phone") == phone:
            return row
    return None


def _sync_presence(phone: str, fields: dict) -> None:
    doc = _presence_doc_for_phone(phone)
    if doc:
        store.collection(PRESENCE).update(doc["id"], fields)


# ── Signup review queue ───────────────────────────────────────────────────
@router.get("/pending")
def pending_signups(admin: CurrentAdmin = Depends(require(Cap.REVIEW_SIGNUPS))):
    rows = store.collection(ACCOUNTS).list()
    return [r for r in rows if r.get("verificationStatus", "pending") == "pending"]


@router.get("")
def directory(admin: CurrentAdmin = Depends(require(Cap.VIEW_PHARMACIES))):
    return store.collection(ACCOUNTS).list()


@router.get("/{phone}")
def detail(phone: str, admin: CurrentAdmin = Depends(require(Cap.VIEW_PHARMACIES))):
    doc = store.collection(ACCOUNTS).get(phone)
    if not doc:
        raise HTTPException(404, "Pharmacy not found")
    return doc


@router.post("/{phone}/approve")
def approve(phone: str, admin: CurrentAdmin = Depends(require(Cap.APPROVE_PHARMACY))):
    if not store.collection(ACCOUNTS).get(phone):
        raise HTTPException(404, "Pharmacy not found")
    store.collection(ACCOUNTS).update(phone, {
        "verificationStatus": "approved", "verified": True, "suspended": False,
        "reviewedBy": admin.email, "reviewedAtMillis": store.now_ms(),
    })
    _sync_presence(store.collection(ACCOUNTS).get(phone).get("mobileNumber", phone.replace("+91", "")),
                   {"verified": True, "suspended": False})
    audit.log(admin, "pharmacy.approve", phone)
    return {"ok": True, "phone": phone, "verified": True}


@router.post("/{phone}/reject")
def reject(phone: str, body: ReasonBody,
           admin: CurrentAdmin = Depends(require(Cap.APPROVE_PHARMACY))):
    if not store.collection(ACCOUNTS).get(phone):
        raise HTTPException(404, "Pharmacy not found")
    store.collection(ACCOUNTS).update(phone, {
        "verificationStatus": "rejected", "verified": False,
        "rejectionReason": body.reason, "reviewedBy": admin.email,
        "reviewedAtMillis": store.now_ms(),
    })
    audit.log(admin, "pharmacy.reject", phone, {"reason": body.reason})
    return {"ok": True, "phone": phone, "verified": False}


@router.post("/{phone}/suspend")
def suspend(phone: str, body: ReasonBody,
            admin: CurrentAdmin = Depends(require(Cap.SUSPEND_PHARMACY))):
    acc = store.collection(ACCOUNTS).get(phone)
    if not acc:
        raise HTTPException(404, "Pharmacy not found")
    store.collection(ACCOUNTS).update(phone, {"suspended": True, "suspendReason": body.reason})
    _sync_presence(acc.get("mobileNumber", phone.replace("+91", "")), {"suspended": True, "online": False})
    audit.log(admin, "pharmacy.suspend", phone, {"reason": body.reason})
    return {"ok": True, "phone": phone, "suspended": True}


@router.post("/{phone}/unsuspend")
def unsuspend(phone: str, admin: CurrentAdmin = Depends(require(Cap.SUSPEND_PHARMACY))):
    acc = store.collection(ACCOUNTS).get(phone)
    if not acc:
        raise HTTPException(404, "Pharmacy not found")
    store.collection(ACCOUNTS).update(phone, {"suspended": False})
    _sync_presence(acc.get("mobileNumber", phone.replace("+91", "")), {"suspended": False})
    audit.log(admin, "pharmacy.unsuspend", phone)
    return {"ok": True, "phone": phone, "suspended": False}


@router.put("/{phone}/discount")
def override_discount(phone: str, body: DiscountBody,
                      admin: CurrentAdmin = Depends(require(Cap.OVERRIDE_DISCOUNT))):
    acc = store.collection(ACCOUNTS).get(phone)
    if not acc:
        raise HTTPException(404, "Pharmacy not found")
    # Plain admins are capped; super-admins may set any value.
    unlimited = has_cap(admin.role, Cap.OVERRIDE_DISCOUNT_UNLIMITED)
    if not unlimited and body.discountPercent > ADMIN_MAX_DISCOUNT_PERCENT:
        raise HTTPException(
            403, f"Admins may set at most {ADMIN_MAX_DISCOUNT_PERCENT}% — ask a Super Admin")
    store.collection(ACCOUNTS).update(phone, {"discountPercent": body.discountPercent})
    _sync_presence(acc.get("mobileNumber", phone.replace("+91", "")),
                   {"discountPercent": body.discountPercent})
    audit.log(admin, "pharmacy.discount", phone, {"discountPercent": body.discountPercent})
    return {"ok": True, "phone": phone, "discountPercent": body.discountPercent}


@router.put("/{phone}/location")
def override_location(phone: str, body: LocationBody,
                      admin: CurrentAdmin = Depends(require_superadmin)):
    acc = store.collection(ACCOUNTS).get(phone)
    if not acc:
        raise HTTPException(404, "Pharmacy not found")
    store.collection(ACCOUNTS).update(phone, {"latitude": body.latitude, "longitude": body.longitude})
    _sync_presence(acc.get("mobileNumber", phone.replace("+91", "")),
                   {"latitude": body.latitude, "longitude": body.longitude})
    audit.log(admin, "pharmacy.location", phone, {"lat": body.latitude, "lng": body.longitude})
    return {"ok": True}


@router.delete("/{phone}")
def delete_pharmacy(phone: str, admin: CurrentAdmin = Depends(require_superadmin)):
    acc = store.collection(ACCOUNTS).get(phone)
    if not acc:
        raise HTTPException(404, "Pharmacy not found")
    store.collection(ACCOUNTS).delete(phone)
    doc = _presence_doc_for_phone(acc.get("mobileNumber", phone.replace("+91", "")))
    if doc:
        store.collection(PRESENCE).delete(doc["id"])
    audit.log(admin, "pharmacy.delete", phone)
    return {"ok": True, "deleted": phone}
