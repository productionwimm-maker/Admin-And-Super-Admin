import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote, fmtTime } from '../components/Helpers.jsx'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const BUCKET = 'apk-releases'

// Uploads the APK straight to Supabase Storage with an XHR so we can show a
// real upload progress bar (big files). Returns the public URL.
function uploadApk(file, onProgress) {
  return new Promise((resolve, reject) => {
    const path = `wimm-${Date.now()}.apk`
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`)
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY)
    xhr.setRequestHeader('Content-Type', 'application/vnd.android.package-archive')
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`)
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(file)
  })
}

export default function Update() {
  const [current, setCurrent] = useState(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ versionCode: '', versionName: '', message: '' })
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/api/app-update').then(setCurrent).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  async function push() {
    setErr(''); setMsg('')
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setErr('Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
      return
    }
    if (!file) { setErr('Choose an APK file first.'); return }
    if (!form.versionCode) { setErr('Enter the new versionCode.'); return }

    setBusy(true); setProgress(0)
    try {
      const apkUrl = await uploadApk(file, setProgress)
      await api.put('/api/app-update', {
        apkUrl,
        message: form.message,
        versionCode: Number(form.versionCode),
        versionName: form.versionName,
        active: true,
      })
      setMsg('Update pushed! Every app will now prompt to update.')
      setFile(null)
      setForm({ versionCode: '', versionName: '', message: '' })
      setProgress(0)
      load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function setActive(active) {
    setErr(''); setMsg('')
    if (!current?.apkUrl) return
    setBusy(true)
    try {
      await api.put('/api/app-update', {
        apkUrl: current.apkUrl,
        message: current.message || '',
        versionCode: Number(current.versionCode) || 0,
        versionName: current.versionName || '',
        active,
      })
      setMsg(active ? 'Update re-enabled.' : 'Update disabled — apps will stop prompting.')
      load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (err && !current) return <div className="page"><ErrorNote error={err} /></div>
  if (!current) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>App Update</h1>
      <p className="muted">
        Upload a new APK and push it. Every customer, pharmacy and doctor app will
        instantly show a mandatory update dialog and cannot be used until updated.
      </p>

      <div className="panel" style={{ maxWidth: 560 }}>
        <label>APK file</label>
        <input
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {file && <p className="muted" style={{ marginTop: 4 }}>
          {file.name} — {(file.size / 1048576).toFixed(1)} MB
        </p>}

        <label style={{ marginTop: 12 }}>New version code (must be higher than the live one)</label>
        <input
          type="number"
          value={form.versionCode}
          onChange={(e) => setForm({ ...form, versionCode: e.target.value })}
          placeholder="e.g. 3"
        />

        <label>Version name (shown to users)</label>
        <input
          value={form.versionName}
          onChange={(e) => setForm({ ...form, versionName: e.target.value })}
          placeholder="e.g. 1.2"
        />

        <label>What's this update about?</label>
        <textarea
          rows={3}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="e.g. New delivery tracking, bug fixes and faster search."
        />

        {busy && progress > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${(progress * 100).toFixed(0)}%`, height: '100%', background: 'var(--primary)' }} />
            </div>
            <p className="muted" style={{ marginTop: 4 }}>Uploading… {(progress * 100).toFixed(0)}%</p>
          </div>
        )}

        {err && <p className="err">{err}</p>}
        {msg && <p className="ok">{msg}</p>}

        <div className="row" style={{ marginTop: 14 }}>
          <button className="primary" disabled={busy} onClick={push}>
            {busy ? 'Pushing…' : 'Push Update'}
          </button>
        </div>
      </div>

      <h3 style={{ marginTop: 22 }}>Currently published</h3>
      {current.apkUrl ? (
        <div className="panel" style={{ maxWidth: 560 }}>
          <div className="kv">
            <div>Status</div>
            <div style={{ color: current.active ? '#22c55e' : 'var(--muted)' }}>
              {current.active ? '● Live — apps are prompting' : '○ Disabled'}
            </div>
            <div>Version</div><div>{current.versionName || '—'} (code {current.versionCode})</div>
            <div>Message</div><div>{current.message || '—'}</div>
            <div>Pushed by</div><div>{current.updatedBy || '—'}</div>
            <div>When</div><div className="muted">{fmtTime(current.updatedAtMillis)}</div>
            <div>APK</div><div><a href={current.apkUrl} target="_blank" rel="noopener noreferrer">Download ↗</a></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            {current.active
              ? <button className="red" disabled={busy} onClick={() => setActive(false)}>Disable update</button>
              : <button disabled={busy} onClick={() => setActive(true)}>Re-enable update</button>}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ maxWidth: 560 }}>No update published yet.</div>
      )}
    </div>
  )
}
