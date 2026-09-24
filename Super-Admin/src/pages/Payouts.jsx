import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Modal from '../components/Modal.jsx'
import { Loading, ErrorNote, fmtMoney, fmtTime, Badge } from '../components/Helpers.jsx'

export default function Payouts() {
  const { can } = useAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [pay, setPay] = useState(null)
  const [form, setForm] = useState({ amount: 0, note: '' })
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/api/payouts').then(setData).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  async function approve() {
    setBusy(true); setErr('')
    try {
      await api.post('/api/payouts/approve', { pharmacyPhone: pay.id, amount: form.amount, note: form.note })
      setPay(null); load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (err && !data) return <div className="page"><ErrorNote error={err} /></div>
  if (!data) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Payouts &amp; Earnings</h1>

      <h3 style={{ marginTop: 10 }}>Pharmacy earnings (Razorpay reconciliation)</h3>
      <div className="table-wrap" style={{ marginBottom: 22 }}>
        <table>
          <thead><tr><th>Pharmacy phone</th><th>Unclaimed</th><th>Redeemed</th><th></th></tr></thead>
          <tbody>
            {data.earnings.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td><td>{fmtMoney(e.unclaimedAmount)}</td><td>{fmtMoney(e.redeemedAmount)}</td>
                <td>{can('approve_payouts') && <button className="sm primary"
                  onClick={() => { setPay(e); setForm({ amount: e.unclaimedAmount, note: '' }) }}>Approve payout</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Payout history</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Pharmacy</th><th>Amount</th><th>Status</th><th>By</th><th>Note</th><th>When</th></tr></thead>
          <tbody>
            {data.payouts.length === 0 && <tr><td colSpan={6} className="muted">No payouts yet.</td></tr>}
            {data.payouts.map((p) => (
              <tr key={p.id}>
                <td>{p.pharmacyPhone}</td><td>{fmtMoney(p.amount)}</td>
                <td><Badge kind="green">{p.status}</Badge></td><td>{p.approvedBy}</td>
                <td>{p.note || '—'}</td><td className="muted">{fmtTime(p.createdAtMillis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pay && (
        <Modal title={`Approve payout — ${pay.id}`} onClose={() => setPay(null)}>
          <label>Amount (₹)</label>
          <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          <label>Note / UTR</label>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <ErrorNote error={err} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" disabled={busy || !form.amount} onClick={approve}>Approve</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
