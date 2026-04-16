import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, COLUMNS, MARKETS, PTYPES, SCORING_PARAMS, MAX_SCORE, scoreDeal, gradeColor, fmt, Badge } from '../lib/brand'
import UnderwriteTab from './UnderwriteTab'
import DealDocuments from './DealDocuments'

// Score row for v2.1 breakdown
function ScoreRow({ l, s, m }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: `1px solid ${B.blue10}` }}>
      <span style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{l}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 40, height: 4, background: B.gray20, borderRadius: 2 }}>
          <div style={{ width: `${m > 0 ? (s / m) * 100 : 0}%`, height: '100%', background: s === m ? '#10B981' : s > m * 0.5 ? '#F59E0B' : s > 0 ? '#6B7280' : '#EF4444', borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, minWidth: 28, textAlign: 'right', fontFamily: hf, color: s === m ? '#065F46' : s > m * 0.5 ? '#92400E' : s > 0 ? '#6B7280' : '#991B1B' }}>{s}/{m}</span>
      </div>
    </div>
  )
}

function SummaryView({ d, grade, total, g, col, scores, estYOC, isIOS, onChangeStatus }) {
  const sf = Number(d.building_sf) || 0
  const ac = Number(d.lot_acres) || 0
  const price = Number(d.asking_price) || 0
  const psf = sf > 0 && price > 0 ? price / sf : 0
  const pac = ac > 0 && price > 0 ? price / ac : 0
  const cov = sf > 0 && ac > 0 ? ((sf / (ac * 43560)) * 100).toFixed(0) : '—'
  const ltb = sf > 0 && ac > 0 ? ((ac * 43560) / sf).toFixed(1) : '—'
  const sr = (l, v, bold, color) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
      <span style={{ color: B.gray }}>{l}</span>
      <span style={{ color: color || B.black, fontWeight: bold ? 700 : 400, fontFamily: bold ? hf : bf }}>{v}</span>
    </div>
  )
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { l: 'Score', v: `${grade} · ${total}`, c: g.tx },
          { l: 'Est. YOC', v: estYOC ? estYOC + '%' : '—', c: estYOC >= 10 ? '#065F46' : estYOC >= 8 ? '#92400E' : B.gray },
          { l: 'Price', v: price ? fmt(price) : '—', c: B.blue },
          { l: '$/SF', v: psf ? '$' + Math.round(psf) : '—', c: B.blue },
        ].map((card, i) => (
          <div key={i} style={{ flex: '1 1 80px', background: B.white, borderRadius: 4, padding: '8px 12px', border: `1px solid ${B.gray20}`, minWidth: 70 }}>
            <div style={{ fontSize: 9, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>{card.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: card.c, fontFamily: hf }}>{card.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>Property</div>
          {sr('Address', d.address || '—')}
          {sr('City, State', d.city ? `${d.city}, ${d.state || ''}` : '—')}
          {sr('Market', d.market || '—')}
          {sr('Type', d.property_type || '—')}
          {sr('Building SF', sf ? sf.toLocaleString() : '—')}
          {sr('Lot Acres', ac ? ac.toFixed(2) : '—')}
          {sr('Building Coverage', cov !== '—' ? cov + '%' : '—')}
          {sr('Lot : Building', ltb !== '—' ? ltb + 'x' : '—')}
          {sr('Clear Height', d.clear_height ? d.clear_height + ' ft' : '—')}
          {sr('Doors', d.dock_doors || '—')}
          {sr('Zoning', d.zoning || '—')}
          {sr('Year Built', d.year_built || '—')}
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>Deal</div>
          {sr('Asking Price', price ? fmt(price) : '—', true)}
          {sr('$/SF', psf ? '$' + psf.toFixed(0) : '—')}
          {sr('$/Acre', pac ? '$' + Math.round(pac).toLocaleString() : '—')}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
            <span style={{ color: B.gray }}>Status</span>
            <select value={d.status} onChange={e => onChangeStatus(e.target.value)} style={{
              border: `1px solid ${B.gray20}`, borderRadius: 3, padding: '2px 6px', fontSize: 12,
              fontFamily: bf, fontWeight: 600, color: col ? col.color : B.black,
              background: B.white, cursor: 'pointer', outline: 'none',
            }}>
              {COLUMNS.map(c => <option key={c.id} value={c.id} style={{ color: B.black }}>{c.label}</option>)}
            </select>
          </div>
          {sr('Source', d.source || '—')}
          <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4, marginTop: 10 }}>Contact</div>
          {sr('Owner', d.owner || '—')}
          {sr('Contact', d.contact_name || '—')}
          {sr('Method', d.contact_method || '—')}
          <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4, marginTop: 10 }}>Scoring Highlights</div>
          {sr('Basis vs Market', (scores.basis_discount || 0) + '/25', (scores.basis_discount || 0) >= 20, (scores.basis_discount || 0) >= 20 ? '#065F46' : undefined)}
          {sr('Broker Edge', (scores.broker || 0) + '/10', false, (scores.broker || 0) >= 8 ? '#065F46' : undefined)}
          {sr('Deal Type', isIOS ? 'IOS' : 'Building')}
        </div>
      </div>
      {d.notes && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: B.gray10, borderRadius: 4, fontSize: 11, color: B.gray, fontFamily: bf, whiteSpace: 'pre-wrap' }}>{d.notes}</div>
      )}
      {/* Satellite map */}
      {(Number(d.latitude) > 0 || Number(d.longitude) !== 0) && (
        <div style={{ marginTop: 14, borderRadius: 4, overflow: 'hidden', border: `1px solid ${B.gray20}` }}>
          <iframe
            title="map"
            width="100%" height="700" frameBorder="0" style={{ border: 0, display: 'block' }}
            src={`https://maps.google.com/maps?q=${d.latitude},${d.longitude}&t=k&z=18&output=embed`}
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}

const ACTIVITY_TYPES = [
  { id: 'note', label: 'Note', icon: 'N' },
  { id: 'call', label: 'Call', icon: 'C' },
  { id: 'email', label: 'Email', icon: 'E' },
  { id: 'visit', label: 'Site visit', icon: 'V' },
  { id: 'loi', label: 'LOI', icon: 'L' },
  { id: 'meeting', label: 'Meeting', icon: 'M' },
]

export default function DealForm({ deal, onSave, onCancel, onDelete }) {
  const [d, setD] = useState({ ...deal })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('summary')
  const [activities, setActivities] = useState([])
  const [newActivity, setNewActivity] = useState({ type: 'note', content: '' })

  const set = (k, v) => setD(p => {
    const n = { ...p, [k]: v }
    if (k === 'asking_price' || k === 'building_sf') {
      const pr = parseFloat(k === 'asking_price' ? v : n.asking_price)
      const sf = parseFloat(k === 'building_sf' ? v : n.building_sf)
      if (pr > 0 && sf > 0) n.price_per_sf = (pr / sf).toFixed(2)
    }
    return n
  })

  const fetchActivity = useCallback(async () => {
    if (!deal.id) return
    const { data } = await supabase.from('deal_activity').select('*').eq('deal_id', deal.id).order('created_at', { ascending: false })
    if (data) setActivities(data)
  }, [deal.id])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  const addActivity = async () => {
    if (!newActivity.content.trim() || !deal.id) return
    await supabase.from('deal_activity').insert({ deal_id: deal.id, type: newActivity.type, content: newActivity.content.trim() })
    setNewActivity({ type: 'note', content: '' })
    fetchActivity()
  }

  const deleteActivity = async (id) => {
    await supabase.from('deal_activity').delete().eq('id', id)
    fetchActivity()
  }

  const handleSave = async () => { setSaving(true); await onSave(d); setSaving(false) }

  let total = 0, grade = 'D', scores = {}, penalties = 0, estYOC = 0, isIOS = false
  try {
    const result = scoreDeal(d)
    total = result.total || 0; grade = result.grade || 'D'; scores = result.scores || {}
    penalties = result.penalties || 0; estYOC = result.estYOC || 0; isIOS = result.isIOS || false
  } catch (e) { console.error('Score error:', e) }
  const g = gradeColor(grade)
  const col = COLUMNS.find(c => c.id === d.status)

  const is = { width: '100%', padding: '7px 10px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 13, color: B.black, background: B.white, outline: 'none', boxSizing: 'border-box', fontFamily: bf }
  const ls = { fontSize: 11, fontWeight: 500, color: B.gray, marginBottom: 2, display: 'block', fontFamily: bf }

  const F = ({ l, k, t = 'text', ph, h }) => (
    <div style={{ flex: h ? '1 1 47%' : '1 1 100%', minWidth: h ? 130 : 'auto' }}>
      <label style={ls}>{l}</label>
      <input style={is} type={t} placeholder={ph} value={d[k] ?? ''} onChange={e => set(k, e.target.value)} />
    </div>
  )
  const S = ({ l, k, opts, h }) => (
    <div style={{ flex: h ? '1 1 47%' : '1 1 100%', minWidth: h ? 130 : 'auto' }}>
      <label style={ls}>{l}</label>
      <select style={{ ...is, cursor: 'pointer' }} value={d[k]} onChange={e => set(k, e.target.value)}>
        {opts.map(o => <option key={typeof o === 'string' ? o : o.v} value={typeof o === 'string' ? o : o.v}>{typeof o === 'string' ? o : o.l}</option>)}
      </select>
    </div>
  )

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'details', label: 'Details' },
    { id: 'owner', label: 'Owner / Contact' },
    { id: 'underwrite', label: 'Underwrite' },
    { id: 'documents', label: 'Documents' },
    { id: 'scoring', label: 'Scoring' },
    { id: 'activity', label: `Activity (${activities.length})` },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: B.blue, fontFamily: hf }}>
            {deal.id ? d.address || 'Edit deal' : 'New deal entry'}
          </div>
          <div style={{ fontSize: 12, color: B.gray, fontFamily: bf }}>
            {d.city}{d.state ? `, ${d.state}` : ''}{d.market ? ` — ${d.market}` : ''}
            {col && <span> — <span style={{ color: col.color, fontWeight: 600 }}>{col.label}</span></span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {deal.om_url && <a href={deal.om_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: B.blue, fontFamily: hf, textDecoration: 'none', padding: '4px 10px', border: `1px solid ${B.blue20}`, borderRadius: 3 }}>📄 {deal.om_filename || 'OM'}</a>}
          <Badge bg={g.bg} color={g.tx} border={g.bd} style={{ fontSize: 14, padding: '4px 12px' }}>{grade} &middot; {total}/{MAX_SCORE}</Badge>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 14, borderBottom: `2px solid ${B.gray20}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '6px 14px', fontSize: 11, fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? B.blue : B.gray, background: 'transparent', border: 'none',
            borderBottom: tab === t.id ? `2px solid ${B.blue}` : '2px solid transparent',
            cursor: 'pointer', marginBottom: -2, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Main content */}
        <div style={{ flex: '1 1 420px', minWidth: 300 }}>

          {/* Summary tab */}
          {tab === 'summary' && <SummaryView d={d} grade={grade} total={total} g={g} col={col} scores={scores} estYOC={estYOC} isIOS={isIOS} onChangeStatus={(v) => set('status', v)} />}

          {/* Details tab */}
          {tab === 'details' && (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}><F l="Address" k="address" ph="123 Industrial Blvd" /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}><F l="City" k="city" ph="Louisville" h /><F l="State" k="state" ph="KY" h /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}><S l="Market" k="market" opts={MARKETS} h /><S l="Type" k="property_type" opts={PTYPES} h /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <S l="Status" k="status" opts={COLUMNS.map(c => ({ v: c.id, l: c.label }))} h />
                <F l="Asking ($)" k="asking_price" t="number" ph="925000" h />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <F l="Building SF" k="building_sf" t="number" ph="8800" h />
                <F l="Lot acres" k="lot_acres" t="number" ph="3.57" h />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <F l="Parcel #" k="parcel_number" ph="080701770000" h />
                <F l="Zoning" k="zoning" ph="M-2 Industrial" h />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={ls}>Notes</label>
                <textarea style={{ ...is, minHeight: 80, resize: 'vertical' }} value={d.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Deal notes, observations, thesis..." />
              </div>
            </div>
          )}

          {/* Owner tab */}
          {tab === 'owner' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, marginBottom: 8, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4 }}>Property owner</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}><F l="Owner name" k="owner" ph="Mason Ronald A" /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <F l="Phone" k="owner_phone" ph="(520) 980-5509" h />
                <F l="Email" k="owner_email" ph="owner@company.com" h />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <F l="Owner address" k="owner_address" ph="123 Main St, City, ST 12345" />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, margin: '16px 0 8px', fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4 }}>Broker / contact</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <F l="Contact name" k="contact_name" ph="Nathan Mosley, Highwoods" h />
                <F l="Contact method" k="contact_method" ph="email or phone" h />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, margin: '16px 0 8px', fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4 }}>Sale history</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <F l="Purchase date" k="purchase_date" ph="2015" h />
                <F l="Purchase price ($)" k="purchase_price" t="number" ph="232300" h />
              </div>

              {/* Quick summary of existing data */}
              {(d.owner || d.owner_phone || d.owner_email) && (
                <div style={{ background: B.blue05, borderRadius: 4, padding: 12, border: `1px solid ${B.blue20}`, marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>Quick reference</div>
                  {d.owner && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 2 }}><span style={{ color: B.gray }}>Owner:</span> <span style={{ color: B.black, fontWeight: 600 }}>{d.owner}</span></div>}
                  {d.owner_phone && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 2 }}><span style={{ color: B.gray }}>Phone:</span> <a href={`tel:${d.owner_phone}`} style={{ color: B.blue, textDecoration: 'none' }}>{d.owner_phone}</a></div>}
                  {d.owner_email && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 2 }}><span style={{ color: B.gray }}>Email:</span> <a href={`mailto:${d.owner_email}`} style={{ color: B.blue, textDecoration: 'none' }}>{d.owner_email}</a></div>}
                  {d.owner_address && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 2 }}><span style={{ color: B.gray }}>Addr:</span> {d.owner_address}</div>}
                  {d.contact_name && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 2 }}><span style={{ color: B.gray }}>Contact:</span> {d.contact_name}</div>}
                </div>
              )}
            </div>
          )}

          {/* Underwrite tab */}
          {tab === 'underwrite' && <UnderwriteTab deal={d} onSave={handleSave} />}

          {/* Documents tab */}
          {tab === 'documents' && deal.id && <DealDocuments dealId={deal.id} onDealUpdated={async () => {
            const { data } = await supabase.from('deals').select('*').eq('id', deal.id).single()
            if (data) setD(data)
          }} />}
          {tab === 'documents' && !deal.id && <div style={{ padding: 20, textAlign: 'center', color: B.gray40, fontSize: 12, fontFamily: bf }}>Save the deal first to upload documents</div>}

          {/* Scoring tab */}
          {tab === 'scoring' && (() => {
            const sf = Number(d.building_sf) || 0
            const price = Number(d.asking_price) || 0
            const psf = sf > 0 && price > 0 ? (price / sf).toFixed(0) : '?'
            const mktData = scoreDeal(d).market || {}
            const compPSF = mktData.comp_psf || '?'

            const scoreItems = [
              { tier: 'Economics (45 pts)', items: [
                { l: 'Basis vs Market', s: scores.basis_discount || 0, m: 25, reason: psf !== '?' && compPSF !== '?' ? `$${psf}/SF vs $${compPSF}/SF market comps (${compPSF > 0 ? Math.round((1 - psf / compPSF) * 100) : '?'}% ${psf < compPSF ? 'below' : 'above'})` : 'Need price + SF to calculate' },
                { l: 'Estimated YOC', s: scores.est_yoc || 0, m: 20, reason: estYOC > 0 ? `${estYOC}% YOC using $${(mktData.bldg_rent || 0).toFixed(2)}/SF mid-market rent` : 'Need price + SF + market to estimate' },
              ]},
              { tier: 'Physical (15 pts)', items: [
                { l: 'Clear Height', s: scores.clear_height || 0, m: 6, reason: d.clear_height ? `${d.clear_height} ft (22ft+ = full, <16ft = near zero)` : 'Unknown — using baseline 3' },
                { l: 'Doors', s: scores.access || 0, m: 5, reason: d.dock_doors ? `${d.dock_doors} doors` : 'Unknown — using baseline 3' },
                { l: isIOS ? 'Lot:Building Ratio' : 'Size Fit', s: scores.size_fit || 0, m: 4, reason: isIOS ? (sf > 0 ? `${((Number(d.lot_acres) || 0) * 43560 / sf).toFixed(1)}x ratio` : '—') : (sf > 0 ? `${sf.toLocaleString()} SF (sweet spot 5K-25K)` : '—') },
              ]},
              { tier: 'Market (15 pts)', items: [
                { l: 'Market Quality', s: scores.market || 0, m: 6, reason: d.market ? `${d.market} — secondary market` : 'No market set' },
                { l: 'Interstate', s: scores.interstate || 0, m: 5, reason: d.distance_interstate ? `${d.distance_interstate} mi` : 'Unknown — using baseline 3' },
                { l: 'Tenant Demand', s: scores.demand || 0, m: 4, reason: d.tenant_demand ? `${d.tenant_demand}/5 rated` : 'Default baseline' },
              ]},
              { tier: 'Deal Edge (20 pts)', items: [
                { l: 'Broker', s: scores.broker || 0, m: 10, reason: d.contact_name ? `${d.contact_name}${(d.contact_method || '').includes('cbre') ? ' (CBRE — sophisticated)' : (d.contact_method || '').includes('kw') ? ' (KW — unsophisticated)' : ''}` : 'Unknown broker' },
                { l: 'Off-Market', s: scores.off_market || 0, m: 6, reason: (scores.off_market || 0) > 0 ? 'Off-market / owner-occupied detected' : 'Listed deal — add "off-market" to notes for credit' },
                { l: 'Seller Motivation', s: scores.seller || 0, m: 4, reason: (scores.seller || 0) > 0 ? 'Motivation signals detected' : 'No signals — add "estate" "aging" "motivated" to notes' },
              ]},
            ]

            return (
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <F l="Clear height (ft)" k="clear_height" t="number" ph="22" h />
                  <F l="Doors (docks + drive-ins)" k="dock_doors" t="number" ph="4" h />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <F l="Dist. to I-xx (mi)" k="distance_interstate" t="number" ph="2.0" h />
                  <F l="Tenant demand (1-5)" k="tenant_demand" t="number" ph="3" h />
                </div>

                {/* Score breakdown with reasoning */}
                <div style={{ background: B.blue05, borderRadius: 4, padding: 14, border: `1px solid ${B.blue20}`, marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase' }}>Score v2.1</span>
                    <Badge bg={g.bg} color={g.tx} border={g.bd} style={{ fontSize: 13, padding: '3px 10px' }}>{grade} &middot; {total}/{MAX_SCORE}</Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, height: 6, background: B.gray20, borderRadius: 3 }}>
                      <div style={{ width: `${total}%`, height: '100%', background: total >= 75 ? '#10B981' : total >= 65 ? B.amber : total >= 50 ? B.blue : B.red, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                  {estYOC > 0 && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 6 }}>Est. YOC: {estYOC}% | {isIOS ? 'IOS site' : 'Building deal'} | Market: {d.market || 'unknown'}</div>}

                  {scoreItems.map((tier, ti) => (
                    <div key={ti}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginTop: ti > 0 ? 10 : 4, marginBottom: 4 }}>Tier {ti + 1} — {tier.tier}</div>
                      {tier.items.map((item, ii) => {
                        const oKey = item.l.toLowerCase().replace(/[^a-z]/g, '_')
                        const overrides = (() => { try { return JSON.parse(d.score_overrides || '{}') } catch(e) { return {} } })()
                        const hasOverride = overrides[oKey] !== undefined && overrides[oKey] !== ''
                        const displayScore = hasOverride ? Number(overrides[oKey]) : item.s
                        return (
                          <div key={ii} style={{ padding: '4px 0', borderBottom: `1px solid ${B.blue10}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{item.l}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 36, height: 4, background: B.gray20, borderRadius: 2 }}>
                                  <div style={{ width: `${item.m > 0 ? (displayScore / item.m) * 100 : 0}%`, height: '100%', background: displayScore === item.m ? '#10B981' : displayScore > item.m * 0.5 ? '#F59E0B' : displayScore > 0 ? '#6B7280' : '#EF4444', borderRadius: 2 }} />
                                </div>
                                <input type="number" min="0" max={item.m} value={hasOverride ? overrides[oKey] : item.s}
                                  onChange={e => {
                                    const ov = { ...overrides }
                                    const val = e.target.value
                                    if (val === '' || val === String(item.s)) delete ov[oKey]
                                    else ov[oKey] = val
                                    set('score_overrides', JSON.stringify(ov))
                                  }}
                                  style={{ width: 28, padding: '1px 2px', border: `1px solid ${hasOverride ? '#F59E0B' : B.gray20}`, borderRadius: 2, fontSize: 10, fontWeight: 700, fontFamily: hf, textAlign: 'center', color: hasOverride ? '#92400E' : (displayScore === item.m ? '#065F46' : displayScore > 0 ? '#6B7280' : '#991B1B'), background: hasOverride ? '#FFFBEB' : 'transparent' }} />
                                <span style={{ fontSize: 9, color: B.gray40, fontFamily: bf }}>/{item.m}</span>
                              </div>
                            </div>
                            <div style={{ fontSize: 9, color: B.gray60, fontFamily: bf, marginTop: 1 }}>{item.reason}</div>
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  {penalties < 0 && (
                    <div style={{ marginTop: 8, padding: '6px 8px', background: B.redLight, borderRadius: 3, fontSize: 11, color: B.redDark, fontFamily: bf }}>
                      Penalties: {penalties} pts (flood zone / zoning / environmental flags in notes)
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Activity tab */}
          {tab === 'activity' && (
            <div>
              {deal.id ? (
                <>
                  {/* Add activity */}
                  <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                      {ACTIVITY_TYPES.map(at => (
                        <button key={at.id} onClick={() => setNewActivity(p => ({ ...p, type: at.id }))} style={{
                          padding: '3px 8px', borderRadius: 3, fontSize: 10, fontFamily: hf,
                          border: `1px solid ${newActivity.type === at.id ? B.blue : B.gray20}`,
                          background: newActivity.type === at.id ? B.blue05 : 'transparent',
                          color: newActivity.type === at.id ? B.blue : B.gray,
                          cursor: 'pointer', fontWeight: newActivity.type === at.id ? 700 : 400,
                        }}>{at.label}</button>
                      ))}
                    </div>
                    <textarea style={{ ...is, minHeight: 50, resize: 'vertical', marginBottom: 8 }} value={newActivity.content} onChange={e => setNewActivity(p => ({ ...p, content: e.target.value }))} placeholder="Called owner, left voicemail..." />
                    <button onClick={addActivity} disabled={!newActivity.content.trim()} style={{ padding: '6px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: newActivity.content.trim() ? 1 : 0.4 }}>Add entry</button>
                  </div>

                  {/* Activity timeline */}
                  {activities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: B.gray40, fontSize: 12, fontFamily: bf }}>No activity logged yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {activities.map(a => {
                        const at = ACTIVITY_TYPES.find(t => t.id === a.type) || ACTIVITY_TYPES[0]
                        return (
                          <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${B.gray10}` }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: B.blue05, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, flexShrink: 0 }}>{at.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: B.blue, fontFamily: hf, textTransform: 'uppercase' }}>{at.label}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 10, color: B.gray60, fontFamily: bf }}>{new Date(a.created_at).toLocaleDateString()} {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  <button onClick={() => deleteActivity(a.id)} style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 10, fontFamily: bf }}>x</button>
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: B.black, fontFamily: bf, marginTop: 2, lineHeight: 1.4 }}>{a.content}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 20, color: B.gray40, fontSize: 12, fontFamily: bf }}>Save the deal first to start logging activity</div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar - always visible score card */}
        <div style={{ flex: '0 0 200px', minWidth: 180 }}>
          <div style={{ background: B.blue05, borderRadius: 4, padding: 12, border: `1px solid ${B.blue20}`, position: 'sticky', top: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: total >= 90 ? '#10B981' : total >= 80 ? B.green : total >= 60 ? B.amber : total >= 40 ? B.blue : B.red, fontFamily: hf }}>{grade}</div>
              <div style={{ fontSize: 12, color: B.gray, fontFamily: bf }}>{total} / {MAX_SCORE} pts</div>
            </div>
            <div style={{ height: 4, background: B.gray20, borderRadius: 2, marginBottom: 10 }}>
              <div style={{ width: `${Math.round(total / MAX_SCORE * 100)}%`, height: '100%', background: total >= 90 ? '#10B981' : total >= 80 ? B.green : total >= 60 ? B.amber : total >= 40 ? B.blue : B.red, borderRadius: 2 }} />
            </div>
            {d.asking_price && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 2 }}>Ask: <span style={{ color: B.black, fontWeight: 600 }}>${Math.round(Number(d.asking_price)).toLocaleString()}</span></div>}
            {d.building_sf && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 2 }}>SF: <span style={{ color: B.black, fontWeight: 600 }}>{Number(d.building_sf).toLocaleString()}</span></div>}
            {d.lot_acres && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 2 }}>Acres: <span style={{ color: B.black, fontWeight: 600 }}>{d.lot_acres}</span></div>}
            {d.cap_rate && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 2 }}>Cap: <span style={{ color: B.black, fontWeight: 600 }}>{d.cap_rate}%</span></div>}
            {d.color_code && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 2 }}>Flag: <span style={{ color: d.color_code === 'Red' ? B.red : d.color_code === 'Yellow' ? B.amber : B.blue, fontWeight: 600 }}>{d.color_code}</span></div>}
            {d.letter_grade && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>Grade: <span style={{ color: B.black, fontWeight: 600 }}>{d.letter_grade}</span></div>}
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={handleSave} disabled={saving} style={{ padding: '9px 0', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: saving ? 0.6 : 1, width: '100%' }}>{saving ? 'Saving...' : 'Save deal'}</button>
            <button onClick={onCancel} style={{ padding: '9px 0', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 13, cursor: 'pointer', fontFamily: bf, width: '100%' }}>Back</button>
            {deal.id && <button onClick={() => onDelete(deal.id)} style={{ padding: '9px 0', background: 'transparent', color: B.red, border: `1px solid ${B.redLight}`, borderRadius: 3, fontSize: 12, cursor: 'pointer', fontFamily: bf, width: '100%' }}>Delete deal</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
