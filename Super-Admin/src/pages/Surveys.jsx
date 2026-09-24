import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote } from '../components/Helpers.jsx'

export default function Surveys() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'yes' | 'no'

  useEffect(() => {
    api.get('/api/surveys/inventory').then(setRows).catch((e) => setErr(e.message))
  }, [])

  if (err && !rows) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  const yesCount = rows.filter((r) => r.interested).length
  const noCount = rows.length - yesCount

  const filtered = rows.filter((r) => {
    if (filter === 'yes') return r.interested
    if (filter === 'no') return !r.interested
    return true
  })

  function fmt(ts) {
    if (!ts) return '—'
    // Firestore Timestamp comes as { _seconds, _nanoseconds } or ISO string
    const ms = ts._seconds ? ts._seconds * 1000 : new Date(ts).getTime()
    if (!ms) return '—'
    return new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div className="page">
      <h1>Survey Responses</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Pharmacies who answered the <strong>Inventory Management</strong> interest survey in the app.
      </p>

      <div className="toolbar" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={filter === 'all' ? 'primary sm' : 'sm'} onClick={() => setFilter('all')}>
            All ({rows.length})
          </button>
          <button className={filter === 'yes' ? 'primary sm' : 'sm'} onClick={() => setFilter('yes')}>
            ✅ Interested ({yesCount})
          </button>
          <button className={filter === 'no' ? 'primary sm' : 'sm'} onClick={() => setFilter('no')}>
            ❌ Not interested ({noCount})
          </button>
        </div>
      </div>

      <ErrorNote error={err} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pharmacy</th>
              <th>Owner</th>
              <th>Phone</th>
              <th>Response</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>No responses yet.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.phone || r.id}>
                <td>{r.pharmacyName || '—'}</td>
                <td>{r.ownerName || '—'}</td>
                <td>{r.phone || r.id}</td>
                <td>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    background: r.interested ? '#e6f9ee' : '#fdecea',
                    color: r.interested ? '#1a7f4b' : '#c0392b',
                  }}>
                    {r.interested ? 'Yes, I need it' : 'No thanks'}
                  </span>
                </td>
                <td className="muted">{fmt(r.respondedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
