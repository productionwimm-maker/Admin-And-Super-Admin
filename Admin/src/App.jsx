import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Layout from './components/Layout.jsx'
import { Loading } from './components/Helpers.jsx'

import Login from './pages/Login.jsx'
import Overview from './pages/Overview.jsx'
import Approvals from './pages/Approvals.jsx'
import Pharmacies from './pages/Pharmacies.jsx'
import Orders from './pages/Orders.jsx'
import Customers from './pages/Customers.jsx'
import Complaints from './pages/Complaints.jsx'
import Refunds from './pages/Refunds.jsx'
import Salesmen from './pages/Salesmen.jsx'
import Payouts from './pages/Payouts.jsx'
import Analytics from './pages/Analytics.jsx'
import Catalog from './pages/Catalog.jsx'
import Notifications from './pages/Notifications.jsx'
import Admins from './pages/Admins.jsx'
import Settings from './pages/Settings.jsx'
import AuditLog from './pages/AuditLog.jsx'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page"><Loading /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Overview />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="pharmacies" element={<Pharmacies />} />
        <Route path="orders" element={<Orders />} />
        <Route path="customers" element={<Customers />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="refunds" element={<Refunds />} />
        <Route path="salesmen" element={<Salesmen />} />
        <Route path="payouts" element={<Payouts />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admins" element={<Admins />} />
        <Route path="settings" element={<Settings />} />
        <Route path="audit" element={<AuditLog />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
