import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, COLUMNS, scoreDeal, gradeColor, fmt, Badge } from '../lib/brand'

export default function DailyBriefTab({ deals }) {
  const [alerts, setAlerts] = useState([])
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [recurring, setRecurring] = useState([])
  const [accounts, setAccounts] = useState([])

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase.from('deal_alerts').select('*').eq('status', 'new').order('created_at', { ascending: false }).limit(20)
    if (data) setAlerts(data)
  }, [])
  const fetchTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').neq('status', 'done').order('due_date')
    if (data) setTasks(data)
  }, [])
  const fetchActivity = useCallback(async () => {
    const { data } = await supabase.from('deal_activity').select('*').order('created_at', { ascending: false }).limit(10)
    if (data) setActivities(data)
  }, [])
  const fetchRecurring = useCallback(async () => {
    const { data } = await supabase.from('recurring_expenses').select('*').eq('is_active', true)
    if (data) setRecurring(data)
  }, [])
  const fetchAccounts = useCallback(async () => {
    const { data } = await supabase.from('bank_accounts').select('*')
    if (data) setAccounts(data)
  }, [])

  useEffect(() => { fetchAlerts(); fetchTasks(); fetchActivity(); fetchRecurring(); fetchAccounts() }, [fetchAlerts, fetchTasks, fetchActivity, fetchRecurring, fetchAccounts])

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Pipeline
  const owned = deals.filter(d => d.status === 'owned')
  const contract = deals.filter(d => d.status === 'under_contract')
  const loi = deals.filter(d => d.status === 'loi_sent')
  const coldLoi = deals.filter(d => d.status === 'cold_loi')
  const review = deals.filter(d => d.status === 'under_review')
  const pipeline = [...owned, ...contract, ...loi, ...review, ...coldLoi]

  // Stale deals
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const staleDeals = deals.filter(d => ['loi_sent', 'under_contract', 'cold_loi'].includes(d.status) && d.updated_at && new Date(d.updated_at) < sevenDaysAgo)

  // Overdue tasks
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date + 'T23:59:59') < today)
  const todayTasks = tasks.filter(t => t.due_date && t.due_date === today.toISOString().slice(0, 10))

  // Active markets
  const activeMarkets = [...new Set(deals.filter(d => d.status !== 'dead').map(d => d.market).filter(Boolean))]

  // Scored alerts
  const scoredAlerts = alerts.map(a => {
    const { total, grade } = scoreDeal(a)
    return { ...a, score: total, grade }
  }).sort((a, b) => b.score - a.score)
  const hotAlerts = scoredAlerts.filter(a => a.score >= 70)
  const warmAlerts = scoredAlerts.filter(a => a.score >= 50 && a.score < 70)

  // Monthly burn
  const monthlyBurn = recurring.reduce((s, r) => {
    if (r.frequency === 'monthly') return s + Number(r.amount)
    if (r.frequency === 'quarterly') return s + Number(r.amount) / 3
    if (r.frequency === 'annual') return s + Number(r.amount) / 12
    return s
  }, 0)
  const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0)

  const box = { background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}`, marginBottom: 14 }
  const secNum = (n, title) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: B.blue, color: B.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, fontFamily: hf, flexShrink: 0 }}>{n}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
    </div>
  )
  const th = { fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', padding: '5px 8px', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }
  const td = { fontSize: 12, color: B.black, padding: '6px 8px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #1C4587)', borderRadius: 6, padding: '20px 24px', marginBottom: 16, color: B.white }}>
        <div style={{ fontSize: 11, color: '#8892a4', fontFamily: bf, textTransform: 'uppercase', letterSpacing: 1 }}>Duffield Holdings</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: hf, marginBottom: 4 }}>Daily Briefing</div>
        <div style={{ fontSize: 12, color: '#8892a4', fontFamily: bf }}>{dateStr} | {activeMarkets.length} Markets Active</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { l: 'Pipeline', v: pipeline.length },
            { l: 'Owned', v: owned.length },
            { l: 'New alerts', v: alerts.length },
            { l: 'Tasks due', v: todayTasks.length + overdueTasks.length },
            { l: 'Total cash', v: totalCash > 0 ? fmt(totalCash) : '—' },
          ].map((m, i) => (
            <div key={i}>
              <div style={{ fontSize: 9, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.4 }}>{m.l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: hf }}>{m.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 1 — PIPELINE */}
      <div style={box}>
        {secNum(1, 'Pipeline')}
        {pipeline.length === 0 ? (
          <div style={{ fontSize: 12, color: B.gray40, fontFamily: bf }}>No active deals in pipeline</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Deal</th><th style={th}>Market</th><th style={th}>Status</th><th style={th}>Price</th><th style={th}>Next action</th>
            </tr></thead>
            <tbody>
              {pipeline.map(d => {
                const col = COLUMNS.find(c => c.id === d.status)
                const isStale = staleDeals.some(s => s.id === d.id)
                return (
                  <tr key={d.id} style={{ background: isStale ? '#FEF2F2' : B.white }}>
                    <td style={{ ...td, fontWeight: 600, fontFamily: hf }}>{d.address || d.city}</td>
                    <td style={{ ...td, fontSize: 11 }}>{d.market}</td>
                    <td style={td}><Badge bg={col?.color + '18'} color={col?.color}>{col?.label}</Badge></td>
                    <td style={td}>{fmt(d.asking_price)}</td>
                    <td style={{ ...td, fontSize: 11, color: isStale ? B.red : B.gray }}>
                      {isStale ? '⚠ Stale — needs update' : d.notes ? d.notes.slice(0, 50) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 2 — MARKET LISTINGS */}
      <div style={box}>
        {secNum(2, 'New listings')}
        <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 10 }}>
          Feed from deal alerts + saved searches. Future: auto-pull from Crexi/LoopNet APIs.
        </div>

        {/* Existing alerts */}
        {scoredAlerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, marginBottom: 4 }}>{hotAlerts.length} hot (70+) · {warmAlerts.length} warm (50-69) · {scoredAlerts.length} total</div>
            {scoredAlerts.slice(0, 8).map(a => {
              const g = gradeColor(a.grade)
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 4, border: `1px solid ${B.gray20}`, background: B.white }}>
                  <Badge bg={g.bg} color={g.tx} style={{ fontSize: 10, padding: '2px 6px', flexShrink: 0 }}>{a.score}</Badge>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: B.black, fontFamily: hf }}>{a.address || 'New listing'}</div>
                    <div style={{ fontSize: 10, color: B.gray, fontFamily: bf }}>{a.city}{a.market ? ' — ' + a.market : ''} {a.lot_acres ? '· ' + a.lot_acres + ' ac' : ''} {a.building_sf ? '· ' + Number(a.building_sf).toLocaleString() + ' SF' : ''}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: B.black, fontFamily: hf, flexShrink: 0 }}>{fmt(a.asking_price)}</div>
                  {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: B.blue, fontFamily: hf, textDecoration: 'none', flexShrink: 0 }}>→</a>}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: B.gray40, fontFamily: bf }}>No new listings. Set up saved searches in Crexi/LoopNet and forward alert emails to the dashboard, or use the Alerts tab to add manually.</div>
        )}

        {/* Crexi/LoopNet integration placeholder */}
        <div style={{ marginTop: 12, padding: '10px 12px', background: B.blue05, borderRadius: 4, border: `1px dashed ${B.blue20}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf }}>Listing feed integration (coming soon)</div>
          <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, marginTop: 2 }}>
            Auto-import new listings matching your criteria from Crexi and LoopNet. Target markets: {activeMarkets.slice(0, 5).join(', ')}.
            Filter: industrial, 1-10 acres, under $5M, secondary MSAs.
          </div>
        </div>
      </div>

      {/* 3 — TASKS & ACTION ITEMS */}
      <div style={box}>
        {secNum(3, 'Tasks & action items')}
        {overdueTasks.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: B.red, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>Overdue ({overdueTasks.length})</div>
            {overdueTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: `1px solid ${B.gray10}` }}>
                <span style={{ fontSize: 10, color: B.red, fontFamily: bf }}>⚠ {new Date(t.due_date + 'T12:00:00').toLocaleDateString()}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: B.black, fontFamily: bf }}>{t.title}</span>
                {t.priority === 'high' && <Badge bg="#EF444418" color="#EF4444" style={{ fontSize: 9 }}>high</Badge>}
              </div>
            ))}
          </div>
        )}
        {todayTasks.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>Due today ({todayTasks.length})</div>
            {todayTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: `1px solid ${B.gray10}` }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: B.black, fontFamily: bf }}>{t.title}</span>
                {t.category !== 'General' && <Badge bg={B.blue10} color={B.blue} style={{ fontSize: 9 }}>{t.category}</Badge>}
              </div>
            ))}
          </div>
        )}
        {tasks.filter(t => t.status === 'in_progress').length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: B.amber, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>In progress ({tasks.filter(t => t.status === 'in_progress').length})</div>
            {tasks.filter(t => t.status === 'in_progress').slice(0, 5).map(t => (
              <div key={t.id} style={{ fontSize: 12, color: B.black, fontFamily: bf, padding: '3px 0', borderBottom: `1px solid ${B.gray10}` }}>{t.title}</div>
            ))}
          </div>
        )}
        {tasks.length === 0 && <div style={{ fontSize: 12, color: B.gray40, fontFamily: bf }}>No tasks. Add tasks in the Tasks tab.</div>}
      </div>

      {/* 4 — FINANCIAL SNAPSHOT */}
      <div style={box}>
        {secNum(4, 'Financial snapshot')}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { l: 'Total cash (all accounts)', v: totalCash > 0 ? fmt(totalCash) : '—', c: B.blue },
            { l: 'Monthly burn (owned)', v: monthlyBurn > 0 ? '$' + Math.round(monthlyBurn).toLocaleString() + '/mo' : '—', c: B.red },
            { l: 'Runway', v: monthlyBurn > 0 && totalCash > 0 ? Math.round(totalCash / monthlyBurn) + ' months' : '—', c: B.green },
            { l: 'Owned properties', v: owned.length, c: B.green },
            { l: 'Active pipeline $', v: fmt(pipeline.filter(d => d.asking_price).reduce((s, d) => s + Number(d.asking_price), 0)), c: B.amber },
          ].map((m, i) => (
            <div key={i} style={{ flex: '1 1 100px', background: B.gray10, borderRadius: 4, padding: '10px 12px', minWidth: 90 }}>
              <div style={{ fontSize: 9, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>{m.l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: hf }}>{m.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 5 — TODAY'S ACTION */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #2a3f5f)', borderRadius: 6, padding: '16px 20px', color: B.white }}>
        {secNum(5, "Today's action")}
        <div style={{ fontSize: 13, color: B.white, fontFamily: bf, lineHeight: 1.6 }}>
          {staleDeals.length > 0 && <div style={{ marginBottom: 6 }}>⚠ <strong>{staleDeals.length} stale deal{staleDeals.length > 1 ? 's' : ''}</strong> need attention: {staleDeals.map(d => d.address || d.city).join(', ')}</div>}
          {overdueTasks.length > 0 && <div style={{ marginBottom: 6 }}>🔴 <strong>{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</strong> — check Tasks tab</div>}
          {hotAlerts.length > 0 && <div style={{ marginBottom: 6 }}>🟢 <strong>{hotAlerts.length} hot listing{hotAlerts.length > 1 ? 's' : ''}</strong> scored 70+ — review in Alerts</div>}
          {pipeline.length === 0 && alerts.length === 0 && tasks.length === 0 && <div>No urgent items today. Focus on deal sourcing and outreach.</div>}
        </div>
      </div>
    </div>
  )
}
