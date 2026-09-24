import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote } from '../components/Helpers.jsx'

// Feature flags, "Coming soon" toggles and force-update — Super Admin only.
export default function Settings() {
  const [cfg, setCfg] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.get('/api/config/flags').then(setCfg).catch((e) => setErr(e.message)) }, [])

  function toggle(group, key) {
    setCfg({ ...cfg, [group]: { ...cfg[group], [key]: !cfg[group][key] } })
  }
  function addFlag(group) {
    const name = prompt('Flag key (camelCase):')
    if (name) setCfg({ ...cfg, [group]: { ...cfg[group], [name]: true } })
  }
  async function save() {
    setBusy(true); setErr(''); setMsg('')
    try {
      await api.put('/api/config/flags', {
        flags: cfg.flags || {}, comingSoon: cfg.comingSoon || {}, forceUpdate: cfg.forceUpdate || {},
      })
      setMsg('Saved. The app will pick these up on next config fetch.')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (err && !cfg) return <div className="page"><ErrorNote error={err} /></div>
  if (!cfg) return <div className="page"><Loading /></div>

  const fu = cfg.forceUpdate || {}
  const ad = cfg.appDiscount || {}

  return (
    <div className="page">
      <h1>Feature Flags</h1>
      <p className="muted">Toggle features, "Coming soon" sections and force-update. Super Admin only.</p>

      <FlagGroup title="Feature flags" group="flags" cfg={cfg} toggle={toggle} addFlag={addFlag} />
      <FlagGroup title='"Coming soon" toggles' group="comingSoon" cfg={cfg} toggle={toggle} addFlag={addFlag} />

      <div className="panel" style={{ maxWidth: 560 }}>
        <h3>App discount</h3>
        <p className="muted">
          The platform's discount cut carved out of each pharmacy's agreed discount.
          View-only — only a Super Admin can change this.
        </p>
        <label>Status</label>
        <input value={ad.enabled ? 'Enabled' : 'Disabled'} disabled />
        <label>Platform extra %</label>
        <input value={`${ad.platformExtraPct ?? 0}%`} disabled />
      </div>

      <div className="panel" style={{ maxWidth: 560 }}>
        <h3>Force update</h3>
        <label className="row" style={{ marginTop: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={!!fu.enabled}
            onChange={(e) => setCfg({ ...cfg, forceUpdate: { ...fu, enabled: e.target.checked } })} /> Enabled
        </label>
        <label>Minimum version code</label>
        <input type="number" value={fu.minVersionCode || 1}
          onChange={(e) => setCfg({ ...cfg, forceUpdate: { ...fu, minVersionCode: Number(e.target.value) } })} />
        <label>Message shown to users</label>
        <input value={fu.message || ''}
          onChange={(e) => setCfg({ ...cfg, forceUpdate: { ...fu, message: e.target.value } })} />
      </div>

      {err && <p className="err">{err}</p>}
      {msg && <p className="ok">{msg}</p>}
      <button className="primary" disabled={busy} onClick={save}>Save configuration</button>
    </div>
  )
}

function FlagGroup({ title, group, cfg, toggle, addFlag }) {
  const obj = cfg[group] || {}
  return (
    <div className="panel">
      <div className="toolbar">
        <h3>{title}</h3>
        <button className="sm" onClick={() => addFlag(group)}>+ Add</button>
      </div>
      {Object.keys(obj).length === 0 && <span className="muted">None.</span>}
      {Object.entries(obj).map(([k, v]) => (
        <label key={k} className="row" style={{ marginTop: 6 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={!!v} onChange={() => toggle(group, k)} /> {k}
        </label>
      ))}
    </div>
  )
}
