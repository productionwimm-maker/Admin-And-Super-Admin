"""Seeded in-memory data used when USE_MOCK=true.

Field names mirror the real Firestore documents written by the Android app
(see PharmacyRepository.kt / OrdersFirestoreRepository.kt) so the dashboard
behaves identically once you flip USE_MOCK=false and point it at Firestore.

The ``admin_users`` collection starts empty; the super-admin is seeded on boot
by main.py regardless of mode.
"""
import time

_now = int(time.time() * 1000)
_day = 86_400_000

store: dict[str, dict[str, dict]] = {
    # ── pharmacy_accounts/{+91phone} — full signup record ─────────────────
    "pharmacy_accounts": {
        "+919800000001": {
            "pharmacyName": "Sunrise Medicals", "ownerName": "Rahul Sen",
            "mobileNumber": "9800000001", "drugLicenseNumber": "WB-DL-22931",
            "drugLicenseUri": "https://picsum.photos/seed/lic1/600/400",
            "aadharNumber": "4521 9087 3344",
            "aadharUris": ["https://picsum.photos/seed/aad1/600/400"],
            "photoUri": "https://picsum.photos/seed/shop1/300/300",
            "city": "Kolkata", "state": "West Bengal", "pincode": "700019",
            "discountPercent": 12, "referralCode": "WIMMS-RJ01",
            "pharmacyCode": "WIMMPWB001", "latitude": 22.5448, "longitude": 88.3426,
            "verificationStatus": "pending", "verified": False, "suspended": False,
            "updatedAtMillis": _now - 2 * _day,
        },
        "+919800000002": {
            "pharmacyName": "CityCare Pharmacy", "ownerName": "Asha Verma",
            "mobileNumber": "9800000002", "drugLicenseNumber": "WB-DL-30112",
            "drugLicenseUri": "https://picsum.photos/seed/lic2/600/400",
            "aadharNumber": "7781 2210 9098",
            "aadharUris": ["https://picsum.photos/seed/aad2/600/400"],
            "photoUri": "https://picsum.photos/seed/shop2/300/300",
            "city": "Howrah", "state": "West Bengal", "pincode": "711101",
            "discountPercent": 8, "referralCode": "WIMMS-RJ01",
            "pharmacyCode": "WIMMPWB002", "latitude": 22.5958, "longitude": 88.2636,
            "verificationStatus": "approved", "verified": True, "suspended": False,
            "updatedAtMillis": _now - 9 * _day,
        },
        "+919800000003": {
            "pharmacyName": "Apollo Plus", "ownerName": "Imran Khan",
            "mobileNumber": "9800000003", "drugLicenseNumber": "MH-DL-88210",
            "drugLicenseUri": "https://picsum.photos/seed/lic3/600/400",
            "aadharNumber": "1102 5567 8841",
            "aadharUris": ["https://picsum.photos/seed/aad3/600/400"],
            "photoUri": "https://picsum.photos/seed/shop3/300/300",
            "city": "Pune", "state": "Maharashtra", "pincode": "411001",
            "discountPercent": 15, "referralCode": "WIMMS-MH07",
            "pharmacyCode": "WIMMPMH001", "latitude": 18.5204, "longitude": 73.8567,
            "verificationStatus": "pending", "verified": False, "suspended": False,
            "updatedAtMillis": _now - 5 * 3_600_000,
        },
    },
    # ── pharmacies/{uid} — public presence ────────────────────────────────
    "pharmacies": {
        "uid_pharm_2": {
            "pharmacyName": "CityCare Pharmacy", "phone": "9800000002",
            "latitude": 22.5958, "longitude": 88.2636, "online": True,
            "discountPercent": 8, "pharmacyCode": "WIMMPWB002",
            "verified": True, "suspended": False, "updatedAtMillis": _now - 3_600_000,
        },
    },
    # ── orders/{id} ───────────────────────────────────────────────────────
    "orders": {
        "ord_1001": {
            "customerPhone": "9911111111", "customerName": "Sourav Das",
            "customerAge": 34, "customerGender": "Male",
            "pharmacyUid": "uid_pharm_2", "pharmacyPhone": "9800000002",
            "pharmacyName": "CityCare Pharmacy",
            "itemsSummary": "Dolo 650 x2, Azithral 500 x1", "totalAmount": 245,
            "homeDelivery": True, "status": "OUT_FOR_DELIVERY",
            "deliveryCode": "481922", "riderName": "Bikash", "riderVehicle": "WB02 AX 1199",
            "paymentStatus": "PAID", "paymentId": "pay_Nq8mockA1", "createdAtMillis": _now - 4_000_000,
        },
        "ord_1002": {
            "customerPhone": "9922222222", "customerName": "Meera Iyer",
            "customerAge": 28, "customerGender": "Female",
            "pharmacyUid": "uid_pharm_2", "pharmacyPhone": "9800000002",
            "pharmacyName": "CityCare Pharmacy",
            "itemsSummary": "Insulin Pen x1", "totalAmount": 890,
            "homeDelivery": True, "status": "DELIVERED",
            "deliveryCode": "330011", "paymentStatus": "PAID",
            "paymentId": "pay_Nq8mockB2", "createdAtMillis": _now - 2 * _day,
        },
        "ord_1003": {
            "customerPhone": "9933333333", "customerName": "Anil Gupta",
            "customerAge": 51, "customerGender": "Male",
            "pharmacyUid": "uid_pharm_2", "pharmacyPhone": "9800000002",
            "pharmacyName": "CityCare Pharmacy",
            "itemsSummary": "Pantop D x1 (disputed — wrong item)", "totalAmount": 130,
            "homeDelivery": False, "status": "PLACED",
            "paymentStatus": "PENDING", "createdAtMillis": _now - 90 * 60 * 1000,
        },
    },
    # ── reservations/{id} — in-store reserve → pharmacy redeem ────────────
    "reservations": {
        "resv_5001": {
            "reservationId": "40771523", "redeemCode": "K7Q2-9WMB",
            "customerUid": "uid_cust_1", "customerPhone": "9911111111",
            "customerName": "Sourav Das",
            "pharmacyUid": "uid_pharm_2", "pharmacyPhone": "9800000002",
            "pharmacyName": "CityCare Pharmacy",
            "medicineName": "Dolo 650", "quantity": 2, "unitPrice": 32,
            "shopDiscountPct": 6, "platformExtraPct": 2,
            "status": "REDEEMED", "finalBillAmount": 60,
            "createdAtMillis": _now - 3 * _day, "redeemedAtMillis": _now - 3 * _day + 3_600_000,
        },
        "resv_5002": {
            "reservationId": "88213094", "redeemCode": "M4X8-3PLC",
            "customerUid": "uid_cust_2", "customerPhone": "9922222222",
            "customerName": "Meera Iyer",
            "pharmacyUid": "uid_pharm_2", "pharmacyPhone": "9800000002",
            "pharmacyName": "CityCare Pharmacy",
            "medicineName": "Azithral 500", "quantity": 1, "unitPrice": 118,
            "shopDiscountPct": 6, "platformExtraPct": 2,
            "status": "RESERVED", "finalBillAmount": 0,
            "createdAtMillis": _now - 2 * 3_600_000, "redeemedAtMillis": 0,
        },
    },
    "complaints": {
        "cmp_7001": {
            "customerUid": "uid_cust_1", "customerPhone": "9911111111", "customerName": "Sourav Das",
            "pharmacyUid": "uid_pharm_2", "pharmacyName": "CityCare Pharmacy",
            "category": "Overcharged / wrong price",
            "message": "Charged ₹40 for Dolo 650 instead of the ₹32 shown in the app.",
            "status": "OPEN", "adminAction": "", "adminNote": "", "actionByRole": "",
            "actionAtMillis": 0, "createdAtMillis": _now - 5 * 3_600_000,
        },
        "cmp_7002": {
            "customerUid": "uid_cust_2", "customerPhone": "9922222222", "customerName": "Meera Iyer",
            "pharmacyUid": "uid_pharm_2", "pharmacyName": "CityCare Pharmacy",
            "category": "Refused the app discount",
            "message": "",
            "status": "RESOLVED", "adminAction": "Warning issued",
            "adminNote": "Reminded the pharmacy that app discounts are mandatory.",
            "actionByRole": "admin", "actionAtMillis": _now - 1 * _day,
            "createdAtMillis": _now - 2 * _day,
        },
    },
    "chats": {
        # chat messages are nested in Firestore; for the mock we flatten one
        # thread keyed by orderId into a list under "messages".
        "ord_1003": {"messages": [
            {"senderRole": "customer", "text": "I received the wrong medicine.", "timestampMillis": _now - 80 * 60 * 1000},
            {"senderRole": "pharmacy", "text": "Apologies, we'll arrange a replacement.", "timestampMillis": _now - 75 * 60 * 1000},
        ]},
    },
    # ── customers/{+91phone is doc id in app, here plain} ─────────────────
    "customers": {
        "9911111111": {"name": "Sourav Das", "dob": "1991-03-14", "gender": "Male",
                       "phone": "9911111111", "blocked": False},
        "9922222222": {"name": "Meera Iyer", "dob": "1997-07-02", "gender": "Female",
                       "phone": "9922222222", "blocked": False},
        "9933333333": {"name": "Anil Gupta", "dob": "1974-11-23", "gender": "Male",
                       "phone": "9933333333", "blocked": False},
    },
    # ── referral_codes/{code} — salesman codes ────────────────────────────
    "referral_codes": {
        "WIMMS-RJ01": {"code": "WIMMS-RJ01", "salesmanName": "Rajesh Jain",
                       "salesmanPhone": "9090909090", "commissionRate": 5,
                       "active": True, "createdAtMillis": _now - 30 * _day},
        "WIMMS-MH07": {"code": "WIMMS-MH07", "salesmanName": "Pooja Naik",
                       "salesmanPhone": "9070707070", "commissionRate": 4,
                       "active": True, "createdAtMillis": _now - 20 * _day},
    },
    # ── pharmacy_earnings/{+91phone} ──────────────────────────────────────
    "pharmacy_earnings": {
        "9800000002": {"unclaimedAmount": 1135, "redeemedAmount": 4200},
    },
    # ── admin-dashboard-owned collections ─────────────────────────────────
    "admin_users": {},
    "audit_logs": {},
    # Used by routers/app_update.py and routers/surveys.py — pre-declared so
    # mock mode doesn't KeyError before anything has been pushed yet.
    "app_updates": {},
    "survey_inventory": {},
    # Used by routers/poster.py — the main-website promo poster.
    "posters": {},
    "medicine_catalog": {
        "med_dolo650": {"name": "Dolo 650", "saltName": "Paracetamol 650mg",
                        "category": "Analgesic", "mrp": 32, "prescriptionRequired": False, "active": True},
        "med_azithral": {"name": "Azithral 500", "saltName": "Azithromycin 500mg",
                         "category": "Antibiotic", "mrp": 118, "prescriptionRequired": True, "active": True},
    },
    "broadcasts": {},
    "refunds": {},
    "payouts": {},
    "service_zones": {},
    "feature_flags": {
        "config": {
            "flags": {"doctorConsult": True, "aiAssistant": True, "homeDelivery": True},
            "comingSoon": {"labReports": True, "insurance": True},
            "forceUpdate": {"enabled": False, "minVersionCode": 1, "message": ""},
            "appDiscount": {"platformExtraPct": 2, "enabled": True},
            "updatedAtMillis": _now - _day,
        }
    },
}
