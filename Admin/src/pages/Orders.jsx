import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Modal from '../components/Modal.jsx'
import { Loading, ErrorNote, OrderStatusBadge, fmtMoney, fmtTime, Badge } from '../components/Helpers.jsx'

const STATUSES = ['', 'PLACED', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED']

export default function Orders() {
  const { can } = useAuth()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [status, setStatus] = useState('')
  const [active, setActive] = useState(null)
  const [chat, setChat] = useState(null)
  const [refunding, setRefunding] = useState(false)
  const [refund, setRefund] = useState({ amount: 0, reason: '' })
  const [busy, setBusy] = useState(false)

  const load = () => api.get(`/api/orders${status ? `?status=${status}` : ''}`)
    .then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [status])

  async function openOrder(o) {
    setActive(o); setChat(null); setRefunding(false); setRefund({ amount: o.totalAmount, reason: '' })
    if (can('resolve_disputes')) {
      try { setChat(await api.get(`/api/orders/${o.id}/chat`)) } catch { /* ignore */ }
    }
  }
  async function doRefund() {
    setBusy(true); setErr('')
    try {
      await api.post(`/api/orders/${active.id}/refund`, refund)
      setActive(null); load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (err && !rows) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Orders &amp; Delivery</h1>
      <div className="toolbar">
        <div className="row">
          <span className="muted">Status</span>
          <select style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All'}</option>)}
          </select>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Pharmacy</th><th>Items</th><th>Amount</th><th>Delivery</th><th>Status</th><th>Payment</th><th>When</th></tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => openOrder(o)}>
                <td>{o.id}</td>
                <td>{o.customerName}<div className="muted">{o.customerPhone}</div></td>
                <td>{o.pharmacyName}</td>
                <td style={{ maxWidth: 220 }}>{o.itemsSummary}</td>
                <td>{fmtMoney(o.totalAmount)}</td>
                <td>{o.homeDelivery ? 'Home' : 'Pickup'}</td>
                <td><OrderStatusBadge status={o.status} /></td>
                <td><Badge kind={o.paymentStatus === 'PAID' ? 'green' : o.paymentStatus === 'REFUNDED' ? 'amber' : 'grey'}>{o.paymentStatus}</Badge></td>
                <td className="muted">{fmtTime(o.createdAtMillis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active && (
        <Modal title={`Order ${active.id}`} wide onClose={() => setActive(null)}>
          <div className="kv">
            <div>Customer</div><div>{active.customerName} ({active.customerPhone})</div>
            <div>Pharmacy</div><div>{active.pharmacyName} ({active.pharmacyPhone})</div>
            <div>Items</div><div>{active.itemsSummary}</div>
            <div>Amount</div><div>{fmtMoney(active.totalAmount)}</div>
            <div>Status</div><div><OrderStatusBadge status={active.status} /></div>
            <div>Payment</div><div>{active.paymentStatus} {active.paymentId && `· ${active.paymentId}`}</div>
            {active.deliveryCode && (<><div>Delivery code</div><div>{active.deliveryCode}</div></>)}
            {active.riderName && (<><div>Rider</div><div>{active.riderName} · {active.riderVehicle}</div></>)}
          </div>

          {chat && (
            <>
              <h3 style={{ marginTop: 16 }}>Dispute chat</h3>
              <div className="panel" style={{ maxHeight: 220, overflow: 'auto' }}>
                {chat.messages.length === 0 && <span className="muted">No messages.</span>}
                {chat.messages.map((m, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <Badge kind={m.senderRole === 'customer' ? 'blue' : 'green'}>{m.senderRole}</Badge>{' '}
                    {m.text} <span className="muted">· {fmtTime(m.timestampMillis)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {can('issue_refund') && active.paymentStatus === 'PAID' && (
            <div style={{ marginTop: 16 }}>
              {!refunding ? (
                <button className="red" onClick={() => setRefunding(true)}>Issue refund…</button>
              ) : (
                <>
                  <label>Refund amount (₹)</label>
                  <input type="number" value={refund.amount}
                    onChange={(e) => setRefund({ ...refund, amount: Number(e.target.value) })} />
                  <label>Reason</label>
                  <input value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} />
                  <ErrorNote error={err} />
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="red" disabled={busy || !refund.amount} onClick={doRefund}>Confirm refund</button>
                    <button onClick={() => setRefunding(false)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
