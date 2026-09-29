import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts'
import { api } from '../api.js'
import { Loading, ErrorNote } from '../components/Helpers.jsx'

// Super-Admin only. Two sub-tabs:
//   • Money & Transactions — live totals, charts, realtime transaction feed
//   • Reports — generate & download formatted Excel (budget/profit/loss/tax/gst/all)
const PERIODS = [
  { v: 'hour', label: 'This hour' },
  { v: 'day', label: 'Today' },
  { v: 'week', label: 'This week' },
  { v: 'month', label: 'This month' },
  { v: 'fy', label: 'This FY' },
]
const GRANS = ['hour', 'day', 'week', 'month', 'fy']
const COLORS = ['#0E7C66', '#2F9E44', '#4C6EF5', '#F59F00', '#E8590C', '#AE3EC9']

const inr = (n) => `${n < 0 ? '-' : ''}₹${Math.abs(Math.round(n || 0)).toLocaleString('en-IN')}`

function Card({ label, value, tone }) {
  const color = tone === 'bad' ? '#E03131' : tone === 'good' ? '#0E7C66' : 'inherit'
  return (
    <div style={{
      flex: '1 1 150px', minWidth: 150, background: 'var(--card, #fff)',
      border: '1px solid var(--line, #e5e7eb)', borderRadius: 14, padding: '14px 16px',
    }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

export default function Finance() {
  const [tab, setTab] = useState('money')       // 'money' | 'reports'
  const [period, setPeriod] = useState('month')
  const [gran, setGran] = useState('day')
  const [summary, setSummary] = useState(null)
  const [series, setSeries] = useState([])
  const [breakdown, setBreakdown] = useState(null)
  const [tx, setTx] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')

  function loadMoney() {
    setErr('')
    api.get(`/api/finance/summary?period=${period}`).then(setSummary).catch((e) => setErr(e.message))
    api.get(`/api/finance/breakdown?period=${period}`).then(setBreakdown).catch(() => {})
    api.get(`/api/finance/timeseries?granularity=${gran}&period=${period}`).then((d) => setSeries(d.points || [])).catch(() => {})
    api.get(`/api/finance/transactions?period=${period}&limit=200`).then((d) => setTx(d.transactions || [])).catch(() => {})
  }

  useEffect(() => { loadMoney() /* eslint-disable-next-line */ }, [period, gran])

  // Realtime: refresh the money tab every 12s.
  useEffect(() => {
    if (tab !== 'money') return
    const id = setInterval(loadMoney, 12000)
    return () => clearInterval(id)
    // eslint-disable-next-line
  }, [tab, period, gran])

  async function exportXlsx(type) {
    setBusy(type); setErr('')
    try {
      await api.download(`/api/finance/export?type=${type}&granularity=${gran}&period=${period}`, `wimm_${type}.xlsx`)
    } catch (e) { setErr(e.message) } finally { setBusy('') }
  }

  const pie = useMemo(
    () => (breakdown?.slices || []).filter((s) => s.value > 0),
    [breakdown],
  )

  return (
    <div className="page">
      <h1>Finance</h1>
      <p className="muted">Every rupee moving through WIMM — live. Super Admin only.</p>

      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className={tab === 'money' ? '' : 'sm'} onClick={() => setTab('money')}>Money &amp; Transactions</button>
        <button className={tab === 'reports' ? '' : 'sm'} onClick={() => setTab('reports')}>Reports</button>
        <span style={{ flex: 1 }} />
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
        </select>
      </div>

      {err && <ErrorNote error={err} />}

      {tab === 'money' && (!summary ? <Loading /> : (
        <>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <Card label="Revenue" value={inr(summary.revenue)} tone="good" />
            <Card label="Profit" value={inr(summary.profit)} tone={summary.profit < 0 ? 'bad' : 'good'} />
            <Card label="Loss" value={inr(summary.loss)} tone={summary.loss > 0 ? 'bad' : undefined} />
            <Card label="Order GMV" value={inr(summary.gmv)} />
            <Card label={`GST (18%)`} value={inr(summary.gst)} />
            <Card label="Refunds" value={inr(summary.refunds)} tone={summary.refunds > 0 ? 'bad' : undefined} />
          </div>

          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 340px', minWidth: 320, background: 'var(--card,#fff)', border: '1px solid var(--line,#e5e7eb)', borderRadius: 14, padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>Where the money comes from</h3>
              {pie.length === 0 ? <p className="muted">No inflows in this period.</p> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" outerRadius={100} label={(e) => e.name}>
                      {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => inr(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ flex: '1 1 420px', minWidth: 340, background: 'var(--card,#fff)', border: '1px solid var(--line,#e5e7eb)', borderRadius: 14, padding: 16 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ marginTop: 0 }}>Trend by {gran}</h3>
                <select value={gran} onChange={(e) => setGran(e.target.value)}>
                  {GRANS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => inr(v)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#0E7C66" />
                  <Bar dataKey="gmv" name="GMV" fill="#4C6EF5" />
                  <Bar dataKey="refunds" name="Refunds" fill="#E03131" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ marginTop: 16, background: 'var(--card,#fff)', border: '1px solid var(--line,#e5e7eb)', borderRadius: 14, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Revenue vs Profit over time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => inr(v)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0E7C66" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#F59F00" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: '8px 0' }}>Live transactions</h3>
              <span className="muted" style={{ fontSize: 12 }}>● auto-refreshing every 12s · {tx.length} shown</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Time</th><th>Type</th><th>In/Out</th><th>Party</th><th>Amount</th><th>Ref</th></tr></thead>
                <tbody>
                  {tx.length === 0 && <tr><td colSpan={6} className="muted">No transactions in this period.</td></tr>}
                  {tx.map((t, i) => (
                    <tr key={i}>
                      <td>{new Date(t.at).toLocaleString('en-IN')}</td>
                      <td>{t.type}</td>
                      <td style={{ color: t.direction === 'out' ? '#E03131' : '#0E7C66' }}>{t.direction === 'out' ? 'OUT' : 'IN'}</td>
                      <td>{t.party || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{inr(t.amount)}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{t.ref || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ))}

      {tab === 'reports' && (
        <div style={{ maxWidth: 720 }}>
          <p className="muted">Generate neatly-formatted Excel workbooks. Pick the period (above) and the breakdown granularity, then download.</p>
          <div className="row" style={{ gap: 10, alignItems: 'center', margin: '10px 0 18px' }}>
            <label>Breakdown granularity:</label>
            <select value={gran} onChange={(e) => setGran(e.target.value)}>
              {GRANS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {[
              ['budget', 'Budget'], ['profit', 'Profit'], ['loss', 'Loss'],
              ['tax', 'Tax'], ['gst', 'GST'], ['all', 'Everything (all sheets)'],
            ].map(([type, label]) => (
              <button key={type} onClick={() => exportXlsx(type)} disabled={!!busy}>
                {busy === type ? 'Preparing…' : `⬇ ${label}`}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 20, background: 'var(--card,#fff)', border: '1px solid var(--line,#e5e7eb)', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>What's inside</h3>
            <ul className="muted" style={{ lineHeight: 1.7 }}>
              <li><b>Budget</b> — revenue, GMV, delivery, refunds, expenses, net profit & loss, plus a per-{gran} breakdown.</li>
              <li><b>Profit</b> / <b>Loss</b> — P&amp;L statement (loss shown as a negative / dedicated loss line).</li>
              <li><b>Tax</b> / <b>GST</b> — taxable value and 18% GST component of revenue.</li>
              <li><b>Everything</b> — all of the above as separate sheets + full transaction ledger, in one file.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
