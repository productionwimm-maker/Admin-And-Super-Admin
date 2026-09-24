import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Loading, ErrorNote, fmtTime, Badge } from '../components/Helpers.jsx'

export default function AuditLog() {
  const { isSuper } = useAuth()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.get('/api/audit').then(setRows).catch((e) => setErr(e.message)) }, [])

  if (err) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Audit Log</h1>
      <p className="muted">{isSuper ? 'All admin actions across the platform.' : 'Your own actions.'}</p>
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead><tr><th>When</th><th>Actor</th><th>Role</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="muted">No actions logged yet.</td></tr>}
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="muted">{fmtTime(a.timestampMillis)}</td>
                <td>{a.actorEmail}</td>
                <td><Badge kind={a.actorRole === 'superadmin' ? 'blue' : 'grey'}>{a.actorRole}</Badge></td>
                <td>{a.action}</td>
                <td>{a.target || '—'}</td>
                <td className="muted">{a.details && Object.keys(a.details).length ? JSON.stringify(a.details) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
