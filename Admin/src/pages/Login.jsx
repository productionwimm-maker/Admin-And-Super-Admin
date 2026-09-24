import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { appConfig } from '../appConfig.js'

export default function Login() {
  const { login, user } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) { nav('/', { replace: true }) }

  async function submit(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      await login(email, password)
      nav('/', { replace: true })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="panel login-card" onSubmit={submit}>
        <div className="login-logo">WIMM</div>
        <h1>WhereIsMyMedicine</h1>
        <p className="muted">{appConfig.appName}</p>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoFocus
          placeholder={`${appConfig.portal}@whereismymedicine.com`} />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="err">{err}</p>}
        <button className="primary" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
