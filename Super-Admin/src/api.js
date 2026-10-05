// Tiny fetch wrapper that injects the JWT and centralises error handling.
// API base: VITE_API_URL in production (Render), or "" locally (Vite proxies /api).
const BASE = import.meta.env.VITE_API_URL || ''

const TOKEN_KEY = 'wimm_admin_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && token) {
    setToken(null)
    if (!path.includes('/auth/login')) window.location.href = '/login'
  }

  let data = null
  const text = await res.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  if (!res.ok) {
    const msg = (data && data.detail) || res.statusText || 'Request failed'
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  download,
  upload,
}

// Upload a file via multipart/form-data with auth; returns the parsed JSON.
async function upload(path, file, field = 'file') {
  const token = getToken()
  const form = new FormData()
  form.append(field, file)
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const text = await res.text()
  let data = null
  if (text) { try { data = JSON.parse(text) } catch { data = text } }
  if (!res.ok) {
    const msg = (data && data.detail) || res.statusText || 'Upload failed'
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

// Fetch a file (e.g. an Excel export) with auth and trigger a browser download.
async function download(path, fallbackName = 'download') {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || res.statusText || 'Download failed')
  }
  const cd = res.headers.get('Content-Disposition') || ''
  const m = cd.match(/filename="?([^"]+)"?/)
  const name = m ? m[1] : fallbackName
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}
