import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote } from '../components/Helpers.jsx'

// Live App Settings — the app applies these instantly, no rebuild. Super Admin only.
export default function AppSettings() {
  const [s, setS] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.get('/api/config/settings').then(setS).catch((e) => setErr(e.message)) }, [])

  async function save() {
    setBusy(true); setErr(''); setMsg('')
    try {
      await api.put('/api/config/settings', { settings: s })
      setMsg('Saved. The app applies it live.')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (err && !s) return <div className="page"><ErrorNote error={err} /></div>
  if (!s) return <div className="page"><Loading /></div>

  const m = s.maintenance || {}, d = s.delivery || {}, a = s.announcement || {}
  const num = (v) => parseInt(v || '0', 10)

  return (
    <div className="page">
      <h1>App Settings</h1>
      <p className="muted">Edit the live app — applied instantly, no update needed. Super Admin only.</p>
      {msg && <p className="muted">{msg}</p>}
      {err && <ErrorNote error={err} />}

      <h3>Maintenance mode</h3>
      <label>
        <input type="checkbox" checked={!!m.enabled}
          onChange={(e) => setS({ ...s, maintenance: { ...m, enabled: e.target.checked } })} /> Enabled (blocks the app)
      </label>
      <input placeholder="Message shown to users" value={m.message || ''}
        onChange={(e) => setS({ ...s, maintenance: { ...m, message: e.target.value } })}
        style={{ display: 'block', width: '100%', marginTop: 8 }} />

      <h3>Delivery fee</h3>
      <div className="row">
        <label>Base ₹ <input type="number" value={d.baseFareRupees ?? ''}
          onChange={(e) => setS({ ...s, delivery: { ...d, baseFareRupees: num(e.target.value) } })} /></label>
        <label>Per km ₹ <input type="number" value={d.perKmRupees ?? ''}
          onChange={(e) => setS({ ...s, delivery: { ...d, perKmRupees: num(e.target.value) } })} /></label>
        <label>Free above ₹ <input type="number" value={d.freeAboveRupees ?? ''}
          onChange={(e) => setS({ ...s, delivery: { ...d, freeAboveRupees: num(e.target.value) } })} /></label>
      </div>

      <h3>Operating rules</h3>
      <div className="row">
        <label>Service radius (km) <input type="number" value={s.serviceRadiusKm ?? ''}
          onChange={(e) => setS({ ...s, serviceRadiusKm: num(e.target.value) })} /></label>
        <label>Min order ₹ <input type="number" value={s.minOrderRupees ?? ''}
          onChange={(e) => setS({ ...s, minOrderRupees: num(e.target.value) })} /></label>
      </div>

      <h3>Announcement banner</h3>
      <label>
        <input type="checkbox" checked={!!a.enabled}
          onChange={(e) => setS({ ...s, announcement: { ...a, enabled: e.target.checked } })} /> Show banner
      </label>
      <input placeholder="Banner text" value={a.text || ''}
        onChange={(e) => setS({ ...s, announcement: { ...a, text: e.target.value } })}
        style={{ display: 'block', width: '100%', marginTop: 8 }} />

      <div style={{ marginTop: 20 }}>
        <button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </div>
    </div>
  )
}
