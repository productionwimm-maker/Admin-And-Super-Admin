import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Loading, ErrorNote, fmtTime, Badge } from '../components/Helpers.jsx'

export default function Notifications() {
  const { can } = useAuth()
  const canSend = can('broadcast_send')
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ title: '', message: '', audience: 'customers', region: '' })
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/api/notifications').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  async function submit(send) {
    setBusy(true); setErr(''); setMsg('')
    try {
      await api.post('/api/notifications', { ...form, send })
      setMsg(send ? 'Broadcast sent.' : 'Draft saved.')
      setForm({ title: '', message: '', audience: 'customers', region: '' })
      load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (err && !rows) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Broadcasts</h1>
      <p className="muted">{canSend ? 'Send app-wide push notifications.' : 'You can draft regional broadcasts; a Super Admin sends them.'}</p>

      <div className="panel" style={{ maxWidth: 560 }}>
        <label>Title</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <label>Message</label>
        <textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <label>Audience</label>
        <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
          <option value="customers">Customers</option>
          <option value="pharmacies">Pharmacies</option>
          {canSend && <option value="all">Everyone</option>}
        </select>
        <label>Region (optional)</label>
        <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. West Bengal" />
        {err && <p className="err">{err}</p>}
        {msg && <p className="ok">{msg}</p>}
        <div className="row" style={{ marginTop: 14 }}>
          <button disabled={busy || !form.title} onClick={() => submit(false)}>Save draft</button>
          {canSend && <button className="primary" disabled={busy || !form.title || !form.message} onClick={() => submit(true)}>Send now</button>}
        </div>
      </div>

      <h3 style={{ marginTop: 20 }}>History</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Title</th><th>Audience</th><th>Region</th><th>Status</th><th>By</th><th>When</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="muted">Nothing yet.</td></tr>}
            {rows.map((b) => (
              <tr key={b.id}>
                <td>{b.title}</td><td>{b.audience}</td><td>{b.region || '—'}</td>
                <td><Badge kind={b.status === 'SENT' ? 'green' : 'grey'}>{b.status}</Badge></td>
                <td>{b.createdBy}</td><td className="muted">{fmtTime(b.createdAtMillis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
