import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Loading, ErrorNote, fmtMoney, StatCard } from '../components/Helpers.jsx'

export default function Analytics() {
  const { isSuper } = useAuth()
  const [demand, setDemand] = useState(null)
  const [ful, setFul] = useState(null)
  const [rev, setRev] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/api/analytics/demand').then(setDemand).catch((e) => setErr(e.message))
    api.get('/api/analytics/fulfillment').then(setFul).catch(() => {})
    if (isSuper) api.get('/api/revenue').then(setRev).catch(() => {})
  }, [isSuper])

  if (err) return <div className="page"><ErrorNote error={err} /></div>
  if (!demand || !ful) return <div className="page"><Loading /></div>

  const maxMed = Math.max(1, ...demand.topMedicines.map((m) => m.count))

  return (
    <div className="page">
      <h1>Analytics</h1>

      {rev && (
        <>
          <h3 style={{ marginTop: 10 }}>Platform revenue (Super Admin)</h3>
          <div className="cards">
            <StatCard value={fmtMoney(rev.gmv)} label="GMV (paid)" />
            <StatCard value={fmtMoney(rev.refundedAmount)} label="Refunded" />
            <StatCard value={fmtMoney(rev.netRevenue)} label="Net revenue" />
            <StatCard value={`${rev.paidOrders}/${rev.totalOrders}`} label="Paid / total orders" />
          </div>
        </>
      )}

      <div className="cards">
        <StatCard value={`${ful.fulfillmentRate}%`} label="Fulfillment rate" />
        <StatCard value={ful.totalOrders} label="Total orders" />
      </div>

      <div className="panel">
        <h3>Top requested medicines</h3>
        <div className="bars" style={{ marginTop: 12 }}>
          {demand.topMedicines.length === 0 && <span className="muted">No data.</span>}
          {demand.topMedicines.map((m) => (
            <div key={m.name} className="bar-row">
              <span>{m.name}</span>
              <div className="bar"><span style={{ width: `${(m.count / maxMed) * 100}%` }} /></div>
              <span>{m.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Coverage by state (gap analysis)</h3>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>State</th><th>Pharmacies</th><th>Verified</th><th>Gap</th></tr></thead>
            <tbody>
              {demand.coverageByState.map((c) => (
                <tr key={c.state}>
                  <td>{c.state}</td><td>{c.pharmacies}</td><td>{c.verified}</td>
                  <td className={c.verified === 0 ? 'err' : 'muted'}>{c.pharmacies - c.verified} unverified</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
