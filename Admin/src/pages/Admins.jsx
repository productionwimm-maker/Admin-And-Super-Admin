import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { Loading, ErrorNote, Badge, fmtTime } from '../components/Helpers.jsx'

const EMPTY = { email: '', name: '', password: '', role: 'admin', regions: '' }

export default function Admins() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/api/admins').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  async function save() {
    setBusy(true); setErr('')
    const regions = edit.regions ? edit.regions.split(',').map((s) => s.trim()).filter(Boolean) : []
    try {
      if (edit.id) {
        const body = { name: edit.name, role: edit.role, regions, active: edit.active }
        if (edit.password) body.password = edit.password
        await api.put(`/api/admins/${edit.id}`, body)
      } else {
        await api.post('/api/admins', { email: edit.email, name: edit.name, password: edit.password, role: edit.role, regions })
      }
      setEdit(null); load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  async function remove(a) {
    if (!confirm(`Delete admin ${a.email}?`)) return
    try { await api.del(`/api/admins/${a.id}`); load() } catch (e) { setErr(e.message) }
  }

  if (err && !rows) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Admin Accounts</h1>
      <div className="toolbar">
        <p className="muted">Create admins, set their role &amp; region scope. Super Admin only.</p>
        <button className="primary" onClick={() => setEdit({ ...EMPTY })}>+ New admin</button>
      </div>
      <ErrorNote error={err} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Regions</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td><td>{a.email}</td>
                <td><Badge kind={a.role === 'superadmin' ? 'blue' : 'grey'}>{a.role}</Badge></td>
                <td>{(a.regions || []).join(', ') || 'All'}</td>
                <td>{a.active === false ? <Badge kind="red">Disabled</Badge> : <Badge kind="green">Active</Badge>}</td>
                <td className="muted">{fmtTime(a.createdAtMillis)}</td>
                <td>
                  <div className="row">
                    <button className="sm" onClick={() => setEdit({ ...a, regions: (a.regions || []).join(', '), password: '' })}>Edit</button>
                    <button className="sm red" onClick={() => remove(a)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <Modal title={edit.id ? `Edit ${edit.email}` : 'New admin'} onClose={() => setEdit(null)}>
          {!edit.id && (<><label>Email</label>
            <input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></>)}
          <label>Name</label>
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <label>Role</label>
          <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
          </select>
          <label>Regions (comma separated, blank = all)</label>
          <input value={edit.regions} onChange={(e) => setEdit({ ...edit, regions: e.target.value })} placeholder="West Bengal, Maharashtra" />
          <label>{edit.id ? 'New password (blank = keep)' : 'Password'}</label>
          <input type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
          {edit.id && (
            <label className="row" style={{ marginTop: 12 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={edit.active !== false}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active
            </label>
          )}
          <ErrorNote error={err} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" disabled={busy || !edit.name || (!edit.id && (!edit.email || !edit.password))} onClick={save}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
