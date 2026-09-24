# Deploying to Render — step by step

You have one zip with three folders: **Backend**, **Admin**, **Super-Admin**.

## Step 1 — Put the code on GitHub
1. Unzip `wimm-admin-dashboard.zip`.
2. Create a new GitHub repo (private is fine).
3. From inside the unzipped folder:
   ```bash
   git init
   git add .
   git commit -m "WIMM admin dashboard"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

## Step 2 — Create the Render Blueprint
1. https://dashboard.render.com → **New +** → **Blueprint**.
2. Connect GitHub, pick the repo. Render reads `render.yaml` and shows **three**
   services to create:
   - `wimm-admin-api`  (Python web service — the Backend)
   - `wimm-admin`      (static site — the Admin portal)
   - `wimm-superadmin` (static site — the Super Admin portal)
3. Click **Apply**. The credentials are already set in `render.yaml`
   (`admin@whereismymedicine.com` / `superadmin@whereismymedicine.com`) — change
   them there first if you want different ones.

## Step 3 — Point both portals at the API
1. When `wimm-admin-api` is live, copy its URL
   (e.g. `https://wimm-admin-api.onrender.com`).
2. `wimm-admin` → **Environment** → set
   `VITE_API_URL = https://wimm-admin-api.onrender.com` → Save (it rebuilds).
3. `wimm-superadmin` → **Environment** → set the **same** `VITE_API_URL` → Save.
   *(VITE_API_URL is baked in at build time, so set it before the build you use.)*

## Step 4 — Log in
- Open `wimm-admin` URL → log in with **admin@whereismymedicine.com /
  Admin@Wimm@2026** → Admin console.
- Open `wimm-superadmin` URL → log in with **superadmin@whereismymedicine.com /
  Superadmin@Wimm@2026** → Super Admin console.
- You're in **mock mode** — seeded sample pharmacies/orders. Everything works
  against in-memory data so you can try approvals, refunds, the audit log, etc.

## Step 5 — Go live against real Firestore
1. Firebase Console → ⚙ Project settings → **Service accounts** →
   **Generate new private key** → download the JSON.
2. `wimm-admin-api` → **Environment**:
   - `USE_MOCK` → `false`
   - `FIREBASE_SERVICE_ACCOUNT` → paste the entire JSON
   - (optional) `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` for live refunds
   - **Save** (redeploys). Both seed accounts are created in `admin_users`.

## Step 6 — (recommended) Tighten CORS
Set `wimm-admin-api` → `CORS_ORIGINS` to your two portal URLs, comma-separated
(e.g. `https://wimm-admin.onrender.com,https://wimm-superadmin.onrender.com`)
instead of `*`.

---

### Notes
- **Free plan** services sleep when idle; first request after a while takes ~30s.
- The free Python service filesystem is ephemeral — fine, real data lives in
  Firestore; mock data resets on restart by design.
- Don't commit the Firebase service-account JSON — set it only in Render env vars.
