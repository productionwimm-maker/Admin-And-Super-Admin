"""Admin account management + region/zone scope. Super-admin only."""
from fastapi import APIRouter, Depends, HTTPException

from .. import audit, store
from ..permissions import Role
from ..schemas import CreateAdminBody, UpdateAdminBody
from ..security import CurrentAdmin, hash_password, require_superadmin

router = APIRouter(prefix="/api/admins", tags=["admins"])
COL = "admin_users"


def _public(row: dict) -> dict:
    return {k: v for k, v in row.items() if k != "passwordHash"}


@router.get("")
def list_admins(admin: CurrentAdmin = Depends(require_superadmin)):
    return [_public(r) for r in store.collection(COL).list()]


@router.post("")
def create_admin(body: CreateAdminBody, admin: CurrentAdmin = Depends(require_superadmin)):
    email = body.email.strip().lower()
    if body.role not in (Role.ADMIN, Role.SUPERADMIN):
        raise HTTPException(400, "role must be 'admin' or 'superadmin'")
    if store.collection(COL).list(where={"email": email}):
        raise HTTPException(409, "An admin with that email already exists")
    rec = store.collection(COL).add({
        "email": email, "name": body.name, "role": body.role,
        "regions": body.regions, "active": True,
        "passwordHash": hash_password(body.password),
        "createdAtMillis": store.now_ms(), "createdBy": admin.email,
    })
    audit.log(admin, "admin.create", email, {"role": body.role})
    return _public(rec)


@router.put("/{admin_id}")
def update_admin(admin_id: str, body: UpdateAdminBody,
                 admin: CurrentAdmin = Depends(require_superadmin)):
    existing = store.collection(COL).get(admin_id)
    if not existing:
        raise HTTPException(404, "Admin not found")
    patch: dict = {}
    if body.name is not None:
        patch["name"] = body.name
    if body.role is not None:
        if body.role not in (Role.ADMIN, Role.SUPERADMIN):
            raise HTTPException(400, "invalid role")
        patch["role"] = body.role
    if body.regions is not None:
        patch["regions"] = body.regions
    if body.active is not None:
        patch["active"] = body.active
    if body.password:
        patch["passwordHash"] = hash_password(body.password)
    rec = store.collection(COL).update(admin_id, patch)
    audit.log(admin, "admin.update", existing.get("email", admin_id), {"fields": list(patch)})
    return _public(rec)


@router.delete("/{admin_id}")
def delete_admin(admin_id: str, admin: CurrentAdmin = Depends(require_superadmin)):
    existing = store.collection(COL).get(admin_id)
    if not existing:
        raise HTTPException(404, "Admin not found")
    if existing.get("email") == admin.email:
        raise HTTPException(400, "You cannot delete your own account")
    store.collection(COL).delete(admin_id)
    audit.log(admin, "admin.delete", existing.get("email", admin_id))
    return {"ok": True, "deleted": admin_id}
