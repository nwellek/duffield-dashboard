import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { B, hf, bf, SCORING_PARAMS, MAX_SCORE, MARKETS } from '../lib/brand'

const TABS = [
  { id: 'access', label: 'Access & permissions' },
  { id: 'tools', label: 'Tools' },
  { id: 'scoring', label: 'Scoring model' },
  { id: 'markets', label: 'Markets' },
  { id: 'api', label: 'Bot API' },
  { id: 'grades', label: 'Grade legend' },
]

const ALLOWED_USERS = [
  { email: 'nwellek@gmail.com', name: 'Nate Wellek', role: 'Owner', access: 'Full access — all tabs, settings, API' },
  { email: 'nwellek@duffieldholdings.com', name: 'Nate Wellek', role: 'Owner', access: 'Full access — all tabs, settings, API' },
  { email: 'johnson.wes333@gmail.com', name: 'Wes Johnson', role: 'Member', access: 'All tabs except Treasury' },
]

const BOT_USERS = [
  { name: 'Mac Mini — Claude Code', type: 'Bot', access: 'API only — /api/deals, /api/alerts, /api/activity, /api/summary', status: 'Active' },
]

function ToolsPanel() {
  const [geoStatus, setGeoStatus] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)

  const runGeocode = async () => {
    setGeoLoading(true); setGeoStatus(null)
    try {
      const res = await fetch('/api/geocode')
      const data = await res.json()
      setGeoStatus(data)
    } catch (e) { setGeoStatus({ error: e.message }) }
    setGeoLoading(false)
  }

  const runGeocodeAll = async () => {
    setGeoLoading(true); setGeoStatus(null)
    let total = 0, remaining = 1
    while (remaining > 0) {
      try {
        const res = await fetch('/api/geocode?limit=25')
        const data = await res.json()
        total += data.processed || 0
        remaining = data.remaining || 0
        setGeoStatus({ message: `Processed ${total} deals, ${remaining} remaining...` })
        if ((data.processed || 0) === 0) break
      } catch (e) { setGeoStatus({ error: e.message }); break }
    }
    setGeoStatus({ message: `Done! Geocoded ${total} deals total.`, remaining: 0 })
    setGeoLoading(false)
  }

  return (
    <div>
      <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}`, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>Geocoding</div>
        <div style={{ fontSize: 12, color: B.gray, fontFamily: bf, marginBottom: 10 }}>Find latitude/longitude for deals that have addresses but no coordinates. Uses OpenStreetMap Nominatim (free, 1 req/sec).</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={runGeocode} disabled={geoLoading} style={{ padding: '8px 16px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: geoLoading ? 'default' : 'pointer', fontFamily: hf, opacity: geoLoading ? 0.6 : 1 }}>
            {geoLoading ? 'Running...' : 'Geocode batch (25)'}
          </button>
          <button onClick={runGeocodeAll} disabled={geoLoading} style={{ padding: '8px 16px', background: '#065F46', color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: geoLoading ? 'default' : 'pointer', fontFamily: hf, opacity: geoLoading ? 0.6 : 1 }}>
            {geoLoading ? 'Running...' : 'Geocode ALL deals'}
          </button>
        </div>
        {geoStatus && (
          <div style={{ padding: '8px 12px', background: geoStatus.error ? B.redLight : '#D1FAE5', borderRadius: 3, fontSize: 12, fontFamily: bf, color: geoStatus.error ? B.redDark : '#065F46' }}>
            {geoStatus.error || geoStatus.message || `Processed: ${geoStatus.processed || 0} | Found: ${geoStatus.found || 0} | Remaining: ${geoStatus.remaining || 0}`}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SettingsTab() {
  const { data: session } = useSession()
  const [tab, setTab] = useState('access')

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 14, borderBottom: `2px solid ${B.gray20}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '6px 14px', fontSize: 11, fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? B.blue : B.gray, background: 'transparent', border: 'none',
            borderBottom: tab === t.id ? `2px solid ${B.blue}` : '2px solid transparent',
            cursor: 'pointer', marginBottom: -2, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Access & Permissions */}
      {tab === 'access' && (
        <div>
          {/* Current session */}
          <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}`, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 10 }}>Current session</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: B.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: B.white, fontFamily: hf }}>
                {session?.user?.name ? session.user.name.split(' ').map(w => w[0]).join('').slice(0, 2) : 'NW'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: B.black, fontFamily: hf }}>{session?.user?.name || 'Nate Wellek'}</div>
                <div style={{ fontSize: 12, color: B.gray, fontFamily: bf }}>{session?.user?.email || 'nwellek@gmail.com'}</div>
              </div>
              <div style={{ marginLeft: 'auto', padding: '3px 10px', background: B.greenLight, borderRadius: 3, fontSize: 11, color: B.greenDark, fontWeight: 600, fontFamily: bf }}>Active</div>
            </div>
          </div>

          {/* Authorized users */}
          <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}`, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>Authorized users</div>
            <div style={{ fontSize: 12, color: B.gray, fontFamily: bf, marginBottom: 12 }}>Only these Google accounts can sign in. To add someone, update the ALLOWED_EMAILS array in <code style={{ fontSize: 11, background: B.gray10, padding: '1px 4px', borderRadius: 2 }}>pages/api/auth/[...nextauth].js</code></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ALLOWED_USERS.map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: B.blue05, borderRadius: 4, border: `1px solid ${B.blue20}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: B.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: B.white, fontFamily: hf }}>
                    {u.name.split(' ').map(w => w[0]).join('')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: B.black, fontFamily: hf }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{u.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: B.blue, fontFamily: hf }}>{u.role}</div>
                    <div style={{ fontSize: 10, color: B.gray60, fontFamily: bf }}>{u.access}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, padding: 12, background: B.gray10, borderRadius: 4, fontSize: 12, color: B.gray, fontFamily: bf }}>
              <div style={{ fontWeight: 600, color: B.black, marginBottom: 4, fontFamily: hf }}>How to add a new user</div>
              <div>1. Open <code style={{ fontSize: 11, background: B.white, padding: '1px 4px', borderRadius: 2 }}>pages/api/auth/[...nextauth].js</code> on GitHub</div>
              <div>2. Add their Gmail address to the ALLOWED_EMAILS array</div>
              <div>3. Commit — Vercel auto-deploys and they can sign in</div>
            </div>
          </div>

          {/* Bot access */}
          <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}`, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>Bot / API access</div>
            <div style={{ fontSize: 12, color: B.gray, fontFamily: bf, marginBottom: 12 }}>Systems that can read/write data via the API endpoints. API routes are open (no auth token required) — they rely on Supabase RLS policies.</div>

            {BOT_USERS.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: B.blue05, borderRadius: 4, border: `1px solid ${B.blue20}`, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: B.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: B.white, fontFamily: hf }}>B</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: B.black, fontFamily: hf }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{b.access}</div>
                </div>
                <div style={{ padding: '3px 10px', background: b.status === 'Active' ? B.greenLight : B.gray10, borderRadius: 3, fontSize: 11, color: b.status === 'Active' ? B.greenDark : B.gray, fontWeight: 600, fontFamily: bf }}>{b.status}</div>
              </div>
            ))}

            <div style={{ marginTop: 8, padding: 12, background: B.gray10, borderRadius: 4, fontSize: 12, color: B.gray, fontFamily: bf }}>
              <div style={{ fontWeight: 600, color: B.black, marginBottom: 4, fontFamily: hf }}>Security note</div>
              <div>API endpoints are currently open (no API key required). This is fine for now since the data is non-sensitive deal pipeline info. To add API key auth later, add a middleware check against an <code style={{ fontSize: 11, background: B.white, padding: '1px 4px', borderRadius: 2 }}>X-API-Key</code> header in each route.</div>
            </div>
          </div>

          {/* Auth provider info */}
          <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 10 }}>Authentication setup</div>
            {[
              { label: 'Provider', value: 'Google OAuth 2.0' },
              { label: 'Auth library', value: 'NextAuth.js v4' },
              { label: 'Sign-in page', value: '/auth/signin' },
              { label: 'Access denied page', value: '/auth/denied' },
              { label: 'Session storage', value: 'JWT (cookie-based, no database session)' },
              { label: 'Google Cloud project', value: 'Same project as Candyroot dashboard' },
              { label: 'Env variables needed', value: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
                <span style={{ color: B.gray }}>{item.label}</span>
                <span style={{ color: B.black, fontWeight: 500, textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tools */}
      {tab === 'tools' && <ToolsPanel />}

      {/* Scoring Model */}
      {tab === 'scoring' && (
        <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>Scoring model</div>
          <div style={{ fontSize: 12, color: B.gray, fontFamily: bf, marginBottom: 10 }}>Max score: {MAX_SCORE} points. A+ (90+) Excellent auto-LOI. A (80+) Great strong pursuit. B (60-79) Worth a look. C (40-59) Below threshold. D (0-39) Pass.</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Parameter', 'Direction', 'Threshold', 'Weight', 'Unit'].map(h => (
                <th key={h} style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', padding: '5px 6px', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {SCORING_PARAMS.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12, fontWeight: 600, color: B.black, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf }}>{p.label}</td>
                  <td style={{ fontSize: 11, color: B.gray, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{p.dir === 'low' ? 'Lower is better' : p.dir === 'high' ? 'Higher is better' : p.dir === 'range' ? 'In range' : 'Neutral'}</td>
                  <td style={{ fontSize: 11, color: B.gray80, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>
                    {p.dir === 'low' && `Max ${p.max}`}{p.dir === 'high' && `Min ${p.min}`}{p.dir === 'range' && `${p.min} - ${p.max}`}{p.dir === 'neutral' && `${p.min}+`}
                  </td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: B.blue, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf }}>{p.weight}</td>
                  <td style={{ fontSize: 11, color: B.gray60, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{p.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Markets */}
      {tab === 'markets' && (
        <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 10 }}>Target markets</div>
          <div style={{ fontSize: 12, color: B.gray, fontFamily: bf, marginBottom: 12 }}>Markets are defined in <code style={{ fontSize: 11, background: B.gray10, padding: '1px 4px', borderRadius: 2 }}>lib/brand.js</code> — update MARKETS and MARKET_COORDS to add new ones.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MARKETS.filter(m => m !== 'Other').map(m => (
              <span key={m} style={{ padding: '6px 12px', background: B.blue05, borderRadius: 3, fontSize: 12, color: B.blue, fontFamily: bf, border: `1px solid ${B.blue20}` }}>{m}</span>
            ))}
          </div>
        </div>
      )}

      {/* Bot API */}
      {tab === 'api' && (
        <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>Bot API endpoints</div>
          <div style={{ fontSize: 12, color: B.gray, fontFamily: bf, marginBottom: 8 }}>For your Mac Mini Claude Code agent.</div>

          {[
            { method: 'GET', path: '/api/summary', desc: 'Pipeline snapshot for daily briefing: counts, pipeline value, stale deals, recent activity' },
            { method: 'GET', path: '/api/deals', desc: 'Fetch deals. Query: ?status=pursuit&market=Louisville%20KY' },
            { method: 'POST', path: '/api/deals', desc: 'Create a deal. Body: { address, city, state, market, status, ... }' },
            { method: 'PATCH', path: '/api/deals', desc: 'Update a deal. Body: { id, status: "loi_sent", notes: "..." }' },
            { method: 'GET', path: '/api/alerts', desc: 'Fetch alerts. Query: ?status=new' },
            { method: 'POST', path: '/api/alerts', desc: 'Push listing alerts. Body: { alerts: [{ source, address, ... }] }' },
            { method: 'GET', path: '/api/activity', desc: 'Get activity log. Query: ?deal_id=uuid' },
            { method: 'POST', path: '/api/activity', desc: 'Log activity. Body: { deal_id, type: "call", content: "..." }' },
          ].map((ep, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${B.gray10}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ padding: '1px 6px', borderRadius: 2, fontSize: 10, fontWeight: 700, fontFamily: hf, background: ep.method === 'GET' ? B.greenLight : ep.method === 'POST' ? B.blue10 : B.amberLight, color: ep.method === 'GET' ? B.greenDark : ep.method === 'POST' ? B.blue : B.amberDark }}>{ep.method}</span>
                <code style={{ fontSize: 12, color: B.black, fontFamily: "'Fira Mono', monospace" }}>{ep.path}</code>
              </div>
              <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, paddingLeft: 2 }}>{ep.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Grade Legend */}
      {tab === 'grades' && (
        <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 10 }}>Grade legend</div>
          {[
            { grade: 'A+', range: '90-100', action: 'Excellent — auto-LOI, fire immediately', color: '#10B981', bg: '#D1FAE5' },
            { grade: 'A', range: '80-89', action: 'Great — strong pursuit, prioritize', color: B.green, bg: B.greenLight },
            { grade: 'B', range: '60-79', action: 'Worth a look — manual review, dig deeper', color: B.amber, bg: B.amberLight },
            { grade: 'C', range: '40-59', action: 'Below threshold — needs a compelling story', color: B.blue, bg: B.blue10 },
            { grade: 'D', range: '0-39', action: 'Pass — doesn\'t pencil', color: B.red, bg: B.redLight },
          ].map(g => (
            <div key={g.grade} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${B.gray10}` }}>
              <span style={{ width: 32, height: 32, borderRadius: 3, background: g.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, fontFamily: hf, color: g.color }}>{g.grade}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: B.black, fontFamily: hf }}>{g.range} points</div>
                <div style={{ fontSize: 12, color: B.gray, fontFamily: bf }}>{g.action}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
