"""App update publishing — Super-Admin uploads a new APK (to the Supabase
`apk-releases` bucket from the browser) then pushes its URL + metadata here.
The app reads `app_updates/latest` in realtime to show the in-app update dialog.
Read by anyone signed in; written by super-admins only."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import audit, store
from ..security import CurrentAdmin, get_current_admin, require_superadmin

router = APIRouter(prefix="/api/app-update", tags=["app-update"])
COL = "app_updates"
DOC = "latest"


class AppUpdateBody(BaseModel):
    apkUrl: str
    message: str = ""
    versionCode: int
    versionName: str = ""
    active: bool = True


@router.get("")
def get_update(admin: CurrentAdmin = Depends(get_current_admin)):
    return store.collection(COL).get(DOC) or {"active": False}


@router.put("")
def set_update(body: AppUpdateBody, admin: CurrentAdmin = Depends(require_superadmin)):
    rec = store.collection(COL).set(DOC, {
        "apkUrl": body.apkUrl,
        "message": body.message,
        "versionCode": body.versionCode,
        "versionName": body.versionName,
        "active": body.active,
        "updatedAtMillis": store.now_ms(),
        "updatedBy": admin.email,
    })
    audit.log(admin, "app_update.push", DOC)
    return rec
