"""Medicine catalog. Admins may add/edit; only super-admins may delete
(full control)."""
from fastapi import APIRouter, Depends, HTTPException

from .. import audit, store
from ..permissions import Cap
from ..schemas import CatalogItemBody
from ..security import CurrentAdmin, require, require_superadmin

router = APIRouter(prefix="/api/catalog", tags=["catalog"])
COL = "medicine_catalog"


@router.get("")
def list_items(admin: CurrentAdmin = Depends(require(Cap.EDIT_CATALOG))):
    return store.collection(COL).list()


@router.post("")
def add_item(body: CatalogItemBody, admin: CurrentAdmin = Depends(require(Cap.EDIT_CATALOG))):
    rec = store.collection(COL).add(body.model_dump())
    audit.log(admin, "catalog.add", rec["id"], {"name": body.name})
    return rec


@router.put("/{item_id}")
def edit_item(item_id: str, body: CatalogItemBody,
              admin: CurrentAdmin = Depends(require(Cap.EDIT_CATALOG))):
    if not store.collection(COL).get(item_id):
        raise HTTPException(404, "Item not found")
    rec = store.collection(COL).update(item_id, body.model_dump())
    audit.log(admin, "catalog.edit", item_id)
    return rec


@router.delete("/{item_id}")
def delete_item(item_id: str, admin: CurrentAdmin = Depends(require_superadmin)):
    if not store.collection(COL).get(item_id):
        raise HTTPException(404, "Item not found")
    store.collection(COL).delete(item_id)
    audit.log(admin, "catalog.delete", item_id)
    return {"ok": True, "deleted": item_id}
