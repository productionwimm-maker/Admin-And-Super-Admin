"""Wellness / E-commerce catalogue — Super-Admin only.

Three collections power the in-app "Shop":
  * wellness_subthemes — categories (Face Wash, Sanitizers, …)
  * wellness_products  — products inside a sub-theme. Each carries a hidden
                         commissionPct; the customer-facing `finalPrice` is
                         auto-computed = round(basePrice * (1 + commissionPct/100)).
                         `basePrice` is what the pharmacy is paid; the difference
                         is our commission and is NEVER exposed to the app.
  * wellness_decks     — the Amazon/Flipkart-style home carousel slides, each
                         pointing at a product or a sub-theme.

Writes here go through the Admin SDK (store), which bypasses the Firestore
rules that keep these collections read-only for the app.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import audit, store
from ..security import CurrentAdmin, require_superadmin

router = APIRouter(prefix="/api/wellness", tags=["wellness"])

SUBTHEMES = "wellness_subthemes"
PRODUCTS = "wellness_products"
DECKS = "wellness_decks"


def _final_price(base: float, commission_pct: float) -> int:
    return int(round(float(base) * (1.0 + float(commission_pct) / 100.0)))


# ── models ────────────────────────────────────────────────────────────────
class SubthemeBody(BaseModel):
    name: str
    imageUrl: str = ""
    order: int = 0
    active: bool = True


class ProductBody(BaseModel):
    name: str
    subthemeId: str
    imageUrl: str = ""
    gallery: list[str] = []
    description: str = ""
    about: str = ""          # "what is it about"
    basePrice: float = 0     # what the pharmacy is paid
    commissionPct: float = 0  # our cut (hidden from customers)
    brand: str = ""
    unit: str = ""           # e.g. "100 ml", "pack of 3"
    active: bool = True


class DeckBody(BaseModel):
    imageUrl: str
    title: str = ""
    targetType: str = "product"   # "product" | "subtheme"
    targetId: str = ""
    order: int = 0
    active: bool = True


# ── sub-themes ──────────────────────────────────────────────────────────────
@router.get("/subthemes")
def list_subthemes(admin: CurrentAdmin = Depends(require_superadmin)):
    rows = store.collection(SUBTHEMES).list()
    rows.sort(key=lambda r: (r.get("order", 0), r.get("name", "")))
    return rows


@router.post("/subthemes")
def add_subtheme(body: SubthemeBody, admin: CurrentAdmin = Depends(require_superadmin)):
    rec = store.collection(SUBTHEMES).add({**body.model_dump(), "createdAtMillis": store.now_ms()})
    audit.log(admin, "wellness.subtheme.add", rec["id"], {"name": body.name})
    return rec


@router.put("/subthemes/{sid}")
def edit_subtheme(sid: str, body: SubthemeBody, admin: CurrentAdmin = Depends(require_superadmin)):
    if not store.collection(SUBTHEMES).get(sid):
        raise HTTPException(404, "Sub-theme not found")
    rec = store.collection(SUBTHEMES).update(sid, body.model_dump())
    audit.log(admin, "wellness.subtheme.edit", sid)
    return rec


@router.delete("/subthemes/{sid}")
def delete_subtheme(sid: str, admin: CurrentAdmin = Depends(require_superadmin)):
    if not store.collection(SUBTHEMES).get(sid):
        raise HTTPException(404, "Sub-theme not found")
    # Also remove products that belonged to it so the shop never shows orphans.
    for p in store.collection(PRODUCTS).list({"subthemeId": sid}):
        store.collection(PRODUCTS).delete(p["id"])
    store.collection(SUBTHEMES).delete(sid)
    audit.log(admin, "wellness.subtheme.delete", sid)
    return {"ok": True, "deleted": sid}


# ── products ────────────────────────────────────────────────────────────────
def _product_record(body: ProductBody) -> dict:
    sub = store.collection(SUBTHEMES).get(body.subthemeId) or {}
    data = body.model_dump()
    data["subthemeName"] = sub.get("name", "")
    data["finalPrice"] = _final_price(body.basePrice, body.commissionPct)
    return data


@router.get("/products")
def list_products(subthemeId: str | None = None,
                  admin: CurrentAdmin = Depends(require_superadmin)):
    where = {"subthemeId": subthemeId} if subthemeId else None
    rows = store.collection(PRODUCTS).list(where)
    rows.sort(key=lambda r: r.get("name", ""))
    return rows


@router.post("/products")
def add_product(body: ProductBody, admin: CurrentAdmin = Depends(require_superadmin)):
    if not store.collection(SUBTHEMES).get(body.subthemeId):
        raise HTTPException(400, "subthemeId does not exist")
    rec = store.collection(PRODUCTS).add({**_product_record(body), "createdAtMillis": store.now_ms()})
    audit.log(admin, "wellness.product.add", rec["id"],
              {"name": body.name, "final": rec.get("finalPrice")})
    return rec


@router.put("/products/{pid}")
def edit_product(pid: str, body: ProductBody, admin: CurrentAdmin = Depends(require_superadmin)):
    if not store.collection(PRODUCTS).get(pid):
        raise HTTPException(404, "Product not found")
    rec = store.collection(PRODUCTS).update(pid, _product_record(body))
    audit.log(admin, "wellness.product.edit", pid, {"final": rec.get("finalPrice")})
    return rec


@router.delete("/products/{pid}")
def delete_product(pid: str, admin: CurrentAdmin = Depends(require_superadmin)):
    if not store.collection(PRODUCTS).get(pid):
        raise HTTPException(404, "Product not found")
    store.collection(PRODUCTS).delete(pid)
    audit.log(admin, "wellness.product.delete", pid)
    return {"ok": True, "deleted": pid}


# ── decks (home carousel) ────────────────────────────────────────────────────
@router.get("/decks")
def list_decks(admin: CurrentAdmin = Depends(require_superadmin)):
    rows = store.collection(DECKS).list()
    rows.sort(key=lambda r: (r.get("order", 0), r.get("createdAtMillis", 0)))
    return rows


@router.post("/decks")
def add_deck(body: DeckBody, admin: CurrentAdmin = Depends(require_superadmin)):
    rec = store.collection(DECKS).add({**body.model_dump(), "createdAtMillis": store.now_ms()})
    audit.log(admin, "wellness.deck.add", rec["id"])
    return rec


@router.put("/decks/{did}")
def edit_deck(did: str, body: DeckBody, admin: CurrentAdmin = Depends(require_superadmin)):
    if not store.collection(DECKS).get(did):
        raise HTTPException(404, "Deck not found")
    rec = store.collection(DECKS).update(did, body.model_dump())
    audit.log(admin, "wellness.deck.edit", did)
    return rec


@router.delete("/decks/{did}")
def delete_deck(did: str, admin: CurrentAdmin = Depends(require_superadmin)):
    if not store.collection(DECKS).get(did):
        raise HTTPException(404, "Deck not found")
    store.collection(DECKS).delete(did)
    audit.log(admin, "wellness.deck.delete", did)
    return {"ok": True, "deleted": did}
