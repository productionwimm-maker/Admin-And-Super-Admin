// Small shared presentational helpers used across pages.

export function StatCard({ value, label }) {
  return (
    <div className="card">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}

export function Badge({ kind, children }) {
  return <span className={`badge ${kind || 'grey'}`}>{children}</span>
}

export function fmtMoney(rupees) {
  return '₹' + Number(rupees || 0).toLocaleString('en-IN')
}

export function fmtTime(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

const ORDER_BADGE = {
  PLACED: 'amber', CONFIRMED: 'blue', OUT_FOR_DELIVERY: 'blue',
  DELIVERED: 'green', CANCELLED: 'red',
}
export function OrderStatusBadge({ status }) {
  return <Badge kind={ORDER_BADGE[status] || 'grey'}>{(status || '').replace(/_/g, ' ')}</Badge>
}

export function VerifyBadge({ acc }) {
  if (acc.suspended) return <Badge kind="red">Suspended</Badge>
  const s = acc.verificationStatus || 'pending'
  if (s === 'approved' || acc.verified) return <Badge kind="green">Verified</Badge>
  if (s === 'rejected') return <Badge kind="red">Rejected</Badge>
  return <Badge kind="amber">Pending</Badge>
}

export function Loading() {
  return <p className="muted">Loading…</p>
}

export function ErrorNote({ error }) {
  return error ? <p className="err">{String(error)}</p> : null
}
