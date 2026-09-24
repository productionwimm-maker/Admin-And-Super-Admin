"""Feature flags, "Coming soon" toggles, force-update version, and the live
App Settings the phone app reads (maintenance, delivery fee, radius, …).
Read by anyone signed in; written by super-admins only."""
from typing import Any, Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import audit, store
from ..schemas import FeatureFlagsBody
from ..security import CurrentAdmin, get_current_admin, require_superadmin

router = APIRouter(prefix="/api/config", tags=["config"])
COL = "feature_flags"
DOC = "config"
SETTINGS_DOC = "settings"

# Live App Settings the app mirrors from feature_flags/settings — editable in the
# Super-Admin panel, applied in the app with no rebuild.
DEFAULT_SETTINGS: Dict[str, Any] = {
    "maintenance": {"enabled": False, "message": "We'll be back shortly."},
    "delivery": {"baseFareRupees": 20, "perKmRupees": 8, "freeAboveRupees": 0},
    "serviceRadiusKm": 8,
    "minOrderRupees": 0,
    "announcement": {"enabled": False, "text": ""},
}


class AppSettingsBody(BaseModel):
    settings: Dict[str, Any]


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


@router.get("/settings")
def get_settings(admin: CurrentAdmin = Depends(get_current_admin)):
    return store.collection(COL).get(SETTINGS_DOC) or dict(DEFAULT_SETTINGS)


@router.put("/settings")
def set_settings(body: AppSettingsBody, admin: CurrentAdmin = Depends(require_superadmin)):
    rec = store.collection(COL).set(SETTINGS_DOC, {
        **body.settings,
        "updatedAtMillis": store.now_ms(),
        "updatedBy": admin.email,
    })
    audit.log(admin, "config.settings.update", SETTINGS_DOC)
    return rec
