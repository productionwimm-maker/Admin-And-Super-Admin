"""Customer search, history, block / unblock, delete (super-admin)."""
from fastapi import APIRouter, Depends, HTTPException

from .. import audit, store
from ..permissions import Cap
from ..schemas import ReasonBody
from ..security import CurrentAdmin, require, require_superadmin

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("")
def list_customers(q: str | None = None,
                   admin: CurrentAdmin = Depends(require(Cap.VIEW_CUSTOMERS))):
    rows = store.collection("customers").list()
    if q:
        ql = q.lower()
        rows = [r for r in rows
                if ql in (r.get("name", "").lower()) or ql in (r.get("phone", ""))]
    return rows


@router.get("/{phone}")
def customer_detail(phone: str, admin: CurrentAdmin = Depends(require(Cap.VIEW_CUSTOMERS))):
    doc = store.collection("customers").get(phone)
    if not doc:
        raise HTTPException(404, "Customer not found")
    orders = [o for o in store.collection("orders").list() if o.get("customerPhone") == phone]
    orders.sort(key=lambda r: r.get("createdAtMillis", 0), reverse=True)
    return {"profile": doc, "orders": orders}


@router.post("/{phone}/block")
def block(phone: str, body: ReasonBody,
          admin: CurrentAdmin = Depends(require(Cap.BLOCK_CUSTOMER))):
    if not store.collection("customers").get(phone):
        raise HTTPException(404, "Customer not found")
    store.collection("customers").update(phone, {"blocked": True, "blockReason": body.reason})
    audit.log(admin, "customer.block", phone, {"reason": body.reason})
    return {"ok": True, "phone": phone, "blocked": True}


@router.post("/{phone}/unblock")
def unblock(phone: str, admin: CurrentAdmin = Depends(require(Cap.BLOCK_CUSTOMER))):
    if not store.collection("customers").get(phone):
        raise HTTPException(404, "Customer not found")
    store.collection("customers").update(phone, {"blocked": False})
    audit.log(admin, "customer.unblock", phone)
    return {"ok": True, "phone": phone, "blocked": False}


@router.delete("/{phone}")
def delete_customer(phone: str, admin: CurrentAdmin = Depends(require_superadmin)):
    if not store.collection("customers").get(phone):
        raise HTTPException(404, "Customer not found")
    store.collection("customers").delete(phone)
    audit.log(admin, "customer.delete", phone)
    return {"ok": True, "deleted": phone}
