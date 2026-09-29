import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts'
import { api } from '../api.js'
import { Loading, ErrorNote } from '../components/Helpers.jsx'

// Super-Admin only. Two sub-tabs:
//   • Money & Transactions — live totals, themed charts, realtime feed
//   • Reports — generate & download professional Excel workbooks
const PERIODS = [
  { v: 'hour', label: 'This hour' },
  { v: 'day', label: 'Today' },
  { v: 'week', label: 'This week' },
  { v: 'month', label: 'This month' },
  { v: 'fy', label: 'This FY' },
]
const GRANS = ['hour', 'day', 'week', 'month', 'fy']

// Palette tuned for the dark-green theme.
const PIE_COLORS = ['#00c853', '#26c6da', '#f1c40f', '#ff8a65', '#ba68c8']
const AXIS = { tick: { fill: '#a9c2a9', fontSize: 11 }, stroke: '#1f3a29' }
const GRID = '#16301f'
const TIP = {
  contentStyle: { background: '#0e1a0e', border: '1px solid #1f3a29', borderRadius: 8, color: '#eaf3ea' },
  labelStyle: { color: '#a9c2a9' }, itemStyle: { color: '#eaf3ea' },
}
const LEGEND = { wrapperStyle: { color: '#a9c2a9', fontSize: 12 } }

const inr = (n) => `${n < 0 ? '-' : ''}₹${Math.abs(Math.round(n || 0)).toLocaleString('en-IN')}`

function Kpi({ label, value, tone }) {
  const color = tone === 'bad' ? '#ff7b76' : tone === 'good' ? '#00c853' : '#d6ffe6'
  return (
    <div className="card">
      <div className="value" style={{ color }}>{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}

function Panel({ title, right, children }) {
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
        {right}
      </div>
      {children}
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

  const pie = useMemo(() => (breakdown?.slices || []).filter((s) => s.value > 0), [breakdown])

  return (
    <div className="page">
      <h1>Finance</h1>
      <p className="muted">Every rupee moving through WIMM — live. Super Admin only.</p>

      <div className="row" style={{ gap: 8, marginBottom: 18 }}>
        <button className={tab === 'money' ? 'primary' : ''} onClick={() => setTab('money')}>Money &amp; Transactions</button>
        <button className={tab === 'reports' ? 'primary' : ''} onClick={() => setTab('reports')}>Reports</button>
        <span style={{ flex: 1 }} />
        <select style={{ width: 150 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
        </select>
      </div>

      {err && <ErrorNote error={err} />}

      {tab === 'money' && (!summary ? <Loading /> : (
        <>
          <div className="cards">
            <Kpi label="Revenue" value={inr(summary.revenue)} tone="good" />
            <Kpi label="Profit" value={inr(summary.profit)} tone={summary.profit < 0 ? 'bad' : 'good'} />
            <Kpi label="Loss" value={inr(summary.loss)} tone={summary.loss > 0 ? 'bad' : undefined} />
            <Kpi label="Order GMV" value={inr(summary.gmv)} />
            <Kpi label="GST (18%)" value={inr(summary.gst)} />
            <Kpi label="Refunds" value={inr(summary.refunds)} tone={summary.refunds > 0 ? 'bad' : undefined} />
          </div>

          <div className="row" style={{ gap: 18, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 340px', minWidth: 320 }}>
              <Panel title="Where the money comes from">
                {pie.length === 0 ? <p className="muted">No inflows in this period.</p> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pie} dataKey="value" nameKey="name" outerRadius={100} innerRadius={48}
                        paddingAngle={2} stroke="#0e1a0e">
                        {pie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip {...TIP} formatter={(v) => inr(v)} />
                      <Legend {...LEGEND} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Panel>
            </div>

            <div style={{ flex: '1 1 440px', minWidth: 360 }}>
              <Panel
                title={`Trend by ${gran}`}
                right={<select style={{ width: 110 }} value={gran} onChange={(e) => setGran(e.target.value)}>
                  {GRANS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="bucket" {...AXIS} />
                    <YAxis {...AXIS} />
                    <Tooltip {...TIP} formatter={(v) => inr(v)} cursor={{ fill: 'rgba(0,200,83,0.06)' }} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="revenue" name="Revenue" fill="#00c853" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="gmv" name="GMV" fill="#26c6da" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="refunds" name="Refunds" fill="#e53935" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          </div>

          <Panel title="Revenue vs Profit over time">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="bucket" {...AXIS} />
                <YAxis {...AXIS} />
                <Tooltip {...TIP} formatter={(v) => inr(v)} />
                <Legend {...LEGEND} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#00c853" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#f1c40f" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '4px 2px 8px' }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Live transactions</h3>
            <span className="badge green">● live · refreshes 12s · {tx.length} shown</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Type</th><th>Flow</th><th>Party</th><th>Amount</th><th>Reference</th></tr></thead>
              <tbody>
                {tx.length === 0 && <tr><td colSpan={6} className="muted">No transactions in this period.</td></tr>}
                {tx.map((t, i) => (
                  <tr key={i}>
                    <td className="muted">{new Date(t.at).toLocaleString('en-IN')}</td>
                    <td>{t.type}</td>
                    <td><span className={`badge ${t.direction === 'out' ? 'red' : 'green'}`}>{t.direction === 'out' ? 'OUT' : 'IN'}</span></td>
                    <td>{t.party || '—'}</td>
                    <td style={{ fontWeight: 700, color: t.direction === 'out' ? '#ff7b76' : '#d6ffe6' }}>{inr(t.amount)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{t.ref || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ))}

      {tab === 'reports' && (
        <div style={{ maxWidth: 760 }}>
          <p className="muted">Generate professional Excel workbooks. Choose the period (top-right) and the breakdown granularity, then download.</p>
          <div className="row" style={{ gap: 10, margin: '12px 0 18px' }}>
            <label style={{ margin: 0 }}>Breakdown granularity</label>
            <select style={{ width: 130 }} value={gran} onChange={(e) => setGran(e.target.value)}>
              {GRANS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
            {[
              ['budget', 'Budget'], ['profit', 'Profit'], ['loss', 'Loss'],
              ['tax', 'Tax'], ['gst', 'GST'], ['all', 'Everything'],
            ].map(([type, label]) => (
              <button key={type} className={type === 'all' ? 'primary' : ''} style={{ padding: '16px', justifyContent: 'center' }}
                onClick={() => exportXlsx(type)} disabled={!!busy}>
                {busy === type ? 'Preparing…' : `⬇  ${label}`}
              </button>
            ))}
          </div>
          <div className="panel" style={{ marginTop: 20 }}>
            <h3 style={{ marginTop: 0 }}>What's inside each workbook</h3>
            <ul className="muted" style={{ lineHeight: 1.8, margin: 0 }}>
              <li><b style={{ color: '#d6ffe6' }}>Budget</b> — cover page with KPIs, full income &amp; expense statement, and a per-{gran} breakdown.</li>
              <li><b style={{ color: '#d6ffe6' }}>Profit / Loss</b> — a clean P&amp;L (loss shown negative / on its own line).</li>
              <li><b style={{ color: '#d6ffe6' }}>Tax / GST</b> — taxable value and the 18% GST component of revenue.</li>
              <li><b style={{ color: '#d6ffe6' }}>Everything</b> — all sheets above + the full transaction ledger, in one file.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
