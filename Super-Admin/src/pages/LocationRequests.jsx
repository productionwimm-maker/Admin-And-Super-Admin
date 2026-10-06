import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote, Badge } from '../components/Helpers.jsx'

/* Pharmacy location-change requests. Approving unlocks the pharmacy to edit its
 * location once (the app re-locks after it saves). */
export default function LocationRequests() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('pending')
  const [busy, setBusy] = useState('')

  const load = () => api.get(`/api/location-requests${tab ? `?status=${tab}` : ''}`).then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { setRows(null); load() }, [tab])

  async function act(id, action) {
    const note = action === 'reject' ? (prompt('Reason (optional):') || '') : ''
    setBusy(id)
    try { await api.post(`/api/location-requests/${id}/${action}`, { note }); load() }
    catch (e) { setErr(e.message) } finally { setBusy('') }
  }

  if (!rows) return <div className="page">{err ? <ErrorNote error={err} /> : <Loading />}</div>

  return (
    <div className="page">
      <h1>Location Change Requests</h1>
      <p className="muted">Approving unlocks the pharmacy to set a new location once; it re-locks after saving.</p>
      <div className="row" style={{ gap: 8, margin: '12px 0 18px' }}>
        {['pending', 'approved', 'rejected'].map((t) => (
          <button key={t} className={t === tab ? 'primary' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <ErrorNote error={err} />
      {rows.length === 0 ? <p className="muted">No {tab} requests.</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Pharmacy</th><th>Current</th><th>Reason</th><th>New address</th><th>Landmark</th><th>Contact</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.pharmacyName || r.pharmacyPhone}<div className="muted">{r.pharmacyPhone}</div></td>
                  <td>{r.currentLabel || '—'}</td>
                  <td style={{ maxWidth: 220, whiteSpace: 'normal' }}>{r.reason}</td>
                  <td style={{ maxWidth: 220, whiteSpace: 'normal' }}>{r.newAddress}</td>
                  <td>{r.landmark || '—'}</td>
                  <td>{r.contactPhone || '—'}</td>
                  <td>
                    {r.status === 'approved' ? <Badge kind="green">Approved</Badge>
                      : r.status === 'rejected' ? <Badge kind="grey">Rejected</Badge>
                      : <Badge kind="amber">Pending</Badge>}
                  </td>
                  <td>
                    {r.status === 'pending' && (
                      <div className="row">
                        <button className="sm" disabled={busy === r.id} onClick={() => act(r.id, 'approve')}>Approve</button>
                        <button className="sm red" disabled={busy === r.id} onClick={() => act(r.id, 'reject')}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
