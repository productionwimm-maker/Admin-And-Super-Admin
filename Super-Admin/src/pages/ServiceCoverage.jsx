import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../api.js'
import { Loading, ErrorNote, fmtTime } from '../components/Helpers.jsx'

const DEFAULT_RADIUS_M = 5000  // 5 km default hexagon radius
const EARTH_RADIUS_M = 6371000

// Compute 6 vertices of a flat-top hexagon given a center and radius in metres.
function hexVertices(centerLat, centerLng, radiusM) {
  const verts = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i  // flat-top: 0°, 60°, 120°, …
    const dlat = (radiusM / EARTH_RADIUS_M) * Math.cos(angle) * (180 / Math.PI)
    const dlng = (radiusM / EARTH_RADIUS_M) * Math.sin(angle)
      / Math.cos(centerLat * Math.PI / 180) * (180 / Math.PI)
    verts.push({ lat: centerLat + dlat, lng: centerLng + dlng })
  }
  return verts
}

// Load Google Maps script once, resolve when ready.
let gmapsPromise = null
function loadGoogleMaps() {
  if (gmapsPromise) return gmapsPromise
  gmapsPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) { resolve(window.google.maps); return }
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry,places`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = () => reject(new Error('Google Maps failed to load. Check VITE_GOOGLE_MAPS_KEY.'))
    document.head.appendChild(script)
  })
  return gmapsPromise
}

export default function ServiceCoverage() {
  const mapRef = useRef(null)
  const mapObj = useRef(null)         // google.maps.Map instance
  const polygonsRef = useRef({})      // zoneId → Polygon on map
  const pendingRef = useRef(null)     // { polygon, centerLat, centerLng, radiusM } for unsaved hex
  const clickListenerRef = useRef(null)
  const searchInputRef = useRef(null) // search box DOM input
  const autocompleteRef = useRef(null)

  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [placing, setPlacing] = useState(false)   // click-to-place mode on
  const [radius, setRadius] = useState(DEFAULT_RADIUS_M)
  const [pendingZone, setPendingZone] = useState(null)  // { centerLat, centerLng, radiusM }
  const [saving, setSaving] = useState(false)
  const [zoneName, setZoneName] = useState('')
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [mapsErr, setMapsErr] = useState('')

  // ── Load zones from API ─────────────────────────────────────────────────
  const fetchZones = useCallback(() => {
    setLoading(true)
    api.get('/api/coverage/zones')
      .then(data => { setZones(data); setLoading(false) })
      .catch(e => { setErr(e.message); setLoading(false) })
  }, [])

  useEffect(() => { fetchZones() }, [fetchZones])

  // ── Load Google Maps ────────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsLoaded(true))
      .catch(e => setMapsErr(e.message))
  }, [])

  // ── Init map once Maps is ready and div is mounted ──────────────────────
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapObj.current) return
    const gm = window.google.maps
    mapObj.current = new gm.Map(mapRef.current, {
      center: { lat: 22.5726, lng: 88.3639 },  // Kolkata default
      zoom: 10,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#0e1a0e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#a9c2a9' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0a1f12' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f3a29' }] },
        { featureType: 'water', stylers: [{ color: '#06231a' }] },
      ],
    })

  }, [mapsLoaded])

  // ── Init Places Autocomplete separately so the input ref is guaranteed ──
  useEffect(() => {
    if (!mapsLoaded || !mapObj.current || !searchInputRef.current || autocompleteRef.current) return
    const gm = window.google.maps
    if (!gm.places) return

    autocompleteRef.current = new gm.places.Autocomplete(searchInputRef.current, {
      fields: ['geometry', 'name'],
    })
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace()
      if (!place.geometry?.location) return
      const lat = place.geometry.location.lat()
      const lng = place.geometry.location.lng()
      mapObj.current.panTo({ lat, lng })
      mapObj.current.setZoom(12)
    })
  }, [mapsLoaded])

  // ── Draw saved zones on map when both are ready ──────────────────────────
  useEffect(() => {
    if (!mapObj.current || zones.length === 0) return
    const gm = window.google.maps

    zones.forEach(zone => {
      if (polygonsRef.current[zone.id]) return  // already drawn
      const path = zone.vertices.map(v => ({ lat: v.lat, lng: v.lng }))
      const poly = new gm.Polygon({
        paths: path,
        strokeColor: '#00c853',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#00c853',
        fillOpacity: 0.18,
        map: mapObj.current,
      })
      polygonsRef.current[zone.id] = poly
    })

    // Remove polygons for deleted zones
    Object.keys(polygonsRef.current).forEach(id => {
      if (!zones.find(z => z.id === id)) {
        polygonsRef.current[id].setMap(null)
        delete polygonsRef.current[id]
      }
    })
  }, [zones, mapsLoaded])

  // ── Click-to-place mode ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapObj.current) return
    const gm = window.google.maps

    if (clickListenerRef.current) {
      gm.event.removeListener(clickListenerRef.current)
      clickListenerRef.current = null
    }

    if (!placing) return

    clickListenerRef.current = mapObj.current.addListener('click', (e) => {
      const clat = e.latLng.lat()
      const clng = e.latLng.lng()

      // Remove previous pending polygon
      if (pendingRef.current?.polygon) {
        pendingRef.current.polygon.setMap(null)
      }

      const verts = hexVertices(clat, clng, radius)
      const path = verts.map(v => ({ lat: v.lat, lng: v.lng }))
      const poly = new gm.Polygon({
        paths: path,
        strokeColor: '#f1c40f',
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: '#f1c40f',
        fillOpacity: 0.22,
        map: mapObj.current,
      })

      pendingRef.current = { polygon: poly, centerLat: clat, centerLng: clng, radiusM: radius }
      setPendingZone({ centerLat: clat, centerLng: clng, radiusM: radius })
    })
  }, [placing, radius])

  // Update pending polygon when radius slider changes
  useEffect(() => {
    if (!pendingRef.current?.polygon || !mapObj.current) return
    const { centerLat, centerLng } = pendingRef.current
    const verts = hexVertices(centerLat, centerLng, radius)
    pendingRef.current.polygon.setPaths(verts.map(v => ({ lat: v.lat, lng: v.lng })))
    pendingRef.current.radiusM = radius
    setPendingZone(prev => prev ? { ...prev, radiusM: radius } : null)
  }, [radius])

  function cancelPending() {
    if (pendingRef.current?.polygon) {
      pendingRef.current.polygon.setMap(null)
      pendingRef.current = null
    }
    setPendingZone(null)
    setPlacing(false)
    setZoneName('')
  }

  async function confirmZone() {
    if (!pendingRef.current) return
    const { centerLat, centerLng, radiusM } = pendingRef.current
    const name = zoneName.trim() || `Zone ${zones.length + 1}`
    const vertices = hexVertices(centerLat, centerLng, radiusM)
    setSaving(true); setErr(''); setMsg('')
    try {
      const created = await api.post('/api/coverage/zones', {
        name, vertices, centerLat, centerLng, radiusMeters: radiusM,
      })
      setZones(prev => [...prev, created])
      setMsg(`Zone "${name}" saved.`)
      // Turn the pending yellow hex green
      if (pendingRef.current?.polygon) {
        pendingRef.current.polygon.setOptions({ strokeColor: '#00c853', fillColor: '#00c853', fillOpacity: 0.18 })
        polygonsRef.current[created.id] = pendingRef.current.polygon
        pendingRef.current = null
      }
      setPendingZone(null)
      setPlacing(false)
      setZoneName('')
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteZone(id) {
    if (!window.confirm('Delete this zone?')) return
    setErr(''); setMsg('')
    try {
      await api.del(`/api/coverage/zones/${id}`)
      if (polygonsRef.current[id]) {
        polygonsRef.current[id].setMap(null)
        delete polygonsRef.current[id]
      }
      setZones(prev => prev.filter(z => z.id !== id))
      setMsg('Zone deleted.')
    } catch (e) {
      setErr(e.message)
    }
  }

  function panToZone(zone) {
    if (!mapObj.current) return
    mapObj.current.panTo({ lat: zone.centerLat, lng: zone.centerLng })
    mapObj.current.setZoom(12)
  }

  return (
    <div className="page">
      <h1>Service Coverage Zones</h1>
      <p className="muted">
        Click <strong>Place Hexagon</strong>, then tap the map to define a service area.
        Only users with a delivery address inside an active zone can order.
      </p>

      {err && <p className="err">{err}</p>}
      {msg && <p className="ok">{msg}</p>}

      {/* Controls row */}
      <div className="row" style={{ marginBottom: 14, gap: 10 }}>
        {!placing ? (
          <button className="primary" onClick={() => { setPlacing(true); setMsg('') }}>
            + Place Hexagon
          </button>
        ) : (
          <>
            <button className="red sm" onClick={cancelPending}>Cancel</button>
            <span className="muted" style={{ fontSize: 13 }}>Click map to place · adjust radius below</span>
          </>
        )}
      </div>

      {/* Radius slider — visible while placing */}
      {placing && (
        <div className="panel" style={{ maxWidth: 460, marginBottom: 14 }}>
          <label>
            Hexagon radius: <strong>{(radius / 1000).toFixed(1)} km</strong>
          </label>
          <input
            type="range" min={500} max={50000} step={500}
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            style={{ width: '100%', marginTop: 6 }}
          />

          {pendingZone && (
            <>
              <label style={{ marginTop: 12 }}>Zone name</label>
              <input
                value={zoneName}
                placeholder={`Zone ${zones.length + 1}`}
                onChange={e => setZoneName(e.target.value)}
              />
              <div className="row" style={{ marginTop: 12 }}>
                <button className="primary" disabled={saving} onClick={confirmZone}>
                  {saving ? 'Saving…' : 'Confirm & Save Zone'}
                </button>
                <button className="sm" onClick={cancelPending}>Discard</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Map search */}
      {!mapsErr && (
        <div style={{ marginBottom: 8, maxWidth: 400 }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search location…"
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Map */}
      {mapsErr ? (
        <div className="panel">
          <p className="err">{mapsErr}</p>
          <p className="muted" style={{ fontSize: 12 }}>
            Add your Google Maps key as <code>VITE_GOOGLE_MAPS_KEY</code> in the Super-Admin .env file.
          </p>
        </div>
      ) : (
        <div
          ref={mapRef}
          style={{
            width: '100%', height: 500, borderRadius: 12,
            border: '1px solid var(--border)', marginBottom: 20,
            background: '#0e1a0e',
          }}
        />
      )}

      {/* Saved zones list */}
      <h2 style={{ marginTop: 8 }}>Saved Zones ({zones.length})</h2>
      {loading ? (
        <Loading />
      ) : zones.length === 0 ? (
        <p className="muted">No zones yet. Place a hexagon on the map above.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Centre</th>
                <th>Radius</th>
                <th>Created</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {zones.map(z => (
                <tr key={z.id}>
                  <td><strong>{z.name}</strong></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {z.centerLat.toFixed(4)}, {z.centerLng.toFixed(4)}
                  </td>
                  <td>{(z.radiusMeters / 1000).toFixed(1)} km</td>
                  <td style={{ fontSize: 12 }}>{fmtTime(z.createdAtMillis)}</td>
                  <td>
                    <span className={`badge ${z.active ? 'green' : 'grey'}`}>
                      {z.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="sm" onClick={() => panToZone(z)}>View</button>
                      <button className="sm red" onClick={() => deleteZone(z.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
