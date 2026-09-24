import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote } from '../components/Helpers.jsx'

const UNITS = ['minute', 'hour', 'day', 'week', 'month', 'year']

// Pharmacy subscriptions — set the amount + duration pharmacies pay, define
// roles/tiers (grandfather = free, normal = full, partners get a %), and see
// who's active right now. Super Admin only.
export default function Subscriptions() {
  const [plans, setPlans] = useState(null)
  const [roles, setRoles] = useState([])
  const [active, setActive] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  // new plan
  const [pName, setPName] = useState('')
  const [pPrice, setPPrice] = useState('')
  const [pValue, setPValue] = useState('1')
  const [pUnit, setPUnit] = useState('month')

  // new role
  const [rName, setRName] = useState('')
  const [rDiscount, setRDiscount] = useState('0')
  const [rExempt, setRExempt] = useState(false)

  function load() {
    api.get('/api/subscriptions/plans').then(setPlans).catch((e) => setErr(e.message))
    api.get('/api/subscriptions/roles').then(setRoles).catch(() => {})
    api.get('/api/subscriptions/active').then(setActive).catch(() => {})
  }
  useEffect(load, [])

  async function createPlan() {
    setErr(''); setMsg('')
    try {
      await api.post('/api/subscriptions/plans', {
        name: pName, priceRupees: parseInt(pPrice || '0', 10),
        durationValue: parseInt(pValue || '1', 10), durationUnit: pUnit, active: true,
      })
      setPName(''); setPPrice(''); setPValue('1'); setMsg('Plan created.'); load()
    } catch (e) { setErr(e.message) }
  }
  async function deactivate(id) { try { await api.del('/api/subscriptions/plans/' + id); load() } catch (e) { setErr(e.message) } }

  async function createRole() {
    setErr(''); setMsg('')
    try {
      await api.post('/api/subscriptions/roles', {
        name: rName, discountPct: rExempt ? 100 : parseInt(rDiscount || '0', 10), exempt: rExempt,
      })
      setRName(''); setRDiscount('0'); setRExempt(false); setMsg('Role saved.'); load()
    } catch (e) { setErr(e.message) }
  }
  async function deleteRole(id) { try { await api.del('/api/subscriptions/roles/' + id); load() } catch (e) { setErr(e.message) } }

  async function setRole(phone) {
    const role = prompt('Role id for ' + phone + ' (e.g. normal, grandfather, partner):', 'normal')
    if (!role) return
    try { await api.post('/api/subscriptions/pharmacy/' + encodeURIComponent(phone) + '/role', { role }); setMsg('Role set.'); load() } catch (e) { setErr(e.message) }
  }
  async function grant() {
    const phone = prompt('Pharmacy account id (e.g. +9198XXXXXXXX):'); if (!phone) return
    const d = prompt('Days to grant/extend:', '30'); if (!d) return
    try { await api.post('/api/subscriptions/pharmacy/' + encodeURIComponent(phone) + '/grant', { days: parseInt(d, 10) }); setMsg('Granted.'); load() } catch (e) { setErr(e.message) }
  }

  if (err && !plans) return <div className="page"><ErrorNote error={err} /></div>
  if (!plans) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Subscriptions</h1>
      <p className="muted">Set the amount + duration pharmacies pay, and their role/tier. Super Admin only.</p>
      {msg && <p className="muted">{msg}</p>}
      {err && <ErrorNote error={err} />}

      <h3>Plans</h3>
      <table className="table">
        <thead><tr><th>Name</th><th>Price (₹)</th><th>Duration</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td><td>{p.priceRupees}</td>
              <td>{p.durationValue ? `${p.durationValue} ${p.durationUnit}` : `${p.durationDays} day`}</td>
              <td>{p.active === false ? 'No' : 'Yes'}</td>
              <td>{p.active !== false && <button className="sm" onClick={() => deactivate(p.id)}>Deactivate</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <input placeholder="Name (e.g. Monthly)" value={pName} onChange={(e) => setPName(e.target.value)} />
        <input placeholder="Price ₹" type="number" value={pPrice} onChange={(e) => setPPrice(e.target.value)} />
        <input placeholder="Every" type="number" value={pValue} onChange={(e) => setPValue(e.target.value)} style={{ width: 80 }} />
        <select value={pUnit} onChange={(e) => setPUnit(e.target.value)}>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <button onClick={createPlan} disabled={!pName || !pPrice}>Create plan</button>
      </div>

      <h3 style={{ marginTop: 24 }}>Roles / tiers</h3>
      <p className="muted">A role gives a discount. Exempt = free (e.g. grandfather). Normal = pays full.</p>
      <table className="table">
        <thead><tr><th>Role</th><th>Discount %</th><th>Exempt (free)</th><th></th></tr></thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>{r.name} <span className="muted">({r.id})</span></td>
              <td>{r.exempt ? 100 : (r.discountPct || 0)}</td>
              <td>{r.exempt ? 'Yes' : 'No'}</td>
              <td><button className="sm" onClick={() => deleteRole(r.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <input placeholder="Role name (e.g. Partner)" value={rName} onChange={(e) => setRName(e.target.value)} />
        <input placeholder="Discount %" type="number" value={rDiscount} onChange={(e) => setRDiscount(e.target.value)} disabled={rExempt} style={{ width: 110 }} />
        <label><input type="checkbox" checked={rExempt} onChange={(e) => setRExempt(e.target.checked)} /> Exempt (free)</label>
        <button onClick={createRole} disabled={!rName}>Save role</button>
      </div>

      <h3 style={{ marginTop: 24 }}>Active pharmacies right now {active ? `(${active.count})` : ''}</h3>
      <button className="sm" onClick={grant}>Grant / extend a pharmacy</button>
      <table className="table">
        <thead><tr><th>Account</th><th>Name</th><th>Plan</th><th>Ends</th><th>Role</th><th>Source</th><th></th></tr></thead>
        <tbody>
          {(active?.pharmacies || []).map((p) => (
            <tr key={p.phone}>
              <td>{p.phone}</td><td>{p.name}</td><td>{p.plan || '-'}</td>
              <td>{p.endMillis ? new Date(p.endMillis).toLocaleDateString() : '-'}</td>
              <td>{p.role || 'normal'}</td><td>{p.source}</td>
              <td><button className="sm" onClick={() => setRole(p.phone)}>Set role</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
