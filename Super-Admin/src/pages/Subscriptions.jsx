import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote } from '../components/Helpers.jsx'

// Pharmacy subscriptions — set the amount pharmacies pay, and see who's active
// right now. Super Admin only.
export default function Subscriptions() {
  const [plans, setPlans] = useState(null)
  const [active, setActive] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('30')

  function load() {
    api.get('/api/subscriptions/plans').then(setPlans).catch((e) => setErr(e.message))
    api.get('/api/subscriptions/active').then(setActive).catch(() => {})
  }
  useEffect(load, [])

  async function createPlan() {
    setErr(''); setMsg('')
    try {
      await api.post('/api/subscriptions/plans', {
        name, priceRupees: parseInt(price || '0', 10),
        durationDays: parseInt(days || '30', 10), active: true,
      })
      setName(''); setPrice(''); setDays('30'); setMsg('Plan created.'); load()
    } catch (e) { setErr(e.message) }
  }
  async function deactivate(id) { try { await api.del('/api/subscriptions/plans/' + id); load() } catch (e) { setErr(e.message) } }
  async function grant() {
    const phone = prompt('Pharmacy account id (e.g. +9198XXXXXXXX):'); if (!phone) return
    const d = prompt('Days to grant/extend:', '30'); if (!d) return
    try {
      await api.post('/api/subscriptions/pharmacy/' + encodeURIComponent(phone) + '/grant', { days: parseInt(d, 10) })
      setMsg('Subscription granted.'); load()
    } catch (e) { setErr(e.message) }
  }

  if (err && !plans) return <div className="page"><ErrorNote error={err} /></div>
  if (!plans) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Subscriptions</h1>
      <p className="muted">Set the amount pharmacies pay to stay active. Super Admin only.</p>
      {msg && <p className="muted">{msg}</p>}
      {err && <ErrorNote error={err} />}

      <h3>Plans</h3>
      <table className="table">
        <thead><tr><th>Name</th><th>Price (₹)</th><th>Days</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td><td>{p.priceRupees}</td><td>{p.durationDays}</td>
              <td>{p.active === false ? 'No' : 'Yes'}</td>
              <td>{p.active !== false && <button className="sm" onClick={() => deactivate(p.id)}>Deactivate</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Create a plan</h3>
      <div className="row">
        <input placeholder="Name (e.g. Monthly)" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Price ₹" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input placeholder="Days" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
        <button onClick={createPlan} disabled={!name || !price}>Create plan</button>
      </div>

      <h3 style={{ marginTop: 24 }}>Active pharmacies right now {active ? `(${active.count})` : ''}</h3>
      <button className="sm" onClick={grant}>Grant / extend a pharmacy</button>
      <table className="table">
        <thead><tr><th>Account</th><th>Name</th><th>Plan</th><th>Ends</th><th>Source</th></tr></thead>
        <tbody>
          {(active?.pharmacies || []).map((p) => (
            <tr key={p.phone}>
              <td>{p.phone}</td><td>{p.name}</td><td>{p.plan || '-'}</td>
              <td>{p.endMillis ? new Date(p.endMillis).toLocaleDateString() : '-'}</td>
              <td>{p.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
