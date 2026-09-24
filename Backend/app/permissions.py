"""Role / capability matrix.

Two roles exist: ``admin`` and ``superadmin``. Every protected endpoint
declares the capability it needs; :func:`require` (in ``security.py``) checks
that the caller's role grants it. This is the single source of truth that
mirrors the feature table the product owner specified.
"""
from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


class Cap(str, Enum):
    # Pharmacy lifecycle
    REVIEW_SIGNUPS = "review_signups"
    APPROVE_PHARMACY = "approve_pharmacy"
    EDIT_VERIFY_RULES = "edit_verify_rules"
    VIEW_PHARMACIES = "view_pharmacies"
    EDIT_PHARMACY = "edit_pharmacy"
    SUSPEND_PHARMACY = "suspend_pharmacy"
    DELETE_PHARMACY = "delete_pharmacy"
    OVERRIDE_DISCOUNT = "override_discount"          # admin = limited, super = any
    OVERRIDE_DISCOUNT_UNLIMITED = "override_discount_unlimited"

    # Orders / disputes
    VIEW_ORDERS = "view_orders"
    RESOLVE_DISPUTES = "resolve_disputes"
    ISSUE_REFUND = "issue_refund"

    # Reservations (in-store reserve → pharmacy redeem)
    VIEW_RESERVATIONS = "view_reservations"

    # Complaints (customer → pharmacy)
    VIEW_COMPLAINTS = "view_complaints"
    MANAGE_COMPLAINTS = "manage_complaints"

    # Customers
    VIEW_CUSTOMERS = "view_customers"
    BLOCK_CUSTOMER = "block_customer"
    DELETE_CUSTOMER = "delete_customer"

    # Salesmen / referrals / money
    MANAGE_REFERRALS = "manage_referrals"
    VIEW_SALESMEN = "view_salesmen"
    SET_COMMISSION = "set_commission"
    VIEW_PAYOUTS = "view_payouts"
    APPROVE_PAYOUTS = "approve_payouts"
    VIEW_REVENUE = "view_revenue"

    # Catalog / analytics / comms
    VIEW_ANALYTICS = "view_analytics"
    EDIT_CATALOG = "edit_catalog"
    FULL_CATALOG = "full_catalog"
    BROADCAST_DRAFT = "broadcast_draft"
    BROADCAST_SEND = "broadcast_send"

    # Platform
    FEATURE_FLAGS = "feature_flags"
    MANAGE_ADMINS = "manage_admins"
    ASSIGN_REGIONS = "assign_regions"
    VIEW_OWN_AUDIT = "view_own_audit"
    VIEW_ALL_AUDIT = "view_all_audit"


# Capabilities granted to a plain admin. Anything not in this set is
# super-admin-only. Super-admin implicitly has everything.
ADMIN_CAPS = {
    Cap.REVIEW_SIGNUPS,
    Cap.APPROVE_PHARMACY,
    Cap.VIEW_PHARMACIES,
    Cap.SUSPEND_PHARMACY,
    Cap.OVERRIDE_DISCOUNT,
    Cap.VIEW_ORDERS,
    Cap.RESOLVE_DISPUTES,
    Cap.VIEW_RESERVATIONS,
    Cap.VIEW_COMPLAINTS,
    Cap.MANAGE_COMPLAINTS,
    Cap.VIEW_CUSTOMERS,
    Cap.BLOCK_CUSTOMER,
    Cap.VIEW_SALESMEN,
    Cap.VIEW_PAYOUTS,
    Cap.VIEW_ANALYTICS,
    Cap.EDIT_CATALOG,
    Cap.BROADCAST_DRAFT,
    Cap.VIEW_OWN_AUDIT,
}


def has_cap(role: str, cap: Cap) -> bool:
    if role == Role.SUPERADMIN:
        return True
    return cap in ADMIN_CAPS


# Discount override ceiling for plain admins (super-admin = unlimited).
ADMIN_MAX_DISCOUNT_PERCENT = 25
