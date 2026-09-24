"""Money: refunds (Razorpay), salesman referral codes & commissions,
pharmacy earnings, payout approvals, and platform revenue reports."""
from fastapi import APIRouter, Depends, HTTPException

from .. import audit, store
from ..config import settings
from ..permissions import Cap
from ..schemas import (CommissionBody, PayoutBody, RefundBody, ReferralBody)
from ..security import CurrentAdmin, require, require_superadmin

router = APIRouter(prefix="/api", tags=["finance"])


# ── Refunds (super-admin only, any amount) ─────────────────────────────────
@router.post("/orders/{order_id}/refund")
def issue_refund(order_id: str, body: RefundBody,
                 admin: CurrentAdmin = Depends(require(Cap.ISSUE_REFUND))):
    order = store.collection("orders").get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    gateway_ref = None
    gateway_status = "RECORDED"
    payment_id = order.get("paymentId", "")
    # Attempt a real Razorpay refund when keys are present and a payment exists.
    if settings.razorpay_key_id and settings.razorpay_key_secret and payment_id and not settings.use_mock:
        try:
            import razorpay
            client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
            r = client.payment.refund(payment_id, {"amount": body.amount * 100})  # paise
            gateway_ref = r.get("id")
            gateway_status = r.get("status", "processed")
        except Exception as e:  # noqa: BLE001 — surface gateway failure to caller
            raise HTTPException(502, f"Razorpay refund failed: {e}")

    rec = store.collection("refunds").add({
        "orderId": order_id, "amount": body.amount, "reason": body.reason,
        "paymentId": payment_id, "gatewayRef": gateway_ref, "gatewayStatus": gateway_status,
        "issuedBy": admin.email, "createdAtMillis": store.now_ms(),
    })
    store.collection("orders").update(order_id, {"paymentStatus": "REFUNDED"})
    audit.log(admin, "order.refund", order_id, {"amount": body.amount, "reason": body.reason})
    return {"ok": True, "refund": rec}


@router.get("/refunds")
def list_refunds(admin: CurrentAdmin = Depends(require(Cap.ISSUE_REFUND))):
    rows = store.collection("refunds").list()
    rows.sort(key=lambda r: r.get("createdAtMillis", 0), reverse=True)
    return rows


# ── Referral codes for salesmen (super-admin issues/revokes) ───────────────
@router.get("/referrals")
def list_referrals(admin: CurrentAdmin = Depends(require(Cap.VIEW_SALESMEN))):
    return store.collection("referral_codes").list()


@router.post("/referrals")
def create_referral(body: ReferralBody,
                    admin: CurrentAdmin = Depends(require(Cap.MANAGE_REFERRALS))):
    code = body.code.strip().upper()
    if store.collection("referral_codes").get(code):
        raise HTTPException(409, "Code already exists")
    rec = store.collection("referral_codes").set(code, {
        "code": code, "salesmanName": body.salesmanName, "salesmanPhone": body.salesmanPhone,
        "commissionRate": body.commissionRate, "active": body.active,
        "createdAtMillis": store.now_ms(),
    })
    audit.log(admin, "referral.create", code)
    return rec


@router.post("/referrals/{code}/revoke")
def revoke_referral(code: str, admin: CurrentAdmin = Depends(require(Cap.MANAGE_REFERRALS))):
    if not store.collection("referral_codes").get(code):
        raise HTTPException(404, "Code not found")
    store.collection("referral_codes").update(code, {"active": False})
    audit.log(admin, "referral.revoke", code)
    return {"ok": True, "code": code, "active": False}


@router.put("/referrals/{code}/commission")
def set_commission(code: str, body: CommissionBody,
                   admin: CurrentAdmin = Depends(require(Cap.SET_COMMISSION))):
    if not store.collection("referral_codes").get(code):
        raise HTTPException(404, "Code not found")
    store.collection("referral_codes").update(code, {"commissionRate": body.commissionRate})
    audit.log(admin, "referral.commission", code, {"rate": body.commissionRate})
    return {"ok": True, "code": code, "commissionRate": body.commissionRate}


# ── Salesman performance (codes -> pharmacies signed up -> revenue) ────────
@router.get("/salesmen")
def salesman_performance(admin: CurrentAdmin = Depends(require(Cap.VIEW_SALESMEN))):
    codes = store.collection("referral_codes").list()
    accounts = store.collection("pharmacy_accounts").list()
    orders = store.collection("orders").list()
    paid_by_pharmacy: dict[str, int] = {}
    for o in orders:
        if o.get("paymentStatus") == "PAID":
            paid_by_pharmacy[o.get("pharmacyPhone", "")] = \
                paid_by_pharmacy.get(o.get("pharmacyPhone", ""), 0) + o.get("totalAmount", 0)

    result = []
    for c in codes:
        signed = [a for a in accounts if a.get("referralCode") == c["code"]]
        gmv = sum(paid_by_pharmacy.get(a.get("mobileNumber", ""), 0) for a in signed)
        commission = round(gmv * c.get("commissionRate", 0) / 100, 2)
        result.append({
            "code": c["code"], "salesmanName": c.get("salesmanName", ""),
            "salesmanPhone": c.get("salesmanPhone", ""),
            "commissionRate": c.get("commissionRate", 0), "active": c.get("active", True),
            "pharmaciesSignedUp": len(signed), "gmv": gmv, "commissionEarned": commission,
        })
    return result


# ── Pharmacy earnings & payout approvals (super-admin approves) ────────────
@router.get("/payouts")
def list_payouts(admin: CurrentAdmin = Depends(require(Cap.VIEW_PAYOUTS))):
    earnings = store.collection("pharmacy_earnings").list()
    payouts = store.collection("payouts").list()
    payouts.sort(key=lambda r: r.get("createdAtMillis", 0), reverse=True)
    return {"earnings": earnings, "payouts": payouts}


@router.post("/payouts/approve")
def approve_payout(body: PayoutBody,
                   admin: CurrentAdmin = Depends(require(Cap.APPROVE_PAYOUTS))):
    earn = store.collection("pharmacy_earnings").get(body.pharmacyPhone)
    if not earn:
        raise HTTPException(404, "No earnings record for that pharmacy")
    rec = store.collection("payouts").add({
        "pharmacyPhone": body.pharmacyPhone, "amount": body.amount, "note": body.note,
        "status": "APPROVED", "approvedBy": admin.email, "createdAtMillis": store.now_ms(),
    })
    # Move approved amount from unclaimed -> redeemed.
    unclaimed = max(0, earn.get("unclaimedAmount", 0) - body.amount)
    redeemed = earn.get("redeemedAmount", 0) + body.amount
    store.collection("pharmacy_earnings").update(
        body.pharmacyPhone, {"unclaimedAmount": unclaimed, "redeemedAmount": redeemed})
    audit.log(admin, "payout.approve", body.pharmacyPhone, {"amount": body.amount})
    return {"ok": True, "payout": rec}


# ── Platform revenue (super-admin only) ────────────────────────────────────
@router.get("/revenue")
def revenue(admin: CurrentAdmin = Depends(require(Cap.VIEW_REVENUE))):
    orders = store.collection("orders").list()
    paid = [o for o in orders if o.get("paymentStatus") == "PAID"]
    gmv = sum(o.get("totalAmount", 0) for o in paid)
    refunds = store.collection("refunds").list()
    refunded = sum(r.get("amount", 0) for r in refunds)
    # Platform take illustratively modelled as average pharmacy discount share.
    return {
        "gmv": gmv, "paidOrders": len(paid), "totalOrders": len(orders),
        "refundedAmount": refunded, "netRevenue": gmv - refunded,
        "currency": "INR",
    }
