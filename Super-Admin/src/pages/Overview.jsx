import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { StatCard, fmtMoney, Loading, ErrorNote } from '../components/Helpers.jsx'

export default function Overview() {
  const [ov, setOv] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/api/analytics/overview').then(setOv).catch((e) => setErr(e.message))
  }, [])

  if (err) return <div className="page"><ErrorNote error={err} /></div>
  if (!ov) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Overview</h1>
      <p className="muted">Platform health at a glance.</p>
      <div className="cards" style={{ marginTop: 18 }}>
        <StatCard value={ov.pendingApprovals} label="Pending approvals" />
        <StatCard value={ov.totalPharmacies} label="Total pharmacies" />
        <StatCard value={ov.verifiedPharmacies} label="Verified pharmacies" />
        <StatCard value={ov.suspendedPharmacies} label="Suspended" />
        <StatCard value={ov.totalCustomers} label="Customers" />
        <StatCard value={ov.blockedCustomers} label="Blocked customers" />
        <StatCard value={ov.totalOrders} label="Total orders" />
        <StatCard value={ov.openOrders} label="Open orders" />
        <StatCard value={fmtMoney(ov.gmv)} label="Paid GMV" />
        <StatCard value={ov.totalReservations ?? 0} label="Reservations" />
        <StatCard value={ov.verifiedAppCustomers ?? 0} label="Verified app customers" />
      </div>
      <div className="panel">
        <h3>Quick actions</h3>
        <div className="row" style={{ marginTop: 10 }}>
          <Link to="/approvals"><button>Review signups ({ov.pendingApprovals})</button></Link>
          <Link to="/orders"><button>Open orders ({ov.openOrders})</button></Link>
          <Link to="/analytics"><button>Analytics</button></Link>
        </div>
      </div>
    </div>
  )
}
