import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { Loading, ErrorNote, fmtMoney, Badge } from '../components/Helpers.jsx'

/* Wellness / E-commerce catalogue manager.
 * Three tabs: Sub-themes (categories), Products (with hidden commission →
 * auto final price), and Decks (the home carousel). */

const TABS = ['Sub-themes', 'Products', 'Decks']

const EMPTY_SUB = { name: '', imageUrl: '', order: 0, active: true }
const EMPTY_PROD = {
  name: '', subthemeId: '', imageUrl: '', description: '', about: '',
  basePrice: 0, commissionPct: 0, brand: '', unit: '', active: true,
}
const EMPTY_DECK = {
  imageUrl: '', title: '', targetType: 'product', targetId: '', order: 0, active: true,
  eyebrow: 'WELLNESS', buttonText: 'Shop now  →', color1: '#0A8A80', color2: '#0E6E66', textColor: '#FFFFFF',
}

const finalOf = (base, pct) => Math.round(Number(base || 0) * (1 + Number(pct || 0) / 100))

export default function Wellness() {
  const [tab, setTab] = useState('Sub-themes')
  return (
    <div className="page">
      <h1>Wellness Shop</h1>
      <p className="muted">E-commerce catalogue shown in the app's Shop. Commission is never exposed to customers.</p>
      <div className="row" style={{ gap: 8, margin: '12px 0 18px' }}>
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'primary' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'Sub-themes' && <Subthemes />}
      {tab === 'Products' && <Products />}
      {tab === 'Decks' && <Decks />}
    </div>
  )
}

/* ── Sub-themes ───────────────────────────────────────────────────────────── */
function Subthemes() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/api/wellness/subthemes').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  async function save() {
    setBusy(true); setErr('')
    const body = { name: edit.name, imageUrl: edit.imageUrl, order: Number(edit.order) || 0, active: !!edit.active }
    try {
      if (edit.id) await api.put(`/api/wellness/subthemes/${edit.id}`, body)
      else await api.post('/api/wellness/subthemes', body)
      setEdit(null); load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  async function remove(id) {
    if (!confirm('Delete this sub-theme AND all its products?')) return
    try { await api.del(`/api/wellness/subthemes/${id}`); load() } catch (e) { setErr(e.message) }
  }

  if (!rows) return err ? <ErrorNote error={err} /> : <Loading />
  return (
    <>
      <div className="toolbar">
        <p className="muted">{rows.length} sub-themes</p>
        <button className="primary" onClick={() => setEdit({ ...EMPTY_SUB })}>+ Add sub-theme</button>
      </div>
      <ErrorNote error={err} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Image</th><th>Name</th><th>Order</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td><Thumb url={s.imageUrl} /></td>
                <td>{s.name}</td>
                <td>{s.order}</td>
                <td>{s.active ? <Badge kind="green">Active</Badge> : <Badge kind="grey">Hidden</Badge>}</td>
                <td><div className="row">
                  <button className="sm" onClick={() => setEdit({ ...s })}>Edit</button>
                  <button className="sm red" onClick={() => remove(s.id)}>Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? 'Edit sub-theme' : 'Add sub-theme'} onClose={() => setEdit(null)}>
          <label>Name</label>
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Face Wash" />
          <label>Image URL</label>
          <input value={edit.imageUrl} onChange={(e) => setEdit({ ...edit, imageUrl: e.target.value })} placeholder="https://…" />
          <Thumb url={edit.imageUrl} big />
          <label>Sort order (lower first)</label>
          <input type="number" value={edit.order} onChange={(e) => setEdit({ ...edit, order: e.target.value })} />
          <label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={!!edit.active}
            onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active (visible in app)</label>
          <ErrorNote error={err} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" disabled={busy || !edit.name} onClick={save}>Save</button>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ── Products ─────────────────────────────────────────────────────────────── */
function Products() {
  const [rows, setRows] = useState(null)
  const [subs, setSubs] = useState([])
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')

  const load = () => api.get('/api/wellness/products').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => {
    api.get('/api/wellness/subthemes').then(setSubs).catch(() => {})
    load()
  }, [])

  async function save() {
    setBusy(true); setErr('')
    const body = {
      name: edit.name, subthemeId: edit.subthemeId, imageUrl: edit.imageUrl,
      description: edit.description, about: edit.about,
      basePrice: Number(edit.basePrice) || 0, commissionPct: Number(edit.commissionPct) || 0,
      brand: edit.brand, unit: edit.unit, active: !!edit.active,
    }
    try {
      if (edit.id) await api.put(`/api/wellness/products/${edit.id}`, body)
      else await api.post('/api/wellness/products', body)
      setEdit(null); load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  async function remove(id) {
    if (!confirm('Delete this product?')) return
    try { await api.del(`/api/wellness/products/${id}`); load() } catch (e) { setErr(e.message) }
  }

  if (!rows) return err ? <ErrorNote error={err} /> : <Loading />
  const shown = filter ? rows.filter((p) => p.subthemeId === filter) : rows

  return (
    <>
      <div className="toolbar">
        <div className="row" style={{ gap: 8 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All sub-themes</option>
            {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="muted">{shown.length} products</span>
        </div>
        <button className="primary" disabled={!subs.length}
          onClick={() => setEdit({ ...EMPTY_PROD, subthemeId: subs[0]?.id || '' })}>+ Add product</button>
      </div>
      {!subs.length && <p className="muted">Add a sub-theme first.</p>}
      <ErrorNote error={err} />
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Image</th><th>Name</th><th>Sub-theme</th><th>Base (pharmacy)</th>
            <th>Comm.%</th><th>Final (customer)</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td><Thumb url={p.imageUrl} /></td>
                <td>{p.name}{p.unit ? <span className="muted"> · {p.unit}</span> : null}</td>
                <td>{p.subthemeName || '—'}</td>
                <td>{fmtMoney(p.basePrice)}</td>
                <td>{p.commissionPct}%</td>
                <td><b>{fmtMoney(p.finalPrice)}</b></td>
                <td>{p.active ? <Badge kind="green">Active</Badge> : <Badge kind="grey">Hidden</Badge>}</td>
                <td><div className="row">
                  <button className="sm" onClick={() => setEdit({ ...p })}>Edit</button>
                  <button className="sm red" onClick={() => remove(p.id)}>Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? 'Edit product' : 'Add product'} onClose={() => setEdit(null)}>
          <label>Name</label>
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <label>Sub-theme</label>
          <select value={edit.subthemeId} onChange={(e) => setEdit({ ...edit, subthemeId: e.target.value })}>
            {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label>Brand (optional)</label>
          <input value={edit.brand} onChange={(e) => setEdit({ ...edit, brand: e.target.value })} />
          <label>Unit / size (e.g. 100 ml, pack of 3)</label>
          <input value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} />
          <label>Image URL</label>
          <input value={edit.imageUrl} onChange={(e) => setEdit({ ...edit, imageUrl: e.target.value })} placeholder="https://…" />
          <Thumb url={edit.imageUrl} big />
          <label>Short description</label>
          <input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
          <label>What is it about</label>
          <textarea rows={3} value={edit.about} onChange={(e) => setEdit({ ...edit, about: e.target.value })} />
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Base price ₹ (pharmacy is paid)</label>
              <input type="number" value={edit.basePrice} onChange={(e) => setEdit({ ...edit, basePrice: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Commission % (hidden)</label>
              <input type="number" value={edit.commissionPct} onChange={(e) => setEdit({ ...edit, commissionPct: e.target.value })} />
            </div>
          </div>
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(34,197,138,.12)', border: '1px solid rgba(34,197,138,.35)',
          }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Customer pays (ex-delivery)</span>
              <b style={{ fontSize: 18 }}>{fmtMoney(finalOf(edit.basePrice, edit.commissionPct))}</b>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Our commission</span>
              <span>{fmtMoney(finalOf(edit.basePrice, edit.commissionPct) - Number(edit.basePrice || 0))}</span>
            </div>
          </div>
          <label className="row" style={{ marginTop: 12 }}><input type="checkbox" style={{ width: 'auto' }}
            checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active (visible in app)</label>
          <ErrorNote error={err} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" disabled={busy || !edit.name || !edit.subthemeId} onClick={save}>Save</button>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ── Decks (home carousel) ────────────────────────────────────────────────── */
function Decks() {
  const [rows, setRows] = useState(null)
  const [subs, setSubs] = useState([])
  const [prods, setProds] = useState([])
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/api/wellness/decks').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => {
    api.get('/api/wellness/subthemes').then(setSubs).catch(() => {})
    api.get('/api/wellness/products').then(setProds).catch(() => {})
    load()
  }, [])

  const targetName = (d) => {
    const list = d.targetType === 'subtheme' ? subs : prods
    return list.find((x) => x.id === d.targetId)?.name || '—'
  }

  async function save() {
    setBusy(true); setErr('')
    const body = {
      imageUrl: edit.imageUrl, title: edit.title, targetType: edit.targetType,
      targetId: edit.targetId, order: Number(edit.order) || 0, active: !!edit.active,
      eyebrow: edit.eyebrow || '', buttonText: edit.buttonText || '',
      color1: edit.color1 || '', color2: edit.color2 || '', textColor: edit.textColor || '',
      template: !!edit.template,
    }
    try {
      if (edit.id) await api.put(`/api/wellness/decks/${edit.id}`, body)
      else await api.post('/api/wellness/decks', body)
      setEdit(null); load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  async function remove(id) {
    if (!confirm('Delete this deck slide?')) return
    try { await api.del(`/api/wellness/decks/${id}`); load() } catch (e) { setErr(e.message) }
  }

  if (!rows) return err ? <ErrorNote error={err} /> : <Loading />
  const targetList = edit?.targetType === 'subtheme' ? subs : prods

  return (
    <>
      <div className="toolbar">
        <p className="muted">{rows.length} slides · shown as a swipeable banner on the customer home. Use a wide 16:7 image.</p>
        <button className="primary" onClick={() => setEdit({ ...EMPTY_DECK })}>+ Add slide</button>
      </div>
      <ErrorNote error={err} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Banner</th><th>Title</th><th>Opens</th><th>Order</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td><Thumb url={d.imageUrl} wide /></td>
                <td>{d.title || <span className="muted">—</span>}</td>
                <td><span className="muted">{d.targetType}:</span> {targetName(d)}</td>
                <td>{d.order}</td>
                <td>{d.active ? <Badge kind="green">Live</Badge> : <Badge kind="grey">Off</Badge>}</td>
                <td><div className="row">
                  <button className="sm" onClick={() => setEdit({ ...d })}>Edit</button>
                  <button className="sm red" onClick={() => remove(d.id)}>Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? 'Edit card' : 'Add card'} onClose={() => setEdit(null)}>
          {/* Live preview — what the card looks like in the app (16:7). */}
          <DeckPreview deck={edit} />

          <label>Headline (big text)</label>
          <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="e.g. Everyday skin care" />
          <label>Eyebrow (small label above)</label>
          <input value={edit.eyebrow} onChange={(e) => setEdit({ ...edit, eyebrow: e.target.value })} placeholder="WELLNESS" />
          <label>Button text</label>
          <input value={edit.buttonText} onChange={(e) => setEdit({ ...edit, buttonText: e.target.value })} placeholder="Shop now  →" />

          <label>Background image URL (optional — leave blank to use the gradient below)</label>
          <input value={edit.imageUrl} onChange={(e) => setEdit({ ...edit, imageUrl: e.target.value })} placeholder="https://… (wide ~16:7)" />

          {!edit.imageUrl && (
            <div className="row" style={{ gap: 12, marginTop: 8 }}>
              <div><label>Gradient start</label>
                <input type="color" value={edit.color1 || '#0A8A80'} onChange={(e) => setEdit({ ...edit, color1: e.target.value })} /></div>
              <div><label>Gradient end</label>
                <input type="color" value={edit.color2 || '#0E6E66'} onChange={(e) => setEdit({ ...edit, color2: e.target.value })} /></div>
              <div><label>Text color</label>
                <input type="color" value={edit.textColor || '#FFFFFF'} onChange={(e) => setEdit({ ...edit, textColor: e.target.value })} /></div>
            </div>
          )}

          <label style={{ marginTop: 12 }}>Opens</label>
          <select value={edit.targetType}
            onChange={(e) => setEdit({ ...edit, targetType: e.target.value, targetId: '' })}>
            <option value="product">A product</option>
            <option value="subtheme">A sub-theme</option>
            <option value="shop">The Wellness shop</option>
          </select>
          {edit.targetType !== 'shop' && (
            <select value={edit.targetId} onChange={(e) => setEdit({ ...edit, targetId: e.target.value })}>
              <option value="">Select…</option>
              {targetList.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          <label>Sort order (lower first)</label>
          <input type="number" value={edit.order} onChange={(e) => setEdit({ ...edit, order: e.target.value })} />
          <label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={!!edit.active}
            onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Live</label>
          <ErrorNote error={err} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary"
              disabled={busy || !edit.title || (edit.targetType !== 'shop' && !edit.targetId)}
              onClick={save}>Save</button>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ── live card preview (mirrors the app's DeckCard) ─────────────────────────── */
function DeckPreview({ deck }) {
  const hasImage = !!deck.imageUrl
  const c1 = deck.color1 || '#0A8A80'
  const c2 = deck.color2 || '#0E6E66'
  const text = deck.textColor || '#FFFFFF'
  const eyebrow = deck.eyebrow || (hasImage ? '' : 'WELLNESS')
  const button = deck.buttonText || 'Shop now  →'
  const bg = hasImage
    ? { backgroundImage: `linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.67)), url(${deck.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})` }
  return (
    <div style={{
      width: '100%', aspectRatio: '16 / 7', borderRadius: 16, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: 16, marginBottom: 12, boxSizing: 'border-box', ...bg,
    }}>
      <div style={{ color: text, opacity: 0.78, fontSize: 9, fontWeight: 700, letterSpacing: 1.6 }}>{eyebrow}</div>
      <div style={{ color: text, fontSize: 19, fontWeight: 800, lineHeight: 1.15, maxWidth: '82%' }}>{deck.title || 'Headline'}</div>
      {button
        ? <div style={{ alignSelf: 'flex-start', color: text, background: 'rgba(255,255,255,.18)', borderRadius: 50, padding: '6px 12px', fontSize: 11, fontWeight: 700 }}>{button}</div>
        : <div />}
    </div>
  )
}

/* ── small image thumbnail ─────────────────────────────────────────────────── */
function Thumb({ url, big, wide }) {
  const h = big ? 120 : 40
  const w = wide ? (big ? 274 : 72) : h
  if (!url) return <div style={{
    width: w, height: h, borderRadius: 8, background: 'rgba(255,255,255,.06)',
    display: 'grid', placeItems: 'center', color: '#789', fontSize: 11, marginTop: big ? 8 : 0,
  }}>no image</div>
  return <img src={url} alt="" style={{
    width: w, height: h, objectFit: 'cover', borderRadius: 8, marginTop: big ? 8 : 0,
    border: '1px solid rgba(255,255,255,.1)',
  }} />
}
