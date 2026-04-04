import { useState } from 'react'
import { B, hf, bf, COLUMNS, MARKETS, scoreDeal, gradeColor, fmt, Badge } from '../lib/brand'

function DealCard({ deal, onClick }) {
  const { total, grade } = scoreDeal(deal)
  const g = gradeColor(grade)
  return (
    <div onClick={onClick} style={{ background: B.white, borderRadius: 3, padding: '10px 12px', borderLeft: `3px solid ${COLUMNS.find(c => c.id === deal.status)?.color || B.gray}`, cursor: 'pointer', transition: 'box-shadow 0.15s', marginBottom: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(28,69,135,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: B.black, fontFamily: hf }}>{deal.address || 'Untitled'}</div>
        <Badge bg={g.bg} color={g.tx} border={g.bd}>{grade}&middot;{total}</Badge>
      </div>
      <div style={{ fontSize: 11, color: B.gray, marginBottom: 3, fontFamily: bf }}>{deal.city}{deal.state ? `, ${deal.state}` : ''}</div>
      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: B.gray80, fontFamily: bf }}>
        {deal.asking_price ? <span>{fmt(deal.asking_price)}</span> : null}
        {deal.lot_acres ? <span>{deal.lot_acres} ac</span> : null}
        {deal.property_type && <span>{deal.property_type}</span>}
      </div>
      {deal.owner && <div style={{ fontSize: 10, color: B.gray60, fontFamily: bf, marginTop: 2 }}>{deal.owner}</div>}
    </div>
  )
}

export default function PipelineView({ deals, onClickDeal }) {
  const [marketFilter, setMarketFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)

  // Pipeline only shows deals with meaningful status - not the full canvassing database
  // "pursuit" and above are active pipeline. "under_review" is being evaluated.
  // "tracked" with source=master_property is canvassing data — hide from pipeline by default
  const pipelineDeals = showAll ? deals : deals.filter(d => {
    if (d.status === 'tracked' && d.source === 'master_property') return false
    return true
  })

  const filtered = marketFilter === 'all' ? pipelineDeals : pipelineDeals.filter(d => d.market === marketFilter)

  // Get markets that have active deals
  const activeMarkets = [...new Set(pipelineDeals.map(d => d.market).filter(Boolean))].sort()

  // Recently updated deals (last 30 days)
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentDeals = deals.filter(d => d.updated_at && new Date(d.updated_at) > thirtyDaysAgo).slice(0, 5)

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginRight: 4 }}>Market:</span>
          <button onClick={() => setMarketFilter('all')} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: marketFilter === 'all' ? 700 : 400, border: `1px solid ${marketFilter === 'all' ? B.blue : B.gray20}`, background: marketFilter === 'all' ? B.blue : 'transparent', color: marketFilter === 'all' ? B.white : B.gray, cursor: 'pointer', fontFamily: hf, textTransform: 'uppercase' }}>All</button>
          {activeMarkets.map(m => {
            const n = filtered.filter(d => d.market === m).length
            if (n === 0 && marketFilter !== m) return null
            return <button key={m} onClick={() => setMarketFilter(marketFilter === m ? 'all' : m)} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: marketFilter === m ? 700 : 400, border: `1px solid ${marketFilter === m ? B.blue : B.gray20}`, background: marketFilter === m ? B.blue : 'transparent', color: marketFilter === m ? B.white : B.gray, cursor: 'pointer', fontFamily: hf }}>{m.split(' ')[0]}</button>
          })}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: B.gray, fontFamily: bf, cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} style={{ cursor: 'pointer' }} />
          Show canvassing data ({deals.filter(d => d.status === 'tracked' && d.source === 'master_property').length})
        </label>
      </div>

      {/* Pipeline columns */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {COLUMNS.filter(col => col.id !== 'tracked' || showAll).map(col => {
          const cd = filtered.filter(d => d.status === col.id)
          const displayDeals = cd.slice(0, 20)
          return (
            <div key={col.id} style={{ minWidth: 160, flex: '1 1 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: col.color }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: B.black, textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: hf }}>{col.label}</span>
                <span style={{ fontSize: 10, color: B.gray, marginLeft: 'auto', fontFamily: bf }}>{cd.length}</span>
              </div>
              <div style={{ background: B.gray10, borderRadius: 3, padding: 5, minHeight: 60 }}>
                {displayDeals.map(d => <DealCard key={d.id} deal={d} onClick={() => onClickDeal(d)} />)}
                {cd.length > 20 && <div style={{ fontSize: 10, color: B.gray, textAlign: 'center', padding: '6px 4px', fontFamily: bf }}>+ {cd.length - 20} more</div>}
                {cd.length === 0 && <div style={{ fontSize: 11, color: B.gray40, textAlign: 'center', padding: '16px 4px', fontFamily: bf }}>Empty</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent activity */}
      {recentDeals.length > 0 && (
        <div style={{ marginTop: 16, background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 8 }}>Recently updated</div>
          {recentDeals.map(d => {
            const col = COLUMNS.find(c => c.id === d.status)
            return (
              <div key={d.id} onClick={() => onClickDeal(d)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${B.gray10}`, cursor: 'pointer', fontSize: 12, fontFamily: bf }}
                onMouseEnter={e => e.currentTarget.style.background = B.blue05} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div>
                  <span style={{ fontWeight: 600, fontFamily: hf, color: B.black }}>{d.address}</span>
                  <span style={{ color: B.gray, marginLeft: 6 }}>{d.market}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Badge bg={col.color + '18'} color={col.color} style={{ fontSize: 9 }}>{col.label}</Badge>
                  <span style={{ fontSize: 10, color: B.gray60 }}>{new Date(d.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
