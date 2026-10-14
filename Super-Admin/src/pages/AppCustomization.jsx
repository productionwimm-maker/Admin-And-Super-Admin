import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote } from '../components/Helpers.jsx'

/* One place to control the live app: hero texts (typewriter), contact details,
 * remote logo, a Spotify-style promo banner, and the app update (APK upload to
 * Firebase Storage). All merge into feature_flags/config, mirrored live by app. */

const ACTIONS = [
  { v: 'none', label: 'No button' },
  { v: 'url', label: 'Open a link (URL)' },
  { v: 'product', label: 'Open a wellness product (product id)' },
  { v: 'subtheme', label: 'Open a wellness sub-theme (sub-theme id)' },
  { v: 'shop', label: 'Open the wellness shop' },
]

function Uploader({ label, accept, endpoint, onDone }) {
  const ref = useRef()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr('')
    try { const res = await api.upload(endpoint, file); onDone(res.url) }
    catch (e) { setErr(e.message) } finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }
  return (
    <div>
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={pick} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? 'Uploading…' : label}
      </button>
      {err && <span className="muted" style={{ color: '#ff7b76', marginLeft: 8 }}>{err}</span>}
    </div>
  )
}

export default function AppCustomization() {
  const [cfg, setCfg] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [subthemes, setSubthemes] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    // Lists for the banner target pickers (so the admin selects, not types an id).
    api.get('/api/wellness/subthemes').then((r) => setSubthemes(r || [])).catch(() => {})
    api.get('/api/wellness/products').then((r) => setProducts(r || [])).catch(() => {})
    api.get('/api/app-customization').then((c) => {
      setCfg({
        home: { eyebrow: c.home?.eyebrow || '', texts: (c.home?.texts?.length ? c.home.texts : ['']) },
        contact: { email: c.contact?.email || '', phone: c.contact?.phone || '', whatsapp: c.contact?.whatsapp || '', address: c.contact?.address || '' },
        logoUrl: c.logoUrl || '',
        banner: {
          enabled: !!c.banner?.enabled, imageUrl: c.banner?.imageUrl || '', buttonText: c.banner?.buttonText || '',
          action: c.banner?.action || 'none', target: c.banner?.target || '', buttonRadius: c.banner?.buttonRadius ?? 12,
          buttonColor: c.banner?.buttonColor || '#FFFFFF', textColor: c.banner?.textColor || '#0A8A80',
          dismissible: c.banner?.dismissible !== false,
        },
      })
    }).catch((e) => setErr(e.message))
  }, [])

  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 2500) }

  async function saveCfg() {
    setBusy(true); setErr('')
    try {
      await api.put('/api/app-customization', {
        home: { eyebrow: cfg.home.eyebrow, texts: cfg.home.texts.filter((t) => t.trim()) },
        contact: cfg.contact, logoUrl: cfg.logoUrl, banner: cfg.banner,
      })
      flash('Customization saved — the app updates live.')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  if (!cfg) return <div className="page">{err ? <ErrorNote error={err} /> : <Loading />}</div>

  const H = cfg.home, C = cfg.contact, B = cfg.banner
  const setHome = (p) => setCfg({ ...cfg, home: { ...H, ...p } })
  const setContact = (p) => setCfg({ ...cfg, contact: { ...C, ...p } })
  const setBanner = (p) => setCfg({ ...cfg, banner: { ...B, ...p } })

  return (
    <div className="page">
      <h1>App Customization</h1>
      <p className="muted">Everything here updates the live app instantly (no release). Editing is super-admin only.</p>
      <ErrorNote error={err} />
      {msg && <p style={{ color: '#00c853' }}>{msg}</p>}

      {/* ── Hero texts ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Home hero</h3>
        <label>Eyebrow (small text above)</label>
        <input value={H.eyebrow} onChange={(e) => setHome({ eyebrow: e.target.value })} placeholder="YOUR DAILY CARE, SIMPLIFIED" />
        <label>Headlines — they cycle every ~5s with a typewriter animation (use Enter for a line break)</label>
        {H.texts.map((t, i) => (
          <div key={i} className="row" style={{ gap: 8, marginBottom: 6 }}>
            <textarea rows={2} style={{ flex: 1 }} value={t}
              onChange={(e) => { const a = [...H.texts]; a[i] = e.target.value; setHome({ texts: a }) }}
              placeholder={'Your health,\nour priority.'} />
            <button type="button" className="sm red" onClick={() => setHome({ texts: H.texts.filter((_, j) => j !== i).length ? H.texts.filter((_, j) => j !== i) : [''] })}>Remove</button>
          </div>
        ))}
        <button type="button" className="sm" onClick={() => setHome({ texts: [...H.texts, ''] })}>+ Add headline</button>
      </div>

      {/* ── Contact ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Contact details</h3>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}><label>Support email</label>
            <input value={C.email} onChange={(e) => setContact({ email: e.target.value })} placeholder="connect@whereismymedicine.com" /></div>
          <div style={{ flex: 1 }}><label>Phone (10-digit)</label>
            <input value={C.phone} onChange={(e) => setContact({ phone: e.target.value })} placeholder="9330374330" /></div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}><label>WhatsApp (10-digit, optional)</label>
            <input value={C.whatsapp} onChange={(e) => setContact({ whatsapp: e.target.value })} /></div>
          <div style={{ flex: 1 }}><label>Address (optional)</label>
            <input value={C.address} onChange={(e) => setContact({ address: e.target.value })} /></div>
        </div>
      </div>

      {/* ── Logo ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>App logo</h3>
        <p className="muted">Shown inside the app. Leave blank to use the built-in logo. Great for festive/occasion logos.</p>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <input style={{ flex: 1 }} value={cfg.logoUrl} onChange={(e) => setCfg({ ...cfg, logoUrl: e.target.value })} placeholder="Logo image URL (or upload →)" />
          <Uploader label="Upload logo" accept="image/*" endpoint="/api/app-customization/upload" onDone={(url) => setCfg({ ...cfg, logoUrl: url })} />
          {cfg.logoUrl && <button type="button" className="sm" onClick={() => setCfg({ ...cfg, logoUrl: '' })}>Clear</button>}
        </div>
        {cfg.logoUrl && <img src={cfg.logoUrl} alt="logo" style={{ height: 48, marginTop: 8, borderRadius: 8 }} />}
      </div>

      {/* ── Promo banner ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Promo banner</h3>
        <label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={B.enabled} onChange={(e) => setBanner({ enabled: e.target.checked })} /> Show banner on the home screen</label>
        <div className="row" style={{ gap: 12, alignItems: 'center', marginTop: 8 }}>
          <input style={{ flex: 1 }} value={B.imageUrl} onChange={(e) => setBanner({ imageUrl: e.target.value })} placeholder="Banner image URL (or upload →)" />
          <Uploader label="Upload image" accept="image/*" endpoint="/api/app-customization/upload" onDone={(url) => setBanner({ imageUrl: url })} />
        </div>
        {B.imageUrl && <img src={B.imageUrl} alt="banner" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12, marginTop: 8 }} />}
        <div className="row" style={{ gap: 12, marginTop: 10 }}>
          <div style={{ flex: 1 }}><label>Button text (blank = whole banner is tappable)</label>
            <input value={B.buttonText} onChange={(e) => setBanner({ buttonText: e.target.value })} placeholder="Shop now" /></div>
          <div style={{ flex: 1 }}><label>On click</label>
            <select value={B.action} onChange={(e) => setBanner({ action: e.target.value })}>
              {ACTIONS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select></div>
        </div>
        {B.action === 'url' && (
          <>
            <label>URL</label>
            <input value={B.target} onChange={(e) => setBanner({ target: e.target.value })} placeholder="https://…" />
          </>
        )}
        {B.action === 'product' && (
          <>
            <label>Product</label>
            <select value={B.target} onChange={(e) => setBanner({ target: e.target.value })}>
              <option value="">— Select a product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.subthemeName ? ` · ${p.subthemeName}` : ''}</option>
              ))}
            </select>
          </>
        )}
        {B.action === 'subtheme' && (
          <>
            <label>Sub-theme</label>
            <select value={B.target} onChange={(e) => setBanner({ target: e.target.value })}>
              <option value="">— Select a sub-theme —</option>
              {subthemes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </>
        )}
        <div className="row" style={{ gap: 12, marginTop: 8, alignItems: 'center' }}>
          <div><label>Button color</label><input type="color" value={B.buttonColor} onChange={(e) => setBanner({ buttonColor: e.target.value })} /></div>
          <div><label>Text color</label><input type="color" value={B.textColor} onChange={(e) => setBanner({ textColor: e.target.value })} /></div>
          <div style={{ flex: 1 }}><label>Button radius ({B.buttonRadius}px)</label>
            <input type="range" min="0" max="40" value={B.buttonRadius} onChange={(e) => setBanner({ buttonRadius: Number(e.target.value) })} /></div>
        </div>
        <label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={B.dismissible} onChange={(e) => setBanner({ dismissible: e.target.checked })} /> Show a dismiss (✕) button</label>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="primary" disabled={busy} onClick={saveCfg}>Save customization</button>
      </div>

      <p className="muted" style={{ marginTop: 18 }}>
        To push a new app version, use the <b>App Update</b> tab (it uploads the APK to Firebase Storage).
      </p>
    </div>
  )
}
