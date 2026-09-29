"""Finance & reporting — SUPER-ADMIN ONLY.

A single place to see every rupee moving through WIMM and to export accounting
sheets. Data is read live from Firestore:

  • subscription_payments  → platform REVENUE (pharmacies paying to be listed)
  • orders (paid)          → GMV flowing through + delivery fees collected
  • refunds                → money paid back out (a cost)

Money model (platform's own P&L, not the pharmacies'):
  revenue   = subscription income
  gmv       = paid-order value (passes through to pharmacies, shown for context)
  delivery  = delivery fees (customer-funded, pass-through to the courier)
  expenses  = refunds + estimated gateway fees (2% of revenue)
  gst       = 18% component of revenue
  profit    = revenue − expenses           (negative ⇒ loss)

Everything can be sliced by hour / day / week / month / financial-year (India
FY = 1 Apr–31 Mar) and exported as neatly formatted Excel.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from .. import store
from ..security import CurrentAdmin, require_superadmin

router = APIRouter(prefix="/api/finance", tags=["finance-reports"])

GST_RATE = 18          # %
GATEWAY_FEE_PCT = 2    # % of revenue, estimated
IST = timezone(timedelta(hours=5, minutes=30))


# ── helpers ────────────────────────────────────────────────────────────────
def _ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def _now() -> datetime:
    return datetime.now(IST)


def _parse_window(period: Optional[str], frm: Optional[int], to: Optional[int]) -> tuple[int, int]:
    """Resolve a [from_ms, to_ms) window from an explicit range or a named period."""
    if frm is not None and to is not None:
        return frm, to
    now = _now()
    p = (period or "month").lower()
    if p == "hour":
        start = now.replace(minute=0, second=0, microsecond=0)
    elif p == "day":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif p == "week":
        d = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start = d - timedelta(days=d.weekday())
    elif p == "year" or p == "fy":
        # Indian FY starts 1 Apr.
        y = now.year if now.month >= 4 else now.year - 1
        start = datetime(y, 4, 1, tzinfo=IST)
    else:  # month
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return _ms(start), _ms(now) + 1


def _rows(from_ms: int, to_ms: int) -> dict:
    """Pull and window the raw transaction rows once."""
    def win(rows, field="createdAtMillis"):
        return [r for r in rows if from_ms <= int(r.get(field, 0) or 0) < to_ms]

    subs = win(store.collection("subscription_payments").list())
    orders_all = store.collection("orders").list()
    orders = win([o for o in orders_all if o.get("paymentStatus") == "PAID"])
    refunds = win(store.collection("refunds").list())
    return {"subs": subs, "orders": orders, "refunds": refunds}


def _totals(rows: dict) -> dict:
    revenue = sum(int(s.get("amountRupees") or 0) for s in rows["subs"])
    gmv = sum(int(o.get("totalAmount") or 0) for o in rows["orders"])
    delivery = sum(int(o.get("deliveryFee") or 0) for o in rows["orders"])
    refunds = sum(int(r.get("amount") or 0) for r in rows["refunds"])
    gateway = round(revenue * GATEWAY_FEE_PCT / 100)
    gst = round(revenue * GST_RATE / (100 + GST_RATE))
    expenses = refunds + gateway
    profit = revenue - expenses
    return {
        "revenue": revenue, "gmv": gmv, "delivery": delivery,
        "refunds": refunds, "gatewayFees": gateway, "gst": gst,
        "taxableValue": revenue - gst, "expenses": expenses,
        "profit": profit, "loss": (-profit if profit < 0 else 0),
        "subscriptionCount": len(rows["subs"]),
        "paidOrderCount": len(rows["orders"]),
        "refundCount": len(rows["refunds"]),
        "currency": "INR",
    }


def _bucket_key(ms: int, granularity: str) -> str:
    dt = datetime.fromtimestamp(ms / 1000, IST)
    g = granularity.lower()
    if g == "hour":
        return dt.strftime("%Y-%m-%d %H:00")
    if g == "week":
        d = dt - timedelta(days=dt.weekday())
        return d.strftime("W%Y-%m-%d")
    if g == "month":
        return dt.strftime("%Y-%m")
    if g in ("year", "fy"):
        y = dt.year if dt.month >= 4 else dt.year - 1
        return f"FY{y}-{str(y + 1)[2:]}"
    return dt.strftime("%Y-%m-%d")  # day


def _timeseries(rows: dict, granularity: str) -> list[dict]:
    buckets: dict[str, dict] = {}

    def b(ms):
        k = _bucket_key(int(ms or 0), granularity)
        return buckets.setdefault(k, {"bucket": k, "revenue": 0, "gmv": 0, "delivery": 0, "refunds": 0})

    for s in rows["subs"]:
        b(s.get("createdAtMillis"))["revenue"] += int(s.get("amountRupees") or 0)
    for o in rows["orders"]:
        d = b(o.get("createdAtMillis")); d["gmv"] += int(o.get("totalAmount") or 0); d["delivery"] += int(o.get("deliveryFee") or 0)
    for r in rows["refunds"]:
        b(r.get("createdAtMillis"))["refunds"] += int(r.get("amount") or 0)
    out = sorted(buckets.values(), key=lambda x: x["bucket"])
    for d in out:
        d["gateway"] = round(d["revenue"] * GATEWAY_FEE_PCT / 100)
        d["gst"] = round(d["revenue"] * GST_RATE / (100 + GST_RATE))
        d["taxable"] = d["revenue"] - d["gst"]
        d["expenses"] = d["refunds"] + d["gateway"]
        d["profit"] = d["revenue"] - d["expenses"]
    return out


# ── JSON endpoints (Money & Transactions sub-tab) ──────────────────────────
@router.get("/summary")
def summary(period: Optional[str] = "month", frm: Optional[int] = Query(None, alias="from"),
            to: Optional[int] = None, admin: CurrentAdmin = Depends(require_superadmin)):
    a, b = _parse_window(period, frm, to)
    t = _totals(_rows(a, b))
    t.update({"from": a, "to": b, "period": period})
    return t


@router.get("/breakdown")
def breakdown(period: Optional[str] = "month", frm: Optional[int] = Query(None, alias="from"),
              to: Optional[int] = None, admin: CurrentAdmin = Depends(require_superadmin)):
    a, b = _parse_window(period, frm, to)
    t = _totals(_rows(a, b))
    # Pie: where the money comes from (positive inflows).
    return {"slices": [
        {"name": "Subscriptions", "value": t["revenue"]},
        {"name": "Order GMV", "value": t["gmv"]},
        {"name": "Delivery", "value": t["delivery"]},
    ], "outflows": [
        {"name": "Refunds", "value": t["refunds"]},
        {"name": "Gateway fees", "value": t["gatewayFees"]},
    ]}


@router.get("/timeseries")
def timeseries(granularity: str = "day", period: Optional[str] = None,
               frm: Optional[int] = Query(None, alias="from"), to: Optional[int] = None,
               admin: CurrentAdmin = Depends(require_superadmin)):
    # Default window scales with granularity when none is given.
    if frm is None and to is None and period is None:
        period = {"hour": "day", "day": "month", "week": "year", "month": "fy", "fy": "fy"}.get(granularity, "month")
    a, b = _parse_window(period, frm, to)
    return {"granularity": granularity, "points": _timeseries(_rows(a, b), granularity)}


@router.get("/transactions")
def transactions(period: Optional[str] = "month", frm: Optional[int] = Query(None, alias="from"),
                 to: Optional[int] = None, limit: int = 200,
                 admin: CurrentAdmin = Depends(require_superadmin)):
    a, b = _parse_window(period, frm, to)
    rows = _rows(a, b)
    tx = []
    for s in rows["subs"]:
        tx.append({"type": "Subscription", "direction": "in", "amount": int(s.get("amountRupees") or 0),
                   "party": s.get("pharmacyPhone", ""), "ref": s.get("paymentId", ""),
                   "at": int(s.get("createdAtMillis", 0) or 0)})
    for o in rows["orders"]:
        tx.append({"type": "Order", "direction": "in", "amount": int(o.get("totalAmount") or 0),
                   "party": o.get("pharmacyName") or o.get("pharmacyPhone", ""), "ref": o.get("paymentId", ""),
                   "at": int(o.get("createdAtMillis", 0) or 0)})
    for r in rows["refunds"]:
        tx.append({"type": "Refund", "direction": "out", "amount": int(r.get("amount") or 0),
                   "party": r.get("orderId", ""), "ref": r.get("gatewayRef", ""),
                   "at": int(r.get("createdAtMillis", 0) or 0)})
    tx.sort(key=lambda x: x["at"], reverse=True)
    return {"count": len(tx), "transactions": tx[:limit]}


# ── Excel export (Reports sub-tab) ─────────────────────────────────────────
def _xlsx(export_type: str, granularity: str, rows: dict, window: tuple[int, int]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
    from openpyxl.utils import get_column_letter

    GREEN, GREEN_D, MINT, ALT = "0E7C66", "0A5B4B", "E8F5EF", "F4FAF7"
    TOTAL, INK, MUT, WHITE, RED = "D3EFE4", "1B2B24", "5B6E66", "FFFFFF", "C0392B"
    MONEY = '"₹"#,##0;[Red]"-₹"#,##0'
    thin = Side(style="thin", color="CBD9D2")
    BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
    L = Alignment(horizontal="left", vertical="center")
    C = Alignment(horizontal="center", vertical="center")
    Rt = Alignment(horizontal="right", vertical="center")

    t = _totals(rows)
    a, b = window
    span = f"{datetime.fromtimestamp(a/1000, IST):%d %b %Y, %H:%M} — {datetime.fromtimestamp(b/1000, IST):%d %b %Y, %H:%M}"
    generated = datetime.now(IST).strftime("%d %b %Y, %H:%M IST")
    series = _timeseries(rows, granularity)
    wb = Workbook()

    def band(ws, ncols, title, subtitle):
        last = get_column_letter(ncols)
        ws.merge_cells(f"A1:{last}1"); ws.merge_cells(f"A2:{last}2"); ws.merge_cells(f"A3:{last}3")
        ws["A1"] = "WhereIsMyMedicine — Finance"; ws["A1"].font = Font(bold=True, size=18, color=WHITE); ws["A1"].alignment = L
        ws["A2"] = title; ws["A2"].font = Font(bold=True, size=13, color=WHITE); ws["A2"].alignment = L
        ws["A3"] = f"{subtitle}    ·    {granularity}-wise    ·    Generated {generated}"
        ws["A3"].font = Font(italic=True, size=10, color=MUT); ws["A3"].alignment = L
        ws.row_dimensions[1].height = 32; ws.row_dimensions[2].height = 22; ws.row_dimensions[3].height = 18
        for c in range(1, ncols + 1):
            ws.cell(row=1, column=c).fill = PatternFill("solid", fgColor=GREEN)
            ws.cell(row=2, column=c).fill = PatternFill("solid", fgColor=GREEN_D)

    def header(ws, row, headers):
        for i, h in enumerate(headers, start=1):
            cell = ws.cell(row=row, column=i, value=h)
            cell.fill = PatternFill("solid", fgColor=GREEN); cell.font = Font(bold=True, color=WHITE, size=11)
            cell.alignment = C if i > 1 else L; cell.border = BORDER
        ws.row_dimensions[row].height = 24

    def widths(ws, ws_widths):
        for i, w in enumerate(ws_widths, start=1):
            ws.column_dimensions[get_column_letter(i)].width = w

    def big_table(ws, title, headers, body, total_row=None):
        n = len(headers)
        band(ws, n, title, span)
        hr = 5; header(ws, hr, headers); r = hr + 1
        for i, row in enumerate(body):
            for c, v in enumerate(row, start=1):
                cell = ws.cell(row=r, column=c, value=v); cell.border = BORDER
                cell.fill = PatternFill("solid", fgColor=ALT if i % 2 else WHITE)
                if c == 1:
                    cell.alignment = L; cell.font = Font(size=11, color=INK)
                else:
                    cell.number_format = MONEY; cell.alignment = Rt; cell.font = Font(size=11, color=INK)
            ws.row_dimensions[r].height = 19; r += 1
        if total_row:
            for c, v in enumerate(total_row, start=1):
                cell = ws.cell(row=r, column=c, value=v); cell.border = BORDER
                cell.fill = PatternFill("solid", fgColor=TOTAL); cell.font = Font(bold=True, color=INK, size=11)
                if c > 1:
                    cell.number_format = MONEY; cell.alignment = Rt
            ws.row_dimensions[r].height = 22; r += 1
        widths(ws, [20] + [16] * (n - 1))
        ws.sheet_view.showGridLines = False; ws.freeze_panes = f"A{hr + 1}"
        if body:
            ws.auto_filter.ref = f"A{hr}:{get_column_letter(n)}{hr + len(body)}"

    def period_table(cols):
        headers = ["Period"] + [h for h, _ in cols]
        body = [[d["bucket"]] + [d[k] for _, k in cols] for d in series]
        totals = ["Total"] + [sum(d[k] for d in series) for _, k in cols]
        return headers, body, totals

    def card(ws, r, c, label, value, color=INK):
        cl, cr = get_column_letter(c), get_column_letter(c + 1)
        ws.merge_cells(f"{cl}{r}:{cr}{r}"); ws.merge_cells(f"{cl}{r+1}:{cr}{r+1}")
        lab = ws[f"{cl}{r}"]; val = ws[f"{cl}{r+1}"]
        lab.value = label; lab.font = Font(size=10, color=MUT, bold=True); lab.alignment = L
        val.value = value; val.number_format = MONEY; val.font = Font(size=16, bold=True, color=color); val.alignment = L
        for rr in (r, r + 1):
            for cc in (c, c + 1):
                cell = ws.cell(row=rr, column=cc); cell.fill = PatternFill("solid", fgColor=MINT); cell.border = BORDER
        ws.row_dimensions[r].height = 18; ws.row_dimensions[r + 1].height = 26

    def overview(ws):
        band(ws, 6, "Finance Overview", span)
        cards = [("Revenue", t["revenue"], GREEN), ("Order GMV", t["gmv"], INK),
                 ("Delivery collected", t["delivery"], INK),
                 ("Net profit", t["profit"], GREEN if t["profit"] >= 0 else RED),
                 ("Refunds", t["refunds"], RED), ("GST (18%)", t["gst"], INK),
                 ("Gateway fees", t["gatewayFees"], INK), ("Total expenses", t["expenses"], RED),
                 ("Taxable value", t["taxableValue"], INK)]
        base = 5
        for idx, (label, value, color) in enumerate(cards):
            card(ws, base + (idx // 3) * 3, 1 + (idx % 3) * 2, label, value, color)
        cr = base + 9; ws.merge_cells(f"A{cr}:F{cr}")
        ws[f"A{cr}"] = (f"Subscriptions: {t['subscriptionCount']}     ·     Paid orders: {t['paidOrderCount']}"
                        f"     ·     Refunds: {t['refundCount']}     ·     Currency: INR")
        ws[f"A{cr}"].font = Font(size=10, color=MUT)
        widths(ws, [18, 14, 18, 14, 18, 14]); ws.sheet_view.showGridLines = False

    def tx_sheet(ws):
        allrows = []
        for s in rows["subs"]:
            allrows.append((int(s.get("createdAtMillis", 0) or 0), "Subscription", "IN", s.get("pharmacyPhone", ""), int(s.get("amountRupees") or 0), s.get("paymentId", "")))
        for o in rows["orders"]:
            allrows.append((int(o.get("createdAtMillis", 0) or 0), "Order", "IN", o.get("pharmacyName") or o.get("pharmacyPhone", ""), int(o.get("totalAmount") or 0), o.get("paymentId", "")))
        for rf in rows["refunds"]:
            allrows.append((int(rf.get("createdAtMillis", 0) or 0), "Refund", "OUT", rf.get("orderId", ""), int(rf.get("amount") or 0), rf.get("gatewayRef", "")))
        allrows.sort(key=lambda x: x[0], reverse=True)
        band(ws, 6, "Transaction Ledger", span)
        hr = 5; header(ws, hr, ["Date & time", "Type", "Flow", "Party", "Amount", "Reference"]); r = hr + 1
        for i, (at, ty, di, party, amt, ref) in enumerate(allrows):
            vals = [datetime.fromtimestamp(at / 1000, IST).strftime("%Y-%m-%d %H:%M"), ty, di, party, amt, ref]
            for c, v in enumerate(vals, start=1):
                cell = ws.cell(row=r, column=c, value=v); cell.border = BORDER
                cell.fill = PatternFill("solid", fgColor=ALT if i % 2 else WHITE)
                if c == 5:
                    cell.number_format = MONEY; cell.alignment = Rt
                elif c == 3:
                    cell.font = Font(bold=True, color=(RED if di == "OUT" else GREEN)); cell.alignment = C
            ws.row_dimensions[r].height = 18; r += 1
        widths(ws, [20, 15, 9, 30, 16, 28]); ws.sheet_view.showGridLines = False; ws.freeze_panes = f"A{hr + 1}"
        if allrows:
            ws.auto_filter.ref = f"A{hr}:F{hr + len(allrows)}"

    SPECS = {
        "budget": ("Budget & Cash Flow — by " + granularity,
                   [("Revenue", "revenue"), ("GMV", "gmv"), ("Delivery", "delivery"),
                    ("Refunds", "refunds"), ("Gateway", "gateway"), ("Expenses", "expenses"), ("Profit", "profit")]),
        "profit": ("Profit — by " + granularity,
                   [("Revenue", "revenue"), ("Refunds", "refunds"), ("Gateway", "gateway"), ("Net Profit", "profit")]),
        "loss": ("Loss — by " + granularity,
                 [("Refunds", "refunds"), ("Gateway", "gateway"), ("Total Outflow", "expenses"), ("Net (neg=loss)", "profit")]),
        "tax": ("Tax — by " + granularity,
                [("Gross Revenue", "revenue"), ("Taxable Value", "taxable"), ("GST (18%)", "gst")]),
        "gst": ("GST — by " + granularity,
                [("Gross Revenue", "revenue"), ("Taxable Value", "taxable"), ("GST Collected", "gst")]),
    }

    ov = wb.active; ov.title = "Overview"; overview(ov)
    et = export_type

    if et == "all":
        h, body, tot = period_table([("Revenue", "revenue"), ("GMV", "gmv"), ("Delivery", "delivery"),
                                      ("Refunds", "refunds"), ("Gateway", "gateway"), ("GST", "gst"),
                                      ("Expenses", "expenses"), ("Profit", "profit")])
        big_table(wb.create_sheet("All — By " + granularity.capitalize()), "Full P&L by " + granularity, h, body, tot)
        for key in ("profit", "loss", "tax", "gst"):
            title, cols = SPECS[key]; h, body, tot = period_table(cols)
            big_table(wb.create_sheet(key.capitalize()), title, h, body, tot)
        tx_sheet(wb.create_sheet("Transactions"))
    else:
        title, cols = SPECS.get(et, SPECS["budget"])
        h, body, tot = period_table(cols)
        big_table(wb.create_sheet(et.capitalize()), title, h, body, tot)
        tx_sheet(wb.create_sheet("Transactions"))

    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return buf.read()


@router.get("/export")
def export(type: str = "all", granularity: str = "month", period: Optional[str] = "fy",
           frm: Optional[int] = Query(None, alias="from"), to: Optional[int] = None,
           admin: CurrentAdmin = Depends(require_superadmin)):
    a, b = _parse_window(period, frm, to)
    data = _xlsx(type.lower(), granularity, _rows(a, b), (a, b))
    fname = f"wimm_{type}_{granularity}_{datetime.fromtimestamp(a/1000, IST):%Y%m%d}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
