"""Promotional poster shown on the public marketing website.

The Super Admin sets an image (a hosted URL, or a small upload that gets
stored as a data URI) plus an optional click-through link, then publishes
it. The marketing website fetches `GET /api/poster` on load — that route is
intentionally PUBLIC (no admin login) because anonymous visitors need to see
it — and renders it as a small dismissible card in a corner of the page.

`GET /api/poster/admin` and `PUT /api/poster` are Super-Admin only, matching
the app_update.py / config.py pattern used elsewhere in this API.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import audit, store
from ..security import CurrentAdmin, require_superadmin

router = APIRouter(prefix="/api/poster", tags=["poster"])
COL = "posters"
DOC = "main_site"


class PosterBody(BaseModel):
    imageUrl: str
    linkUrl: str = ""
    title: str = ""
    active: bool = True


def _public_view(rec: dict) -> dict:
    # Don't leak the image/link while the poster is switched off.
    if not rec or not rec.get("active") or not rec.get("imageUrl"):
        return {"active": False}
    return {
        "active": True,
        "imageUrl": rec.get("imageUrl", ""),
        "linkUrl": rec.get("linkUrl", ""),
        "title": rec.get("title", ""),
        "updatedAtMillis": rec.get("updatedAtMillis"),
    }


@router.get("")
def get_poster_public():
    """Public — polled by the marketing website. No auth required."""
    rec = store.collection(COL).get(DOC) or {}
    return _public_view(rec)


@router.get("/admin")
def get_poster_admin(admin: CurrentAdmin = Depends(require_superadmin)):
    """Full record (even while disabled) for the Super Admin poster page."""
    return store.collection(COL).get(DOC) or {
        "active": False, "imageUrl": "", "linkUrl": "", "title": "",
    }


@router.put("")
def set_poster(body: PosterBody, admin: CurrentAdmin = Depends(require_superadmin)):
    rec = store.collection(COL).set(DOC, {
        "imageUrl": body.imageUrl,
        "linkUrl": body.linkUrl,
        "title": body.title,
        "active": body.active,
        "updatedAtMillis": store.now_ms(),
        "updatedBy": admin.email,
    })
    audit.log(admin, "poster.update", DOC, {"active": body.active})
    return rec
