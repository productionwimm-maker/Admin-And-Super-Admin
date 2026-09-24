import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Modal from '../components/Modal.jsx'
import { Loading, ErrorNote, VerifyBadge } from '../components/Helpers.jsx'

export default function Pharmacies() {
  const { can, isSuper } = useAuth()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)        // { phone, mode: 'discount'|'location'|'suspend'|'docs' }
  const [val, setVal] = useState({})
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)  // { label, url }

  const load = () => api.get('/api/pharmacies').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  async function run(fn) {
    setBusy(true); setErr('')
    try { await fn(); setEdit(null); setVal({}); load() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (err && !rows) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  const filtered = rows.filter((r) =>
    !q || (r.pharmacyName || '').toLowerCase().includes(q.toLowerCase()) ||
    (r.pharmacyCode || '').toLowerCase().includes(q.toLowerCase()) ||
    (r.mobileNumber || '').includes(q))

  // The pharmacy whose docs we're viewing
  const docsPharmacy = edit?.mode === 'docs' ? rows.find((r) => r.id === edit.phone) : null

  return (
    <div className="page">
      <h1>Pharmacy Directory</h1>
      <div className="toolbar">
        <input style={{ maxWidth: 320 }} placeholder="Search name / code / phone"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorNote error={err} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Code</th><th>Pharmacy</th><th>Owner</th><th>State</th><th>Discount</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.pharmacyCode || '—'}</td>
                <td>{p.pharmacyName}<div className="muted">{p.mobileNumber}</div></td>
                <td>{p.ownerName}</td>
                <td>{p.state}</td>
                <td>{p.discountPercent}%</td>
                <td><VerifyBadge acc={p} /></td>
                <td>
                  <div className="row">
                    <button className="sm" onClick={() => setEdit({ phone: p.id, mode: 'docs' })}>
                      📄 Docs
                    </button>
                    {can('override_discount') && (
                      <button className="sm" onClick={() => { setEdit({ phone: p.id, mode: 'discount' }); setVal({ discountPercent: p.discountPercent }) }}>Discount</button>
                    )}
                    {can('suspend_pharmacy') && !p.suspended && (
                      <button className="sm" onClick={() => { setEdit({ phone: p.id, mode: 'suspend' }); setVal({ reason: '' }) }}>Suspend</button>
                    )}
                    {can('suspend_pharmacy') && p.suspended && (
                      <button className="sm green" onClick={() => run(() => api.post(`/api/pharmacies/${encodeURIComponent(p.id)}/unsuspend`))}>Unsuspend</button>
                    )}
                    {isSuper && (
                      <button className="sm" onClick={() => { setEdit({ phone: p.id, mode: 'location' }); setVal({ latitude: p.latitude, longitude: p.longitude }) }}>Location</button>
                    )}
                    {isSuper && (
                      <button className="sm red" onClick={() => {
                        if (confirm(`Permanently delete ${p.pharmacyName}? This cannot be undone.`))
                          run(() => api.del(`/api/pharmacies/${encodeURIComponent(p.id)}`))
                      }}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Documents modal ─────────────────────────────────────────── */}
      {edit?.mode === 'docs' && docsPharmacy && (
        <Modal title={`Documents — ${docsPharmacy.pharmacyName}`} wide onClose={() => setEdit(null)}>
          <div className="kv">
            <div>Owner</div><div>{docsPharmacy.ownerName}</div>
            <div>Mobile</div><div>{docsPharmacy.mobileNumber}</div>
            <div>Drug License #</div><div>{docsPharmacy.drugLicenseNumber || '—'}</div>
            <div>Aadhaar #</div><div>{docsPharmacy.aadharNumber || '—'}</div>
            <div>Address</div><div>{docsPharmacy.city}, {docsPharmacy.state} {docsPharmacy.pincode}</div>
          </div>

          <h3 style={{ marginTop: 16 }}>Uploaded Documents</h3>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 10 }}>
            <DocLink label="Drug License" url={docsPharmacy.drugLicenseUri} onPreview={setPreview} />
            {(docsPharmacy.aadharUris || []).map((u, i) => (
              <DocLink key={i} label={`Aadhaar ${i + 1}`} url={u} onPreview={setPreview} />
            ))}
            <DocLink label="Shop Photo" url={docsPharmacy.photoUri} onPreview={setPreview} />
          </div>

          {!docsPharmacy.drugLicenseUri && !(docsPharmacy.aadharUris || []).length && !docsPharmacy.photoUri && (
            <p className="muted" style={{ marginTop: 12 }}>No documents uploaded by this pharmacy.</p>
          )}
        </Modal>
      )}

      {/* ── Discount modal ──────────────────────────────────────────── */}
      {edit?.mode === 'discount' && (
        <Modal title="Override discount %" onClose={() => setEdit(null)}>
          {!isSuper && <p className="muted">Admins may set up to 25%. Higher needs a Super Admin.</p>}
          <label>Discount %</label>
          <input type="number" value={val.discountPercent}
            onChange={(e) => setVal({ discountPercent: Number(e.target.value) })} />
          <ErrorNote error={err} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" disabled={busy}
              onClick={() => run(() => api.put(`/api/pharmacies/${encodeURIComponent(edit.phone)}/discount`, { discountPercent: val.discountPercent }))}>
              Save
            </button>
          </div>
        </Modal>
      )}

      {/* ── Suspend modal ───────────────────────────────────────────── */}
      {edit?.mode === 'suspend' && (
        <Modal title="Suspend pharmacy" onClose={() => setEdit(null)}>
          <label>Reason</label>
          <textarea rows={3} value={val.reason} onChange={(e) => setVal({ reason: e.target.value })} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="red" disabled={busy}
              onClick={() => run(() => api.post(`/api/pharmacies/${encodeURIComponent(edit.phone)}/suspend`, { reason: val.reason }))}>
              Suspend
            </button>
          </div>
        </Modal>
      )}

      {/* ── Location modal ──────────────────────────────────────────── */}
      {edit?.mode === 'location' && (
        <Modal title="Override shop location" onClose={() => setEdit(null)}>
          <label>Latitude</label>
          <input type="number" value={val.latitude} onChange={(e) => setVal({ ...val, latitude: Number(e.target.value) })} />
          <label>Longitude</label>
          <input type="number" value={val.longitude} onChange={(e) => setVal({ ...val, longitude: Number(e.target.value) })} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" disabled={busy}
              onClick={() => run(() => api.put(`/api/pharmacies/${encodeURIComponent(edit.phone)}/location`, { latitude: val.latitude, longitude: val.longitude }))}>
              Save
            </button>
          </div>
        </Modal>
      )}

      {/* ── Full-screen document preview ────────────────────────────── */}
      {preview && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 20
          }}
          onClick={() => setPreview(null)}
        >
          <div
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: 20, width: '100%', maxWidth: 900,
              maxHeight: '94vh', overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>{preview.label}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 13, padding: '5px 14px',
                    background: 'var(--primary)', color: '#fff',
                    borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap'
                  }}
                >
                  Open ↗
                </a>
                <button className="sm" onClick={() => setPreview(null)}>Close ✕</button>
              </div>
            </div>

            {isPdf(preview.url)
              ? <iframe
                  src={preview.url}
                  title={preview.label}
                  style={{ width: '100%', height: '78vh', border: 'none', borderRadius: 8 }}
                />
              : <img
                  src={preview.url}
                  alt={preview.label}
                  style={{
                    display: 'block', maxWidth: '100%', maxHeight: '78vh',
                    objectFit: 'contain', margin: '0 auto', borderRadius: 8
                  }}
                />
            }
          </div>
        </div>
      )}
    </div>
  )
}

function isPdf(url) {
  return /\.pdf($|\?)/i.test(url || '')
}

function DocLink({ label, url, onPreview }) {
  if (!url) return <span className="badge grey">{label}: none</span>
  return (
    <div
      onClick={() => onPreview({ label, url })}
      style={{
        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 6, width: 130, padding: 8,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 10, transition: 'border-color .15s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <DocThumbnail url={url} label={label} />
      <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>{label} 🔍</span>
    </div>
  )
}

function DocThumbnail({ url, label }) {
  const [broken, setBroken] = useState(false)

  useEffect(() => { setBroken(false) }, [url])

  if (broken || isPdf(url)) {
    return (
      <div style={{
        width: 114, height: 86, borderRadius: 7, background: '#1a1a2e',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 4
      }}>
        <span style={{ fontSize: 28 }}>{isPdf(url) ? '📋' : '📄'}</span>
        <span style={{ fontSize: 10, color: '#666' }}>tap to view</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={label}
      style={{ width: 114, height: 86, objectFit: 'cover', borderRadius: 7, background: '#111' }}
      onError={() => setBroken(true)}
    />
  )
}
