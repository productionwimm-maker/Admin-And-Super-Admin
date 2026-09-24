import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Modal from '../components/Modal.jsx'
import { Loading, ErrorNote, Badge, OrderStatusBadge, fmtMoney, fmtTime } from '../components/Helpers.jsx'

export default function Customers() {
  const { can, isSuper } = useAuth()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/api/customers').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  async function open(phone) {
    try { setDetail(await api.get(`/api/customers/${phone}`)) } catch (e) { setErr(e.message) }
  }
  async function run(fn) {
    setBusy(true); setErr('')
    try { await fn(); setDetail(null); load() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (err && !rows) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  const filtered = rows.filter((r) => !q ||
    (r.name || '').toLowerCase().includes(q.toLowerCase()) || (r.phone || '').includes(q))

  return (
    <div className="page">
      <h1>Customers</h1>
      <div className="toolbar">
        <input style={{ maxWidth: 320 }} placeholder="Search name / phone"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Gender</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.phone}</td><td>{c.gender}</td>
                <td>{c.blocked ? <Badge kind="red">Blocked</Badge> : <Badge kind="green">Active</Badge>}</td>
                <td><button className="sm" onClick={() => open(c.id)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <Modal title={detail.profile.name} wide onClose={() => setDetail(null)}>
          <div className="kv">
            <div>Phone</div><div>{detail.profile.phone}</div>
            <div>DOB</div><div>{detail.profile.dob}</div>
            <div>Gender</div><div>{detail.profile.gender}</div>
            <div>Status</div><div>{detail.profile.blocked ? 'Blocked' : 'Active'}</div>
          </div>

          <h3 style={{ marginTop: 16 }}>Order history ({detail.orders.length})</h3>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <thead><tr><th>Order</th><th>Items</th><th>Amount</th><th>Status</th><th>When</th></tr></thead>
              <tbody>
                {detail.orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td><td>{o.itemsSummary}</td><td>{fmtMoney(o.totalAmount)}</td>
                    <td><OrderStatusBadge status={o.status} /></td>
                    <td className="muted">{fmtTime(o.createdAtMillis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ErrorNote error={err} />
          <div className="row" style={{ marginTop: 16 }}>
            {can('block_customer') && !detail.profile.blocked && (
              <button className="red" disabled={busy}
                onClick={() => run(() => api.post(`/api/customers/${detail.profile.id}/block`, { reason: 'Abuse' }))}>
                Block customer
              </button>
            )}
            {can('block_customer') && detail.profile.blocked && (
              <button className="green" disabled={busy}
                onClick={() => run(() => api.post(`/api/customers/${detail.profile.id}/unblock`))}>
                Unblock
              </button>
            )}
            {isSuper && (
              <button className="red" disabled={busy} onClick={() => {
                if (confirm('Permanently delete this customer account?'))
                  run(() => api.del(`/api/customers/${detail.profile.id}`))
              }}>Delete account</button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
