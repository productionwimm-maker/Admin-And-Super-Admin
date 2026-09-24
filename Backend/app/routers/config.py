"""Feature flags, "Coming soon" toggles and force-update version.
Read by anyone signed in; written by super-admins only."""
from fastapi import APIRouter, Depends

from .. import audit, store
from ..schemas import FeatureFlagsBody
from ..security import CurrentAdmin, get_current_admin, require_superadmin

router = APIRouter(prefix="/api/config", tags=["config"])
COL = "feature_flags"
DOC = "config"


@router.get("/flags")
def get_flags(admin: CurrentAdmin = Depends(get_current_admin)):
    return store.collection(COL).get(DOC) or {
        "flags": {}, "comingSoon": {}, "forceUpdate": {"enabled": False},
        "appDiscount": {"platformExtraPct": 0, "enabled": False}}


@router.put("/flags")
def set_flags(body: FeatureFlagsBody, admin: CurrentAdmin = Depends(require_superadmin)):
    rec = store.collection(COL).set(DOC, {
        "flags": body.flags, "comingSoon": body.comingSoon,
        "forceUpdate": body.forceUpdate, "appDiscount": body.appDiscount,
        "updatedAtMillis": store.now_ms(),
        "updatedBy": admin.email,
    })
    audit.log(admin, "config.flags.update", DOC)
    return rec
