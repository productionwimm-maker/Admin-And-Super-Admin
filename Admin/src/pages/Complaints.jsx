import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote, fmtTime, Badge, StatCard } from '../components/Helpers.jsx'

const ACTIONS = [
  'Warning issued', 'Refund customer', 'Temporarily suspend pharmacy', 'Remove pharmacy offer',
  'Asked pharmacy for explanation', 'Escalate to super-admin', 'Mark as false report',
  'Blacklist pharmacy', 'Adjust pharmacy rating', 'Contacted customer', 'Contacted pharmacy',
  'Issued apology credit', 'Flagged for follow-up', 'No action needed', 'Resolved',
]

const STATUS_BADGE = { OPEN: 'red', IN_REVIEW: 'amber', RESOLVED: 'green', DISMISSED: 'grey' }
const STATUS_LABEL = { OPEN: 'Open', IN_REVIEW: 'In review', RESOLVED: 'Resolved', DISMISSED: 'Dismissed' }

export default function Complaints() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState(null)
  const [form, setForm] = useState({ action: ACTIONS[0], status: 'IN_REVIEW', note: '' })
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/api/complaints').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  const openRow = (r) => {
    if (openId === r.id) { setOpenId(null); return }
    setOpenId(r.id)
    setForm({ action: r.adminAction || ACTIONS[0], status: r.status === 'OPEN' ? 'IN_REVIEW' : r.status, note: r.adminNote || '' })
  }

  const apply = async (id) => {
    setSaving(true)
    try {
      await api.post(`/api/complaints/${id}/action`, form)
      await load()
      setOpenId(null)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  if (err) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  const count = (s) => rows.filter((r) => r.status === s).length

  return (
    <div className="page">
      <h1>Complaints</h1>
      <p className="muted">Customer complaints against pharmacies. Take an action — the customer sees it under “My Complaints”.</p>

      <div className="cards" style={{ marginTop: 14 }}>
        <StatCard value={count('OPEN')} label="Open" />
        <StatCard value={count('IN_REVIEW')} label="In review" />
        <StatCard value={count('RESOLVED')} label="Resolved" />
        <StatCard value={rows.length} label="Total" />
      </div>

      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>Customer</th><th>Pharmacy</th><th>Problem</th><th>Status</th><th>When</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="muted">No complaints yet.</td></tr>}
            {rows.map((r) => (
              <>
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openRow(r)}>
                  <td>{r.customerName || r.customerPhone || '—'}</td>
                  <td>{r.pharmacyName || '—'}</td>
                  <td>{r.category}</td>
                  <td><Badge kind={STATUS_BADGE[r.status] || 'grey'}>{STATUS_LABEL[r.status] || r.status}</Badge></td>
                  <td className="muted">{fmtTime(r.createdAtMillis)}</td>
                  <td className="muted">{openId === r.id ? '▲' : '▼'}</td>
                </tr>
                {openId === r.id && (
                  <tr key={`${r.id}-x`}>
                    <td colSpan={6} style={{ background: 'rgba(15,157,85,0.04)' }}>
                      <div style={{ padding: '4px 4px 12px' }}>
                        {r.message && <p style={{ margin: '4px 0 12px' }}><strong>Details:</strong> {r.message}</p>}
                        {r.adminAction && (
                          <p className="muted" style={{ margin: '0 0 12px' }}>
                            Last action: <strong>{r.adminAction}</strong>{r.adminNote ? ` — ${r.adminNote}` : ''} ({r.actionByRole || 'admin'})
                          </p>
                        )}
                        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                            <span className="muted">Action</span>
                            <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                            <span className="muted">Status</span>
                            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                              <option value="IN_REVIEW">In review</option>
                              <option value="RESOLVED">Resolved</option>
                              <option value="DISMISSED">Dismissed</option>
                              <option value="OPEN">Re-open</option>
                            </select>
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, flex: 1, minWidth: 220 }}>
                            <span className="muted">Note to customer (optional)</span>
                            <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. We've warned the pharmacy." />
                          </label>
                          <button className="primary" disabled={saving} onClick={() => apply(r.id)}>
                            {saving ? 'Saving…' : 'Apply action'}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
