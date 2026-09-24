import { createContext, useContext, useEffect, useState } from 'react'
import { api, setToken } from './api.js'
import { appConfig } from './appConfig.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)     // { email, name, role, capabilities }
  const [loading, setLoading] = useState(true)

  // On load, only accept a session whose role matches this portal.
  useEffect(() => {
    api.get('/api/auth/me')
      .then((me) => {
        if (me.role === appConfig.requiredRole) setUser(me)
        else { setToken(null); setUser(null) }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const res = await api.post('/api/auth/login', { email, password })
    setToken(res.access_token)
    const me = await api.get('/api/auth/me')
    // Enforce the portal's role: admin creds only work in the Admin portal,
    // super-admin creds only in the Super Admin portal.
    if (me.role !== appConfig.requiredRole) {
      setToken(null)
      setUser(null)
      const other = appConfig.requiredRole === 'admin' ? 'Super Admin' : 'Admin'
      throw new Error(`Those are ${other} credentials. Please use the ${other} portal.`)
    }
    setUser(me)
    return me
  }

  function logout() {
    setToken(null)
    setUser(null)
    window.location.href = '/login'
  }

  const can = (cap) => !!user && user.capabilities.includes(cap)
  const isSuper = !!user && user.role === 'superadmin'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, isSuper }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
