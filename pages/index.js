import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, COLUMNS, NAV_ITEMS, LogoSVG, scoreDeal, gradeColor, fmt, emptyDeal, MAX_SCORE, Badge } from '../lib/brand'
import DealForm from '../components/DealForm'
import TableView from '../components/TableView'
import MapView from '../components/MapView'
import AccountingTab from '../components/AccountingTab'
import AlertsTab from '../components/AlertsTab'
import CrmTab from '../components/CrmTab'
import CompsTab from '../components/CompsTab'
import DailyBriefTab from '../components/DailyBriefTab'
import QuickAdd from '../components/QuickAdd'
import OwnedDealView from '../components/OwnedDealView'
import TaskBoard from '../components/TaskBoard'
import CalendarTab from '../components/CalendarTab'
import TreasuryTab from '../components/TreasuryTab'
import SettingsTab from '../components/SettingsTab'

// ─── SEARCH BAR ───
function SearchBar({ deals, onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const q = query.toLowerCase().trim()
  const results = q.length < 2 ? [] : deals.filter(d =>
    (d.address && d.address.toLowerCase().includes(q)) || (d.owner && d.owner.toLowerCase().includes(q)) ||
    (d.city && d.city.toLowerCase().includes(q)) || (d.market && d.market.toLowerCase().includes(q))
  ).slice(0, 12)

  return (
    <div ref={ref} style={{ position: 'relative', flex: '1 1 220px', maxWidth: 350 }}>
      <input style={{ width: '100%', padding: '9px 10px 9px 30px', border: `1px solid ${B.gray20}`, borderRadius: 4, fontSize: 13, color: B.black, background: B.white, outline: 'none', fontFamily: bf, boxSizing: 'border-box' }}
        placeholder="Search address, owner, market..." value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { if (q.length >= 2) setOpen(true) }} />
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: B.gray40 }}>&#x26B2;</span>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: B.white, border: `1px solid ${B.gray20}`, borderRadius: '0 0 4px 4px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 360, overflowY: 'auto' }}>
          {results.map(d => {
            let grade = 'D'; try { grade = scoreDeal(d).grade || 'D' } catch(e) {} const g = gradeColor(grade); const col = COLUMNS.find(c => c.id === d.status)
            return (
              <div key={d.id} onClick={() => { onSelect(d); setQuery(''); setOpen(false) }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${B.gray10}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = B.blue05} onMouseLeave={e => e.currentTarget.style.background = B.white}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: B.black, fontFamily: hf }}>{d.address}</div>
                  <div style={{ fontSize: 10, color: B.gray, fontFamily: bf }}>{d.city}{d.state ? `, ${d.state}` : ''} &mdash; {d.market}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {col && <Badge bg={col.color + '18'} color={col.color} style={{ fontSize: 9 }}>{col.label}</Badge>}
                  <Badge bg={g.bg} color={g.tx} style={{ fontSize: 9 }}>{grade}</Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── STATS BAR (bigger) ───
function Stats({ deals }) {
  const tracked = deals.filter(d => d.status === 'tracked' || d.status === 'new_lead').length
  const review = deals.filter(d => d.status === 'under_review').length
  const pursuit = deals.filter(d => d.status === 'pursuit').length
  const lois = deals.filter(d => d.status === 'loi_sent').length
  const contract = deals.filter(d => d.status === 'under_contract').length
  const owned = deals.filter(d => d.status === 'owned').length
  const dead = deals.filter(d => d.status === 'dead').length
  const pv = deals.filter(d => d.asking_price && !['dead', 'tracked', 'new_lead'].includes(d.status)).reduce((s, d) => s + Number(d.asking_price), 0)
  const items = [
    { l: 'Tracked', v: tracked, c: B.gray },
    { l: 'Review', v: review, c: B.blue },
    { l: 'Pursuit', v: pursuit, c: B.amber },
    { l: 'LOI out', v: lois, c: B.violet },
    { l: 'Contract', v: contract, c: B.teal },
    { l: 'Owned', v: owned, c: B.green },
    { l: 'Dead', v: dead, c: B.red },
    { l: 'Pipeline $', v: fmt(pv), c: B.blue },
  ]
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {items.map((s, i) => (
        <div key={i} style={{ flex: '1 1 80px', background: B.white, borderRadius: 4, padding: '10px 12px', border: `1px solid ${B.gray20}`, minWidth: 75 }}>
          <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.l}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: s.c, fontFamily: hf }}>{s.v}</div>
        </div>
      ))}
    </div>
  )
}

// ─── SIDEBAR ───
function Sidebar({ activeTab, setActiveTab, alertCount, ownedDeals, session }) {
  const restricted = session?.restrictedTabs || []
  return (
    <div style={{ width: 170, minHeight: '100vh', background: B.white, borderRight: `1px solid ${B.gray20}`, padding: '16px 0', display: 'flex', flexDirection: 'column', fontFamily: bf, position: 'fixed', left: 0, top: 0, overflowY: 'auto' }}>
      <div style={{ padding: '0 14px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <LogoSVG size={30} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, lineHeight: 1.1 }}>Duffield</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, lineHeight: 1.1 }}>Holdings</div>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {NAV_ITEMS.filter(item => !restricted.includes(item.id)).map(item => {
          const active = activeTab === item.id || (item.id === 'tracker' && activeTab.startsWith('owned_'))
          return (
            <div key={item.id}>
              <button onClick={() => setActiveTab(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', border: 'none', cursor: 'pointer',
                background: active ? B.blue05 : 'transparent', borderLeft: active ? `3px solid ${B.blue}` : '3px solid transparent',
                color: active ? B.blue : B.gray, fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: bf, textAlign: 'left',
              }}>
                <span style={{ fontSize: 14, width: 18, textAlign: 'center', opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.id === 'alerts' && alertCount > 0 && <span style={{ marginLeft: 'auto', background: B.red, color: B.white, borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{alertCount}</span>}
              </button>
              {/* Sub-nav for owned/contract deals */}
              {item.id === 'tracker' && ownedDeals && ownedDeals.length > 0 && (
                <div style={{ paddingLeft: 20 }}>
                  {ownedDeals.map(d => {
                    const isActive = activeTab === 'owned_' + d.id
                    const isContract = d.status === 'under_contract'
                    return (
                      <button key={d.id} onClick={() => setActiveTab('owned_' + d.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 10px', border: 'none', cursor: 'pointer',
                        background: isActive ? B.blue05 : 'transparent', borderLeft: isActive ? `2px solid ${isContract ? B.teal : B.green}` : '2px solid transparent',
                        color: isActive ? B.blue : B.gray60, fontSize: 11, fontWeight: isActive ? 600 : 400, fontFamily: bf, textAlign: 'left',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isContract ? B.teal : B.green, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.address}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${B.gray20}` }}>
        <button onClick={() => signOut()} style={{ width: '100%', padding: '7px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray20}`, borderRadius: 3, fontSize: 11, cursor: 'pointer', fontFamily: bf }}>Sign out</button>
      </div>
    </div>
  )
}

// ─── HOME PAGE ───
function HomePage({ deals, setActiveTab, onClickDeal }) {
  const owned = deals.filter(d => d.status === 'owned')
  const active = deals.filter(d => !['dead', 'owned', 'tracked'].includes(d.status))
  const pursuit = deals.filter(d => d.status === 'pursuit')
  const lois = deals.filter(d => d.status === 'loi_sent')
  const review = deals.filter(d => d.status === 'under_review')
  const dead = deals.filter(d => d.status === 'dead')

  const card = (title, value, sub, color, tab) => (
    <div onClick={() => tab && setActiveTab(tab)} style={{ flex: '1 1 160px', background: B.white, borderRadius: 6, padding: '16px 18px', border: `1px solid ${B.gray20}`, cursor: tab ? 'pointer' : 'default', minWidth: 140 }}
      onMouseEnter={e => { if (tab) e.currentTarget.style.borderColor = B.blue }} onMouseLeave={e => { e.currentTarget.style.borderColor = B.gray20 }}>
      <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || B.blue, fontFamily: hf }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: B.gray60, fontFamily: bf }}>{sub}</div>}
    </div>
  )

  const link = (label, tab) => (
    <button onClick={() => setActiveTab(tab)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: B.white, border: `1px solid ${B.gray20}`, borderRadius: 4, cursor: 'pointer', fontFamily: bf, fontSize: 13, color: B.black, width: '100%', textAlign: 'left' }}
      onMouseEnter={e => { e.currentTarget.style.background = B.blue05; e.currentTarget.style.borderColor = B.blue }}
      onMouseLeave={e => { e.currentTarget.style.background = B.white; e.currentTarget.style.borderColor = B.gray20 }}>
      <span style={{ color: B.blue, fontWeight: 600, fontFamily: hf }}>{label}</span>
      <span style={{ marginLeft: 'auto', color: B.gray40, fontSize: 12 }}>→</span>
    </button>
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: B.blue, fontFamily: hf }}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, Nate</div>
        <div style={{ fontSize: 13, color: B.gray, fontFamily: bf }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {card('Owned', owned.length, owned.map(d => d.address).join(', ') || 'None yet', B.green, 'tracker')}
        {card('Active pipeline', active.length, pursuit.length + ' pursuit · ' + review.length + ' review', B.amber, 'tracker')}
        {card('Total deals', deals.length, dead.length + ' dead · ' + (deals.length - dead.length) + ' active', B.blue, 'tracker')}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 2 }}>Quick access</div>
          {link('Daily Brief — Pipeline + Alerts + Action Items', 'brief')}
          {link('Deal Tracker — All Properties', 'tracker')}
          {link('Tasks — Kanban Board', 'tasks')}
          {link('Calendar — Deadlines & Events', 'calendar')}
          {link('CRM — Contacts & Relationships', 'crm')}
          {link('Treasury — Cash Position & Payables', 'treasury')}
        </div>
        <div style={{ flex: '1 1 250px' }}>
          {/* LOIs Out */}
          {lois.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8B5CF6', fontFamily: hf, textTransform: 'uppercase', marginBottom: 8 }}>LOIs out ({lois.length})</div>
              {lois.map(d => (
                <div key={d.id} onClick={() => { setActiveTab('tracker'); if (onClickDeal) onClickDeal(d) }} style={{ background: B.white, borderRadius: 4, padding: '10px 14px', border: `1px solid ${B.gray20}`, marginBottom: 6, cursor: 'pointer', borderLeft: '3px solid #8B5CF6' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#8B5CF6' }} onMouseLeave={e => { e.currentTarget.style.borderColor = B.gray20; e.currentTarget.style.borderLeft = '3px solid #8B5CF6' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: B.black, fontFamily: hf }}>{d.address}</div>
                  <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{d.city}{d.state ? `, ${d.state}` : ''} — {d.market}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {d.building_sf && <span style={{ fontSize: 10, color: B.gray, fontFamily: bf }}>{Number(d.building_sf).toLocaleString()} SF</span>}
                    {d.lot_acres && <span style={{ fontSize: 10, color: B.gray, fontFamily: bf }}>{d.lot_acres} ac</span>}
                    {d.asking_price && <span style={{ fontSize: 10, fontWeight: 600, color: B.blue, fontFamily: bf }}>{fmt(d.asking_price)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Owned properties */}
          <div style={{ fontSize: 13, fontWeight: 700, color: B.green, fontFamily: hf, textTransform: 'uppercase', marginBottom: 8 }}>Owned properties</div>
          {owned.length === 0 ? (
            <div style={{ fontSize: 12, color: B.gray40, fontFamily: bf }}>No owned deals yet</div>
          ) : (
            owned.map(d => (
              <div key={d.id} onClick={() => setActiveTab('owned_' + d.id)} style={{ background: B.white, borderRadius: 4, padding: '12px 14px', border: `1px solid ${B.gray20}`, marginBottom: 6, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = B.green }} onMouseLeave={e => { e.currentTarget.style.borderColor = B.gray20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: B.black, fontFamily: hf }}>{d.address}</div>
                <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{d.city}, {d.state} — {d.market}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {d.building_sf && <span style={{ fontSize: 10, color: B.gray, fontFamily: bf }}>{Number(d.building_sf).toLocaleString()} SF</span>}
                  {d.lot_acres && <span style={{ fontSize: 10, color: B.gray, fontFamily: bf }}>{d.lot_acres} ac</span>}
                  {d.asking_price && <span style={{ fontSize: 10, fontWeight: 600, color: B.blue, fontFamily: bf }}>{fmt(d.asking_price)}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── URL ROUTING HELPERS ───
const VALID_TABS = ['home', 'brief', 'tracker', 'tasks', 'calendar', 'crm', 'comps', 'treasury', 'settings', 'alerts']
const TAB_SLUGS = {
  home: '', brief: 'brief', tracker: 'tracker', tasks: 'tasks', calendar: 'calendar',
  crm: 'crm', comps: 'comps', treasury: 'treasury', settings: 'settings', alerts: 'alerts'
}
const SLUG_TO_TAB = Object.fromEntries(Object.entries(TAB_SLUGS).map(([k, v]) => [v, k]))

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function getTabFromHash() {
  if (typeof window === 'undefined') return 'home'
  const raw = window.location.hash.replace(/^#\/?/, '')
  if (!raw) return 'home'
  if (raw.startsWith('owned/')) return 'owned_' + raw.replace('owned/', '')
  if (raw.startsWith('deal/')) return '__deal__' + raw.replace('deal/', '')
  return SLUG_TO_TAB[raw] || 'home'
}

function pushHash(tab) {
  if (typeof window === 'undefined') return
  let slug
  if (tab.startsWith('owned_')) {
    slug = 'owned/' + tab.replace('owned_', '')
  } else if (tab.startsWith('__deal__')) {
    slug = 'deal/' + tab.replace('__deal__', '')
  } else {
    slug = TAB_SLUGS[tab] ?? tab
  }
  const newHash = slug ? '#/' + slug : '#/'
  if (window.location.hash !== newHash) {
    window.history.pushState(null, '', newHash)
  }
}

// ─── MAIN ───
export default function Dashboard() {
  const { data: session } = useSession()
  const [deals, setDeals] = useState([])
  const [activeTab, setActiveTabRaw] = useState('home')
  const [trackerView, setTrackerView] = useState('table') // table, map
  const [editing, setEditing] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alertCount, setAlertCount] = useState(0)

  // Wrap setActiveTab to also push hash
  const setActiveTab = useCallback((tab) => {
    setActiveTabRaw(tab)
    pushHash(tab)
  }, [])

  // Wrap setEditing to also push deal URL
  const openDeal = useCallback((deal) => {
    setEditing(deal)
    if (deal) {
      const slug = slugify(deal.address || deal.id)
      pushHash('__deal__' + slug)
    }
  }, [])

  const closeDeal = useCallback(() => {
    setEditing(null)
    setShowNew(false)
    // Go back to tracker
    pushHash('tracker')
    setActiveTabRaw('tracker')
  }, [])

  // Read hash on mount + listen for back/forward
  useEffect(() => {
    const initial = getTabFromHash()
    if (initial.startsWith('__deal__')) {
      // We'll resolve the deal after data loads
      setActiveTabRaw('tracker')
    } else {
      setActiveTabRaw(initial)
    }

    const onPop = () => {
      const tab = getTabFromHash()
      if (tab.startsWith('__deal__')) {
        // Resolve deal slug against loaded deals
        const dealSlug = tab.replace('__deal__', '')
        const match = deals.find(d => slugify(d.address || d.id) === dealSlug)
        if (match) { setEditing(match); setActiveTabRaw('tracker') }
        else { setEditing(null); setActiveTabRaw('tracker') }
      } else {
        setEditing(null)
        setActiveTabRaw(tab)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [deals])

  const fetchDeals = useCallback(async () => {
    // Supabase limits to 1000 rows per request, so paginate
    let all = [], offset = 0, pageSize = 1000, hasMore = true
    while (hasMore) {
      const { data, error } = await supabase.from('deals').select('*').order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
      if (error || !data || data.length === 0) { hasMore = false; break }
      all = all.concat(data)
      if (data.length < pageSize) hasMore = false
      else offset += pageSize
    }
    setDeals(all)
    setLoading(false)
  }, [])

  const fetchAlertCount = useCallback(async () => {
    const { count } = await supabase.from('deal_alerts').select('*', { count: 'exact', head: true }).eq('status', 'new')
    setAlertCount(count || 0)
  }, [])

  useEffect(() => { fetchDeals(); fetchAlertCount() }, [fetchDeals, fetchAlertCount])

  // Resolve deal URL after deals load
  useEffect(() => {
    if (deals.length === 0) return
    const hash = getTabFromHash()
    if (hash.startsWith('__deal__') && !editing) {
      const dealSlug = hash.replace('__deal__', '')
      const match = deals.find(d => slugify(d.address || d.id) === dealSlug)
      if (match) { setEditing(match); setActiveTabRaw('tracker') }
    }
  }, [deals]) // eslint-disable-line react-hooks/exhaustive-deps
  const editingRef = useRef(editing)
  useEffect(() => { editingRef.current = editing }, [editing])
  useEffect(() => {
    const ch = supabase.channel('all-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => { if (!editingRef.current) fetchDeals() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_alerts' }, () => fetchAlertCount())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchDeals, fetchAlertCount])

  const saveDeal = async (d) => {
    const cleaned = { ...d }
    ;['asking_price','building_sf','lot_acres','price_per_sf','clear_height','dock_doors','distance_interstate','cap_rate','year_built','purchase_price'].forEach(k => {
      if (cleaned[k] === '' || cleaned[k] === undefined) cleaned[k] = null
      else cleaned[k] = Number(cleaned[k])
    })
    // score_overrides is a JSON string, don't convert to number
    if (!cleaned.score_overrides) cleaned.score_overrides = null
    cleaned.updated_at = new Date().toISOString()
    if (d.id) { await supabase.from('deals').update(cleaned).eq('id', d.id) }
    else { delete cleaned.id; const { data } = await supabase.from('deals').insert(cleaned).select(); if (data?.[0]) cleaned.id = data[0].id }

    // Auto-geocode if address exists but no lat/long
    if (cleaned.address && cleaned.city && (!cleaned.latitude || cleaned.latitude === 0)) {
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(cleaned.address)}&city=${encodeURIComponent(cleaned.city)}&state=${encodeURIComponent(cleaned.state || '')}&country=US&format=json&limit=1`, { headers: { 'User-Agent': 'DuffieldDashboard/1.0' } })
        const geoData = await geoRes.json()
        if (geoData?.[0]) {
          const lat = parseFloat(geoData[0].lat), lon = parseFloat(geoData[0].lon)
          const updateId = d.id || cleaned.id
          if (updateId) await supabase.from('deals').update({ latitude: lat, longitude: lon }).eq('id', updateId)
        }
      } catch (e) { /* geocode failed, non-critical */ }
    }

    setEditing(null); setShowNew(false); pushHash('tracker'); setActiveTabRaw('tracker'); fetchDeals()
  }

  const deleteDeal = async (id) => { await supabase.from('deals').delete().eq('id', id); setEditing(null); pushHash('tracker'); setActiveTabRaw('tracker'); fetchDeals() }

  const ownedDeals = deals.filter(d => d.status === 'owned' || d.status === 'under_contract')

  if (!session) return null

  const isTracker = activeTab === 'tracker'
  const isOwnedView = activeTab.startsWith('owned_')
  const ownedViewDeal = isOwnedView ? deals.find(d => d.id === activeTab.replace('owned_', '')) : null

  return (
    <div style={{ fontFamily: bf, display: 'flex', minHeight: '100vh', background: B.blue05 }}>
      <link href="https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:wght@400;600;700&family=Fira+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <Sidebar activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setEditing(null); setShowNew(false) }} alertCount={alertCount} ownedDeals={ownedDeals} session={session} />

      <div style={{ marginLeft: 170, flex: 1, padding: '16px 20px', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: B.blue, fontFamily: hf }}>
              {isOwnedView && ownedViewDeal ? ownedViewDeal.address : activeTab === 'tracker' ? 'Deal Tracker' : NAV_ITEMS.find(n => n.id === activeTab)?.label || 'Dashboard'}
            </div>
            {isOwnedView && ownedViewDeal && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{ownedViewDeal.city}, {ownedViewDeal.state} — {ownedViewDeal.market}</div>}
            {isTracker && !editing && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{deals.length} properties tracked</div>}
          </div>

          {!editing && !showNew && <SearchBar deals={deals} onSelect={d => openDeal(d)} />}

          {isTracker && !editing && !showNew && (
            <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
              <button onClick={() => setShowQuickAdd(true)} style={{
                padding: '10px 18px', background: B.white, color: B.blue, border: `2px solid ${B.blue}`,
                borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: hf,
              }}>URL / OM import</button>
              <button onClick={() => setShowNew(true)} style={{
                padding: '10px 18px', background: B.blue, color: B.white, border: 'none',
                borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: hf,
              }}>+ New deal</button>
            </div>
          )}
        </div>

        {showQuickAdd && <QuickAdd onClose={() => setShowQuickAdd(false)} onDealCreated={fetchDeals} />}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: B.gray, fontFamily: bf }}>Loading...</div>
        ) : editing && editing.status === 'owned' ? (
          <OwnedDealView deal={editing} onBack={closeDeal} />
        ) : editing || showNew ? (
          <DealForm deal={editing || emptyDeal()} onSave={saveDeal} onCancel={closeDeal} onDelete={deleteDeal} />
        ) : (
          <>
            {/* Tracker page with view toggle */}
            {isTracker && (
              <>
                <Stats deals={deals} />
                {/* View toggle */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {[
                    { id: 'table', label: 'Table', icon: '⊞' },
                    { id: 'map', label: 'Map', icon: '◎' },
                  ].map(v => (
                    <button key={v.id} onClick={() => setTrackerView(v.id)} style={{
                      padding: '6px 16px', borderRadius: 3, fontSize: 12, fontWeight: trackerView === v.id ? 700 : 400,
                      border: `1px solid ${trackerView === v.id ? B.blue : B.gray20}`,
                      background: trackerView === v.id ? B.blue : B.white,
                      color: trackerView === v.id ? B.white : B.gray,
                      cursor: 'pointer', fontFamily: hf, display: 'flex', alignItems: 'center', gap: 5,
                    }}><span>{v.icon}</span> {v.label}</button>
                  ))}
                </div>

                {trackerView === 'table' && <TableView deals={deals} onClickDeal={openDeal} onRefresh={fetchDeals} />}
                {trackerView === 'map' && <MapView deals={deals} onClickDeal={openDeal} />}
              </>
            )}

            {activeTab === 'home' && <HomePage deals={deals} setActiveTab={setActiveTab} onClickDeal={(d) => { setActiveTabRaw('tracker'); openDeal(d) }} />}

            {activeTab === 'brief' && (
              <DailyBriefTab deals={deals} />
            )}
            {activeTab === 'crm' && <CrmTab />}
            {activeTab === 'comps' && <CompsTab />}
            {activeTab === 'tasks' && <TaskBoard deals={deals} />}
            {activeTab === 'calendar' && <CalendarTab deals={deals} />}
            {activeTab === 'treasury' && !(session?.restrictedTabs || []).includes('treasury') && <TreasuryTab />}
            {activeTab === 'treasury' && (session?.restrictedTabs || []).includes('treasury') && (
              <div style={{ padding: 40, textAlign: 'center', color: B.gray, fontFamily: bf }}>You don't have access to Treasury.</div>
            )}
            {activeTab === 'settings' && <SettingsTab />}
            {isOwnedView && ownedViewDeal && <OwnedDealView deal={ownedViewDeal} onBack={() => setActiveTab('tracker')} />}
          </>
        )}
      </div>
    </div>
  )
}
