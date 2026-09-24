import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote, fmtMoney, fmtTime, Badge } from '../components/Helpers.jsx'

export default function Refunds() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.get('/api/refunds').then(setRows).catch((e) => setErr(e.message)) }, [])

  if (err) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Refunds</h1>
      <p className="muted">Issue refunds from the order detail screen. This is the ledger of all refunds.</p>
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead><tr><th>Order</th><th>Amount</th><th>Reason</th><th>Gateway</th><th>By</th><th>When</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="muted">No refunds yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.orderId}</td>
                <td>{fmtMoney(r.amount)}</td>
                <td>{r.reason || '—'}</td>
                <td><Badge kind={r.gatewayRef ? 'green' : 'grey'}>{r.gatewayStatus || 'recorded'}</Badge></td>
                <td>{r.issuedBy}</td>
                <td className="muted">{fmtTime(r.createdAtMillis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
