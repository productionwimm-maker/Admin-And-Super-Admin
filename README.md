# WhereIsMyMedicine — Admin & Super Admin Dashboard

Three folders:

| Folder | What it is |
|---|---|
| **Backend** | Python / FastAPI API (shared by both portals). Talks to your Firestore project `where-is-my-medicine-it`, Razorpay (refunds), FCM (broadcasts). |
| **Admin** | The Admin dashboard (React + Vite, JSX). Its login only accepts **admin** accounts. |
| **Super-Admin** | The Super Admin dashboard (React + Vite, JSX). Its login only accepts **super-admin** accounts. |

Both portals share the same backend and the same green app theme; they differ
only in which role may log in and which features that role can use.

## Default login credentials
| Portal | Email | Password |
|---|---|---|
| Admin | `admin@whereismymedicine.com` | `Admin@Wimm@2026` |
| Super Admin | `superadmin@whereismymedicine.com` | `Superadmin@Wimm@2026` |

> Enter the **admin** credentials on the Admin portal's login page → you're in as
> Admin. Enter the **super-admin** credentials on the Super Admin portal → you're
> in as Super Admin. Each portal rejects the other role's credentials with a
> message pointing you to the right portal. Change these passwords after first
> login (Super Admin → Admin Accounts), or override them via env vars.

## Roles at a glance
Admins: review/approve pharmacy signups, suspend pharmacies, discount override
(≤25%), view orders + resolve disputes, manage customers + block, view salesmen/
payouts/analytics, add/edit catalog, draft broadcasts, see their own audit log.
Super Admins: **everything**, plus delete pharmacies/customers, any-amount
refunds, issue/revoke referral codes + set commission, approve payouts, platform
revenue, full catalog control, app-wide broadcasts, feature flags/force-update,
manage admin accounts + region scope, full audit log.

---

## Run locally
**1. Backend** (terminal 1)
```bash
cd Backend
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```
**2. Admin portal** (terminal 2) → http://localhost:5173
```bash
cd Admin
npm install
npm run dev
```
**3. Super Admin portal** (terminal 3) → http://localhost:5174
```bash
cd Super-Admin
npm install
npm run dev
```

---

## Deploy on Render (via GitHub)
See **DEPLOY.md** for the full guide. Short version: push to GitHub → Render →
**New + → Blueprint** → pick the repo → **Apply**. `render.yaml` creates three
services (`wimm-admin-api`, `wimm-admin`, `wimm-superadmin`). After the API is
live, set each portal's `VITE_API_URL` to the API URL.

It starts in **mock mode** (seeded sample data) so you can log in and click
everything before wiring Firebase. To go live: on `wimm-admin-api` set
`USE_MOCK=false` and `FIREBASE_SERVICE_ACCOUNT` (the service-account JSON).

The dashboard uses the same Firestore collections as the Android app
(`pharmacy_accounts`, `pharmacies`, `orders`, `customers`, `referral_codes`,
`pharmacy_earnings`) plus dashboard-owned ones (`admin_users`, `audit_logs`,
`medicine_catalog`, `feature_flags`, `broadcasts`, `refunds`, `payouts`).

> ⚠️ Next step after deploy: connect the Android app to the verified gate
> (customer search should show only `verified == true` pharmacies) and lock down
> `firestore.rules`.
