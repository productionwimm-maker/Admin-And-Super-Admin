import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Modal from '../components/Modal.jsx'
import { Loading, ErrorNote, fmtMoney, Badge } from '../components/Helpers.jsx'

const EMPTY = { name: '', saltName: '', category: '', mrp: 0, prescriptionRequired: false, active: true }

export default function Catalog() {
  const { isSuper } = useAuth()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(null)        // {id?, ...form}
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/api/catalog').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  async function save() {
    setBusy(true); setErr('')
    const body = { name: edit.name, saltName: edit.saltName, category: edit.category,
      mrp: Number(edit.mrp), prescriptionRequired: !!edit.prescriptionRequired, active: !!edit.active }
    try {
      if (edit.id) await api.put(`/api/catalog/${edit.id}`, body)
      else await api.post('/api/catalog', body)
      setEdit(null); load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  async function remove(id) {
    if (!confirm('Delete this catalog item?')) return
    try { await api.del(`/api/catalog/${id}`); load() } catch (e) { setErr(e.message) }
  }

  if (err && !rows) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Medicine Catalog</h1>
      <div className="toolbar">
        <p className="muted">Admins can add/edit. Only Super Admins can delete.</p>
        <button className="primary" onClick={() => setEdit({ ...EMPTY })}>+ Add medicine</button>
      </div>
      <ErrorNote error={err} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Salt</th><th>Category</th><th>MRP</th><th>Rx</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td><td>{m.saltName}</td><td>{m.category}</td><td>{fmtMoney(m.mrp)}</td>
                <td>{m.prescriptionRequired ? <Badge kind="amber">Rx</Badge> : '—'}</td>
                <td>{m.active ? <Badge kind="green">Active</Badge> : <Badge kind="grey">Hidden</Badge>}</td>
                <td>
                  <div className="row">
                    <button className="sm" onClick={() => setEdit({ ...m })}>Edit</button>
                    {isSuper && <button className="sm red" onClick={() => remove(m.id)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit medicine' : 'Add medicine'} onClose={() => setEdit(null)}>
          <label>Name</label>
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <label>Salt / composition</label>
          <input value={edit.saltName} onChange={(e) => setEdit({ ...edit, saltName: e.target.value })} />
          <label>Category</label>
          <input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
          <label>MRP (₹)</label>
          <input type="number" value={edit.mrp} onChange={(e) => setEdit({ ...edit, mrp: e.target.value })} />
          <label className="row" style={{ marginTop: 12 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={!!edit.prescriptionRequired}
              onChange={(e) => setEdit({ ...edit, prescriptionRequired: e.target.checked })} /> Prescription required
          </label>
          <label className="row">
            <input type="checkbox" style={{ width: 'auto' }} checked={!!edit.active}
              onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active (visible in app)
          </label>
          <ErrorNote error={err} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" disabled={busy || !edit.name} onClick={save}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
