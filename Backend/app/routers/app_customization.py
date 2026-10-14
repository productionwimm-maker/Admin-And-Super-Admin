"""App Customization — one place for the Super-Admin to control the live app:
  - Home hero texts (cycle with a typewriter animation) + eyebrow
  - Contact details (email / phone / whatsapp / address)
  - Remote app logo (festive/occasion logos, no rebuild)
  - A Spotify-style promo banner (image + action button + dismiss)
All of these are merged into feature_flags/config, which the app mirrors live.
Images and APKs upload to Firebase Storage and return a public download URL.
"""
import hashlib
import json
import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from .. import audit, store
from ..firebase import get_bucket
from ..security import CurrentAdmin, get_current_admin, require_superadmin

router = APIRouter(prefix="/api/app-customization", tags=["app-customization"])
COL = "feature_flags"
DOC = "config"

_ALLOWED_IMG = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_IMG = 8 * 1024 * 1024
_MAX_APK = 120 * 1024 * 1024


class HomeBody(BaseModel):
    eyebrow: str = ""
    texts: list[str] = []


class ContactBody(BaseModel):
    email: str = ""
    phone: str = ""
    whatsapp: str = ""
    address: str = ""


class BannerBody(BaseModel):
    enabled: bool = False
    imageUrl: str = ""
    buttonText: str = ""
    action: str = "none"          # none | url | product | subtheme | shop
    target: str = ""
    buttonRadius: int = 12
    buttonColor: str = ""
    textColor: str = ""
    dismissible: bool = True


class CustomizationBody(BaseModel):
    home: HomeBody = HomeBody()
    contact: ContactBody = ContactBody()
    logoUrl: str = ""
    banner: BannerBody = BannerBody()


@router.get("")
def get_customization(admin: CurrentAdmin = Depends(get_current_admin)):
    cfg = store.collection(COL).get(DOC) or {}
    return {
        "home": cfg.get("home", {"eyebrow": "", "texts": []}),
        "contact": cfg.get("contact", {}),
        "logoUrl": cfg.get("logoUrl", ""),
        "banner": cfg.get("banner", {}),
    }


@router.put("")
def set_customization(body: CustomizationBody, admin: CurrentAdmin = Depends(require_superadmin)):
    banner = body.banner.model_dump()
    # A content-hash id so the app re-shows the banner to users who dismissed an
    # older one once its content changes (and stays dismissed otherwise).
    banner["id"] = hashlib.md5(
        json.dumps({k: v for k, v in banner.items() if k != "id"}, sort_keys=True).encode()
    ).hexdigest()[:12]
    rec = store.collection(COL).update(DOC, {
        "home": {"eyebrow": body.home.eyebrow, "texts": [t for t in body.home.texts if t.strip()]},
        "contact": body.contact.model_dump(),
        "logoUrl": body.logoUrl.strip(),
        "banner": banner,
        "customizationUpdatedAtMillis": store.now_ms(),
        "customizationUpdatedBy": admin.email,
    })
    audit.log(admin, "app_customization.update", DOC)
    return rec


@router.post("/upload")
async def upload_image(file: UploadFile = File(...),
                       admin: CurrentAdmin = Depends(require_superadmin)):
    """Upload a logo/banner image to Firebase Storage; returns a public URL."""
    ctype = (file.content_type or "").lower()
    if ctype not in _ALLOWED_IMG:
        raise HTTPException(400, "Only JPG, PNG, WEBP or GIF images are allowed")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > _MAX_IMG:
        raise HTTPException(400, "Image too large (max 8 MB)")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}[ctype]
    try:
        bucket = get_bucket()
        token = uuid.uuid4().hex
        blob = bucket.blob(f"appconfig/{uuid.uuid4().hex}.{ext}")
        blob.metadata = {"firebaseStorageDownloadTokens": token}
        blob.upload_from_string(data, content_type=ctype)
        url = (f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}"
               f"/o/{quote(blob.name, safe='')}?alt=media&token={token}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Upload failed: {e}")
    audit.log(admin, "app_customization.image.upload", "", {"ctype": ctype})
    return {"url": url}


@router.post("/upload-apk")
async def upload_apk(file: UploadFile = File(...),
                     admin: CurrentAdmin = Depends(require_superadmin)):
    """Upload a release APK to Firebase Storage; returns a public download URL
    to paste into the App Update section."""
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > _MAX_APK:
        raise HTTPException(400, "APK too large (max 120 MB)")
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
    audit.log(admin, "app_customization.apk.upload", "", {"size": len(data)})
    return {"url": url}
