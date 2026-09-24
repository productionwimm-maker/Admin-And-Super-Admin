import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { Loading, ErrorNote, fmtTime } from '../components/Helpers.jsx'

export default function Approvals() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [active, setActive] = useState(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)

  const load = () => api.get('/api/pharmacies/pending').then(setRows).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  async function approve(phone) {
    setBusy(true)
    try { await api.post(`/api/pharmacies/${encodeURIComponent(phone)}/approve`); close(); load() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  async function reject(phone) {
    setBusy(true)
    try {
      await api.post(`/api/pharmacies/${encodeURIComponent(phone)}/reject`, { reason })
      close(); load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  function close() { setActive(null); setRejecting(false); setReason('') }

  if (err) return <div className="page"><ErrorNote error={err} /></div>
  if (!rows) return <div className="page"><Loading /></div>

  return (
    <div className="page">
      <h1>Signup Approvals</h1>
      <p className="muted">Review drug license, Aadhaar &amp; shop photo, then approve or reject.</p>

      {rows.length === 0 && <div className="panel">No pending signups. 🎉</div>}

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Pharmacy</th><th>Owner</th><th>City / State</th>
              <th>Code</th><th>Submitted</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.pharmacyName}</td>
                <td>{p.ownerName}</td>
                <td>{p.city}, {p.state}</td>
                <td>{p.pharmacyCode || '—'}</td>
                <td className="muted">{fmtTime(p.updatedAtMillis)}</td>
                <td><button className="sm" onClick={() => setActive(p)}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active && (
        <Modal title={`Review — ${active.pharmacyName}`} wide onClose={close}>
          <div className="kv">
            <div>Owner</div><div>{active.ownerName}</div>
            <div>Mobile</div><div>{active.mobileNumber}</div>
            <div>Drug License #</div><div>{active.drugLicenseNumber}</div>
            <div>Aadhaar #</div><div>{active.aadharNumber}</div>
            <div>Address</div><div>{active.city}, {active.state} {active.pincode}</div>
            <div>Discount</div><div>{active.discountPercent}%</div>
            <div>Referral</div><div>{active.referralCode || '—'}</div>
          </div>

          <h3 style={{ marginTop: 16 }}>Documents</h3>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 10 }}>
            <DocLink label="Drug License" url={active.drugLicenseUri} onPreview={setPreview} />
            {(active.aadharUris || []).map((u, i) => (
              <DocLink key={i} label={`Aadhaar ${i + 1}`} url={u} onPreview={setPreview} />
            ))}
            <DocLink label="Shop Photo" url={active.photoUri} onPreview={setPreview} />
          </div>

          {!rejecting ? (
            <div className="row" style={{ marginTop: 20 }}>
              <button className="green" disabled={busy} onClick={() => approve(active.id)}>Approve</button>
              <button className="red" disabled={busy} onClick={() => setRejecting(true)}>Reject…</button>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <label>Rejection reason (sent to pharmacy)</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Drug license image is unreadable"
              />
              <div className="row" style={{ marginTop: 12 }}>
                <button className="red" disabled={busy || !reason.trim()} onClick={() => reject(active.id)}>
                  Confirm reject
                </button>
                <button disabled={busy} onClick={() => setRejecting(false)}>Cancel</button>
              </div>
            </div>
          )}
        </Modal>
      )}

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

  if (broken) {
    return (
      <div style={{
        width: 114, height: 86, borderRadius: 7, background: '#1a1a2e',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 4
      }}>
        <span style={{ fontSize: 28 }}>📄</span>
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
