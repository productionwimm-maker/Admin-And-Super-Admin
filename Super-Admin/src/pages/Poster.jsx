import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote, fmtTime } from '../components/Helpers.jsx'

// Keep uploaded images small — they're stored as a data URI on the poster
// doc itself (no file storage wired up), so this is a friendly ceiling.
const MAX_UPLOAD_BYTES = 700 * 1024

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

// Promotional poster pushed to the main marketing website — Super Admin only.
// Publishing shows it as a small dismissible card in the top-left corner of
// the site; visitors close it with a ✕ and the site underneath is unaffected.
export default function Poster() {
  const [current, setCurrent] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const [imageUrl, setImageUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [title, setTitle] = useState('')
  const fileInput = useRef(null)

  const load = () =>
    api.get('/api/poster/admin').then((p) => {
      setCurrent(p)
      setImageUrl(p.imageUrl || '')
      setLinkUrl(p.linkUrl || '')
      setTitle(p.title || '')
    }).catch((e) => setErr(e.message))

  useEffect(() => { load() }, [])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr('')
    if (!file.type.startsWith('image/')) { setErr('Choose an image file.'); return }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErr(`That image is too big (${(file.size / 1024).toFixed(0)} KB) — use one under ${Math.floor(MAX_UPLOAD_BYTES / 1024)} KB, or paste an image URL instead.`)
      return
    }
    try {
      setImageUrl(await fileToDataUrl(file))
    } catch (e2) { setErr(e2.message) }
  }

  function clearUpload() {
    setImageUrl('')
    if (fileInput.current) fileInput.current.value = ''
  }

  async function publish() {
    setErr(''); setMsg('')
    if (!imageUrl) { setErr('Add an image — paste a URL or upload a file.'); return }
    setBusy(true)
    try {
      await api.put('/api/poster', { imageUrl, linkUrl, title, active: true })
      setMsg('Poster published — it will now show on the main website.')
      load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function setActive(active) {
    setErr(''); setMsg('')
    if (!current?.imageUrl) return
    setBusy(true)
    try {
      await api.put('/api/poster', {
        imageUrl: current.imageUrl,
        linkUrl: current.linkUrl || '',
        title: current.title || '',
        active,
      })
      setMsg(active ? 'Poster re-published.' : 'Poster taken down — it will stop showing on the main website.')
      load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (err && !current) return <div className="page"><ErrorNote error={err} /></div>
  if (!current) return <div className="page"><Loading /></div>

  const isUpload = imageUrl.startsWith('data:')

  return (
    <div className="page">
      <h1>Poster</h1>
      <p className="muted">
        Push a promotional poster to the main website. It opens full-screen over the site with
        a ✕ close button fixed in the top-left corner — closing it just reveals the site
        underneath, nothing else changes. Super Admin only.
      </p>

      <div className="panel" style={{ maxWidth: 560 }}>
        <label>Image URL</label>
        <input
          value={isUpload ? '' : imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/poster.jpg"
          disabled={isUpload}
        />
        <p className="muted" style={{ margin: '6px 0' }}>— or upload an image —</p>
        <input type="file" accept="image/*" ref={fileInput} onChange={handleFile} />
        {isUpload && (
          <p className="muted" style={{ marginTop: 4 }}>
            Image loaded from upload.{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); clearUpload() }}>Remove</a>
          </p>
        )}

        <label style={{ marginTop: 12 }}>Link when clicked (optional)</label>
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://example.com/offer"
        />

        <label>Title / alt text (optional)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Monsoon offer — 20% off"
        />

        {imageUrl && (
          <div style={{ marginTop: 14 }}>
            <p className="muted" style={{ marginBottom: 6 }}>Preview (shown full-screen on the site)</p>
            <div style={{
              position: 'relative', width: 320, padding: '28px 10px 10px', borderRadius: 12,
              background: 'rgba(0,0,0,.55)',
            }}>
              <div style={{
                position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: '50%',
                background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
                display: 'grid', placeItems: 'center', fontSize: 13,
              }}>✕</div>
              <div style={{
                border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
                background: 'var(--surface-2)',
              }}>
                <img src={imageUrl} alt={title || 'Poster'} style={{ width: '100%', display: 'block', maxHeight: 220, objectFit: 'contain' }} />
              </div>
            </div>
          </div>
        )}

        {err && <p className="err">{err}</p>}
        {msg && <p className="ok">{msg}</p>}

        <div className="row" style={{ marginTop: 14 }}>
          <button className="primary" disabled={busy} onClick={publish}>
            {busy ? 'Publishing…' : 'Continue'}
          </button>
        </div>
      </div>

      <h3 style={{ marginTop: 22 }}>Currently on the website</h3>
      {current.imageUrl ? (
        <div className="panel" style={{ maxWidth: 560 }}>
          <div className="kv">
            <div>Status</div>
            <div style={{ color: current.active ? '#22c55e' : 'var(--muted)' }}>
              {current.active ? '● Live — visible on the main website' : '○ Hidden'}
            </div>
            <div>Title</div><div>{current.title || '—'}</div>
            <div>Link</div>
            <div>{current.linkUrl
              ? <a href={current.linkUrl} target="_blank" rel="noopener noreferrer">{current.linkUrl}</a>
              : '—'}</div>
            <div>Pushed by</div><div>{current.updatedBy || '—'}</div>
            <div>When</div><div className="muted">{fmtTime(current.updatedAtMillis)}</div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            {current.active
              ? <button className="red" disabled={busy} onClick={() => setActive(false)}>Take down</button>
              : <button disabled={busy} onClick={() => setActive(true)}>Re-publish</button>}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ maxWidth: 560 }}>No poster published yet.</div>
      )}
    </div>
  )
}
