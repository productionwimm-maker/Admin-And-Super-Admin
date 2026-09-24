"""Survey responses — pharmacy feature interest forms written by the Android app."""
from fastapi import APIRouter, Depends

from .. import store
from ..permissions import Cap
from ..security import require

router = APIRouter(prefix="/api/surveys", tags=["surveys"])

COLLECTION = "survey_inventory"


@router.get("/inventory")
def inventory_responses(admin=Depends(require(Cap.VIEW_PHARMACIES))):
    rows = store.collection(COLLECTION).list()
    rows.sort(key=lambda r: r.get("respondedAt", ""), reverse=True)
    return rows
