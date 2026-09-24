import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Modal from '../components/Modal.jsx'
import { Loading, ErrorNote, fmtMoney, Badge } from '../components/Helpers.jsx'

export default function Salesmen() {
  const { can } = useAuth()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ code: '', salesmanName: '', salesmanPhone: '', commissionRate: 5 })
  const [editRate, setEditRate] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/api/salesmen').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  async function run(fn) {
    setBusy(true); setErr('')
    try { await fn(); setCreating(false); setEditRate(null); load() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (err && !rows) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Salesmen &amp; Referrals</h1>
      <div className="toolbar">
        <p className="muted">Referral codes pharmacies enter at signup. Performance = pharmacies signed up &amp; their GMV.</p>
        {can('manage_referrals') && <button className="primary" onClick={() => setCreating(true)}>+ Issue referral code</button>}
      </div>
      <ErrorNote error={err} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Salesman</th><th>Phone</th><th>Commission</th><th>Pharmacies</th><th>GMV</th><th>Earned</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.code}>
                <td>{s.code}</td><td>{s.salesmanName}</td><td>{s.salesmanPhone}</td>
                <td>{s.commissionRate}%</td><td>{s.pharmaciesSignedUp}</td>
                <td>{fmtMoney(s.gmv)}</td><td>{fmtMoney(s.commissionEarned)}</td>
                <td>{s.active ? <Badge kind="green">Active</Badge> : <Badge kind="red">Revoked</Badge>}</td>
                <td>
                  <div className="row">
                    {can('set_commission') && <button className="sm" onClick={() => { setEditRate(s); setForm({ ...form, commissionRate: s.commissionRate }) }}>Rate</button>}
                    {can('manage_referrals') && s.active && <button className="sm red" onClick={() => run(() => api.post(`/api/referrals/${s.code}/revoke`))}>Revoke</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal title="Issue referral code" onClose={() => setCreating(false)}>
          <label>Code</label>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WIMMS-XX01" />
          <label>Salesman name</label>
          <input value={form.salesmanName} onChange={(e) => setForm({ ...form, salesmanName: e.target.value })} />
          <label>Phone</label>
          <input value={form.salesmanPhone} onChange={(e) => setForm({ ...form, salesmanPhone: e.target.value })} />
          <label>Commission %</label>
          <input type="number" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })} />
          <ErrorNote error={err} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" disabled={busy || !form.code || !form.salesmanName}
              onClick={() => run(() => api.post('/api/referrals', form))}>Create</button>
          </div>
        </Modal>
      )}

      {editRate && (
        <Modal title={`Commission — ${editRate.code}`} onClose={() => setEditRate(null)}>
          <label>Commission %</label>
          <input type="number" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" disabled={busy}
              onClick={() => run(() => api.put(`/api/referrals/${editRate.code}/commission`, { commissionRate: form.commissionRate }))}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
