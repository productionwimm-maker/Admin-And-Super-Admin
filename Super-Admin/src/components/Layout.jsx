import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { appConfig } from '../appConfig.js'

// Nav items: cap = capability required to see the link (null = any signed-in admin).
const NAV = [
  { section: 'Operations' },
  { to: '/', label: 'Overview', cap: 'view_analytics', end: true },
  { to: '/approvals', label: 'Signup Approvals', cap: 'review_signups' },
  { to: '/pharmacies', label: 'Pharmacies', cap: 'view_pharmacies' },
  { to: '/orders', label: 'Orders & Delivery', cap: 'view_orders' },
  { to: '/customers', label: 'Customers', cap: 'view_customers' },
  { to: '/complaints', label: 'Complaints', cap: 'view_complaints' },
  { section: 'Money' },
  { to: '/refunds', label: 'Refunds', cap: 'issue_refund' },
  { to: '/salesmen', label: 'Salesmen & Referrals', cap: 'view_salesmen' },
  { to: '/payouts', label: 'Payouts & Earnings', cap: 'view_payouts' },
  { section: 'Platform' },
  { to: '/analytics', label: 'Analytics', cap: 'view_analytics' },
  { to: '/catalog', label: 'Medicine Catalog', cap: 'edit_catalog' },
  { to: '/notifications', label: 'Broadcasts', cap: 'broadcast_draft' },
  { to: '/admins', label: 'Admin Accounts', cap: 'manage_admins' },
  { to: '/settings', label: 'Feature Flags', cap: 'feature_flags' },
  { to: '/update', label: 'App Update', cap: null },
  { to: '/poster', label: 'Poster', cap: null },
  { to: '/coverage', label: 'Service Coverage', cap: 'feature_flags' },
  { to: '/audit', label: 'Audit Log', cap: 'view_own_audit' },
]

export default function Layout() {
  const { user, logout, can } = useAuth()
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">WIMM</span> WhereIsMyMedicine
          <small>{appConfig.appName}</small>
        </div>
        <nav className="nav">
          {NAV.map((item, i) => {
            if (item.section) return <div key={i} className="section">{item.section}</div>
            if (item.cap && !can(item.cap)) return null
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>
      <div className="content">
        <div className="topbar">
          <div />
          <div className="row">
            <span className="muted">{user?.name}</span>
            <span className="role-pill">{user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}</span>
            <button className="sm" onClick={logout}>Log out</button>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
