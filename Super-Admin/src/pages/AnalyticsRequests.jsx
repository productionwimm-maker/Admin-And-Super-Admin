import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Loading, ErrorNote, Badge } from '../components/Helpers.jsx'

/* Gated analytics access. Admin OR super-admin can approve/revoke a pharmacy's
 * request to view analytics. Only a SUPER-ADMIN can change the monthly unlock
 * date (mode + custom day); shorter months fall back to month-end in the app. */
const MODES = [
  { v: 'joinDay', label: 'Join day' },
  { v: 'monthStart', label: 'Month start' },
  { v: 'monthEnd', label: 'Month end' },
  { v: 'custom', label: 'Custom day' },
]

export default function AnalyticsRequests() {
  const { isSuper } = useAuth()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('pending')
  const [busy, setBusy] = useState('')
  const [editDate, setEditDate] = useState(null) // { uid, dateMode, customDay }

  const load = () => api.get(`/api/analytics-access?status=${tab}`).then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { setRows(null); load() /* eslint-disable-next-line */ }, [tab])

  async function act(uid, action) {
    setBusy(uid)
    try { await api.post(`/api/analytics-access/${uid}/${action}`, {}); load() }
    catch (e) { setErr(e.message) } finally { setBusy('') }
  }

  async function saveDate() {
    if (!editDate) return
    setBusy(editDate.uid)
    try {
      await api.post(`/api/analytics-access/${editDate.uid}/date`, {
        dateMode: editDate.dateMode, customDay: Number(editDate.customDay) || 1,
      })
      setEditDate(null); load()
    } catch (e) { setErr(e.message) } finally { setBusy('') }
  }

  if (!rows) return <div className="page">{err ? <ErrorNote error={err} /> : <Loading />}</div>

  return (
    <div className="page">
      <h1>Analytics Access</h1>
      <p className="muted">Approve a pharmacy to view its analytics (24-hour window, reopens monthly). Super-admin can set the monthly unlock date.</p>
      <div className="row" style={{ gap: 8, margin: '12px 0 18px' }}>
        {['pending', 'approved'].map((t) => (
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
              <th>Pharmacy</th><th>Reason</th><th>Status</th><th>Unlock date</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.pharmacyName || r.pharmacyPhone || r.id}<div className="muted">{r.pharmacyPhone}</div></td>
                  <td style={{ maxWidth: 260, whiteSpace: 'normal' }}>{r.reason}</td>
                  <td>{r.approved ? <Badge kind="green">Approved</Badge> : <Badge kind="amber">Pending</Badge>}</td>
                  <td>
                    {(MODES.find((m) => m.v === (r.dateMode || 'joinDay'))?.label) || 'Join day'}
                    {r.dateMode === 'custom' ? ` (${r.customDay || 1})` : ''}
                  </td>
                  <td>
                    <div className="row">
                      {!r.approved
                        ? <button className="sm" disabled={busy === r.id} onClick={() => act(r.id, 'approve')}>Approve</button>
                        : <button className="sm" disabled={busy === r.id} onClick={() => act(r.id, 'revoke')}>Revoke</button>}
                      {isSuper && (
                        <button className="sm" onClick={() => setEditDate({ uid: r.id, dateMode: r.dateMode || 'joinDay', customDay: r.customDay || 1 })}>
                          Set date
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editDate && (
        <div className="modal-backdrop" onClick={() => setEditDate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Monthly analytics date</h3>
            <p className="muted">Shorter months (Feb/Apr…) fall back to month-end automatically.</p>
            <label>Mode</label>
            <select value={editDate.dateMode} onChange={(e) => setEditDate({ ...editDate, dateMode: e.target.value })}>
              {MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
            {editDate.dateMode === 'custom' && (
              <>
                <label>Day of month (1–31)</label>
                <input type="number" min="1" max="31" value={editDate.customDay}
                  onChange={(e) => setEditDate({ ...editDate, customDay: e.target.value })} />
              </>
            )}
            <div className="row" style={{ marginTop: 14 }}>
              <button className="primary" disabled={busy === editDate.uid} onClick={saveDate}>Save</button>
              <button onClick={() => setEditDate(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
