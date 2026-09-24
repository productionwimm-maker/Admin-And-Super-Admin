"""Service coverage zone management.

Hexagonal service zones stored in Firestore. Super-admin places them on a map;
the Android app calls /api/coverage/check to know if a delivery address is
within any active zone.
"""
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import store
from ..permissions import Cap
from ..security import require

router = APIRouter(prefix="/api/coverage", tags=["coverage"])


class Vertex(BaseModel):
    lat: float
    lng: float


class ZoneIn(BaseModel):
    name: str
    vertices: List[Vertex]
    centerLat: float
    centerLng: float
    radiusMeters: float


def _to_out(row: dict) -> dict:
    raw_verts = row.get("vertices", [])
    vertices = []
    for v in raw_verts:
        if isinstance(v, list):
            vertices.append({"lat": v[0], "lng": v[1]})
        else:
            vertices.append({"lat": v.get("lat", 0), "lng": v.get("lng", 0)})
    return {
        "id": row["id"],
        "name": row.get("name", ""),
        "vertices": vertices,
        "centerLat": row.get("centerLat", 0.0),
        "centerLng": row.get("centerLng", 0.0),
        "radiusMeters": row.get("radiusMeters", 0.0),
        "active": row.get("active", True),
        "createdAtMillis": row.get("createdAtMillis", 0),
    }


@router.get("/zones")
def list_zones(admin=Depends(require(Cap.VIEW_ANALYTICS))):
    return [_to_out(r) for r in store.collection("service_zones").list()]


@router.post("/zones", status_code=201)
def create_zone(body: ZoneIn, admin=Depends(require(Cap.FEATURE_FLAGS))):
    data = {
        "name": body.name,
        "vertices": [[v.lat, v.lng] for v in body.vertices],
        "centerLat": body.centerLat,
        "centerLng": body.centerLng,
        "radiusMeters": body.radiusMeters,
        "active": True,
        "createdAtMillis": store.now_ms(),
    }
    return _to_out(store.collection("service_zones").add(data))


@router.delete("/zones/{zone_id}", status_code=204)
def delete_zone(zone_id: str, admin=Depends(require(Cap.FEATURE_FLAGS))):
    store.collection("service_zones").delete(zone_id)


@router.get("/check")
def check_coverage(lat: float, lng: float):
    """Called by the Android app when user selects a delivery address.
    No auth required — it only tells the app yes/no for coverage.
    """
    zones = store.collection("service_zones").list(where={"active": True})
    for zone in zones:
        raw = zone.get("vertices", [])
        pts = [
            (v[0], v[1]) if isinstance(v, list) else (v.get("lat", 0), v.get("lng", 0))
            for v in raw
        ]
        if len(pts) >= 3 and _point_in_polygon(lat, lng, pts):
            return {"inCoverage": True, "zoneName": zone.get("name", "")}
    return {"inCoverage": False, "zoneName": None}


def _point_in_polygon(lat: float, lng: float, vertices: list) -> bool:
    """Ray-casting algorithm: returns True if (lat, lng) is inside the polygon."""
    n = len(vertices)
    inside = False
    j = n - 1
    for i in range(n):
        lat_i, lng_i = vertices[i]
        lat_j, lng_j = vertices[j]
        if ((lat_i > lat) != (lat_j > lat)) and \
                (lng < (lng_j - lng_i) * (lat - lat_i) / (lat_j - lat_i) + lng_i):
            inside = not inside
        j = i
    return inside
