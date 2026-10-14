"""App update publishing — Super-Admin uploads a new APK (to Firebase Storage,
via /upload-apk) then pushes its URL + metadata here. The app reads
`app_updates/latest` in realtime to show the in-app update dialog.
Read by anyone signed in; written by super-admins only."""
import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from .. import audit, store
from ..firebase import get_bucket
from ..security import CurrentAdmin, get_current_admin, require_superadmin

router = APIRouter(prefix="/api/app-update", tags=["app-update"])
COL = "app_updates"
DOC = "latest"
_MAX_APK = 150 * 1024 * 1024


class AppUpdateBody(BaseModel):
    apkUrl: str
    message: str = ""
    versionCode: int
    versionName: str = ""
    active: bool = True


@router.post("/upload-apk")
async def upload_apk(file: UploadFile = File(...),
                     admin: CurrentAdmin = Depends(require_superadmin)):
    """Upload a release APK to Firebase Storage; returns a public download URL."""
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > _MAX_APK:
        raise HTTPException(400, "APK too large (max 150 MB)")
    try:
        bucket = get_bucket()
        token = uuid.uuid4().hex
        blob = bucket.blob(f"apk/wimm-{uuid.uuid4().hex}.apk")
        blob.metadata = {"firebaseStorageDownloadTokens": token}
        blob.upload_from_string(data, content_type="application/vnd.android.package-archive")
        url = (f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}"
               f"/o/{quote(blob.name, safe='')}?alt=media&token={token}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"APK upload failed: {e}")
    audit.log(admin, "app_update.apk.upload", "", {"size": len(data)})
    return {"url": url}


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
