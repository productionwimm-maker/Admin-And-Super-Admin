"""Pydantic request bodies shared across routers."""
from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    email: str


class ReasonBody(BaseModel):
    reason: str = Field(default="", max_length=500)


class DiscountBody(BaseModel):
    discountPercent: int = Field(ge=0, le=100)


class LocationBody(BaseModel):
    latitude: float
    longitude: float


class CreateAdminBody(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: str
    role: str = "admin"          # "admin" | "superadmin"
    regions: list[str] = []


class UpdateAdminBody(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    regions: Optional[list[str]] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class ReferralBody(BaseModel):
    code: str
    salesmanName: str
    salesmanPhone: str = ""
    commissionRate: float = Field(ge=0, le=100, default=0)
    active: bool = True


class CommissionBody(BaseModel):
    commissionRate: float = Field(ge=0, le=100)


class RefundBody(BaseModel):
    amount: int = Field(gt=0, description="Refund amount in rupees")
    reason: str = ""


class PayoutBody(BaseModel):
    pharmacyPhone: str
    amount: int = Field(gt=0)
    note: str = ""


class CatalogItemBody(BaseModel):
    name: str
    saltName: str = ""
    category: str = ""
    mrp: float = 0
    prescriptionRequired: bool = False
    active: bool = True


class BroadcastBody(BaseModel):
    title: str
    message: str
    audience: str = "customers"   # customers | pharmacies | all
    region: str = ""
    send: bool = False            # admins can only draft (send=False)


class FeatureFlagsBody(BaseModel):
    flags: dict = {}
    comingSoon: dict = {}
    forceUpdate: dict = {}
    # App discount cut carved out of the pharmacy's agreed discount, e.g.
    # {"platformExtraPct": 2, "enabled": true}. Super-admin only (see config.py).
    appDiscount: dict = {}
