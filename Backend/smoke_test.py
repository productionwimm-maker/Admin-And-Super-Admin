"""Quick end-to-end smoke test of the API in mock mode (no server needed)."""
import os

os.environ["USE_MOCK"] = "true"
os.environ["JWT_SECRET"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app, seed_superadmin  # noqa: E402

seed_superadmin()  # fire the startup seed explicitly (TestClient isn't used as a context manager here)
c = TestClient(app)


def login(email, pw):
    r = c.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# health
assert c.get("/api/health").json()["status"] == "ok"

# both default accounts are seeded on startup
sa = login("superadmin@whereismymedicine.com", "Superadmin@Wimm@2026")
me = c.get("/api/auth/me", headers=auth(sa)).json()
assert me["role"] == "superadmin", me
print("superadmin caps:", len(me["capabilities"]))

adm = login("admin@whereismymedicine.com", "Admin@Wimm@2026")
me_a = c.get("/api/auth/me", headers=auth(adm)).json()
assert me_a["role"] == "admin", me_a
print("admin caps:", len(me_a["capabilities"]))

# overview
ov = c.get("/api/analytics/overview", headers=auth(adm)).json()
print("overview:", ov)
assert ov["pendingApprovals"] >= 2

# pending signups + approve one
pend = c.get("/api/pharmacies/pending", headers=auth(adm)).json()
assert len(pend) >= 2
phone = pend[0]["id"]
r = c.post(f"/api/pharmacies/{phone}/approve", headers=auth(adm))
assert r.status_code == 200 and r.json()["verified"] is True, r.text

# admin discount cap enforced (>25% blocked for admin)
r = c.put(f"/api/pharmacies/{phone}/discount", headers=auth(adm), json={"discountPercent": 40})
assert r.status_code == 403, "admin should be capped"
# super-admin can set any
r = c.put(f"/api/pharmacies/{phone}/discount", headers=auth(sa), json={"discountPercent": 40})
assert r.status_code == 200, r.text

# admin cannot delete pharmacy; super-admin can
r = c.delete(f"/api/pharmacies/{phone}", headers=auth(adm))
assert r.status_code == 403

# admin cannot issue refund
r = c.post("/api/orders/ord_1001/refund", headers=auth(adm), json={"amount": 100, "reason": "x"})
assert r.status_code == 403
# super-admin can
r = c.post("/api/orders/ord_1001/refund", headers=auth(sa), json={"amount": 100, "reason": "wrong item"})
assert r.status_code == 200, r.text

# dispute chat
chat = c.get("/api/orders/ord_1003/chat", headers=auth(adm)).json()
assert len(chat["messages"]) == 2, chat

# salesman performance
sm = c.get("/api/salesmen", headers=auth(sa)).json()
print("salesmen:", [(s["code"], s["pharmaciesSignedUp"], s["gmv"]) for s in sm])

# audit: admin sees only own actions, super sees all
admin_audit = c.get("/api/audit", headers=auth(adm)).json()
super_audit = c.get("/api/audit", headers=auth(sa)).json()
assert all(a["actorEmail"] == "admin@whereismymedicine.com" for a in admin_audit)
assert len(super_audit) >= len(admin_audit)
print(f"audit: admin={len(admin_audit)} super={len(super_audit)}")

print("\nALL SMOKE TESTS PASSED")
