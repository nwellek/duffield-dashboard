import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, scoreDeal, gradeColor, fmt, Badge } from '../lib/brand'

export default function AlertsTab({ deals, onPromote }) {
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('new')

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase.from('deal_alerts').select('*').order('created_at', { ascending: false })
    if (data) setAlerts(data)
  }, [])
  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const updateStatus = async (id, status) => {
    await supabase.from('deal_alerts').update({ status }).eq('id', id)
    fetchAlerts()
  }

  const promoteAlert = async (alert) => {
    const newDeal = {
      address: alert.address || '', city: alert.city || '', state: alert.state || '',
      market: alert.market || 'Other', status: 'tracked', property_type: 'Small bay industrial',
      asking_price: alert.asking_price, building_sf: alert.building_sf, lot_acres: alert.lot_acres,
      price_per_sf: alert.price_per_sf, cap_rate: alert.cap_rate, notes: `Source: ${alert.source}. ${alert.url || ''}`,
      source: alert.source,
    }
    const { error } = await supabase.from('deals').insert(newDeal)
    if (!error) {
      await updateStatus(alert.id, 'promoted')
      if (onPromote) onPromote()
    }
  }

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.status === filter)
  const newCount = alerts.filter(a => a.status === 'new').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {[{ id: 'new', label: 'New' }, { id: 'promoted', label: 'Promoted' }, { id: 'dismissed', label: 'Dismissed' }, { id: 'all', label: 'All' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: filter === f.id ? 700 : 400, border: `1px solid ${filter === f.id ? B.blue : B.gray40}`, background: filter === f.id ? B.blue : 'transparent', color: filter === f.id ? B.white : B.gray, cursor: 'pointer', fontFamily: hf, textTransform: 'uppercase' }}>{f.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{newCount} new alert{newCount !== 1 ? 's' : ''}</div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, fontFamily: bf }}>
          <div style={{ fontSize: 36, marginBottom: 12, color: B.gray40 }}>&#9889;</div>
          <div style={{ fontSize: 14, color: B.gray, marginBottom: 6 }}>No alerts{filter !== 'all' ? ` with status "${filter}"` : ''}</div>
          <div style={{ fontSize: 12, color: B.gray60 }}>Your Mac Mini bot will POST new Crexi/LoopNet listings here via the API.</div>
          <div style={{ fontSize: 11, color: B.gray40, marginTop: 12, background: B.gray10, borderRadius: 3, padding: '8px 12px', display: 'inline-block', textAlign: 'left' }}>
            <div style={{ fontFamily: hf, fontWeight: 700, marginBottom: 4 }}>Bot endpoint:</div>
            <code style={{ fontSize: 10 }}>POST /api/alerts</code>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(a => {
            const { total, grade } = scoreDeal(a)
            const g = gradeColor(grade)
            return (
              <div key={a.id} style={{ background: B.white, borderRadius: 4, padding: '12px 14px', border: `1px solid ${a.status === 'new' ? B.blue20 : B.gray20}`, borderLeft: `3px solid ${a.status === 'new' ? B.blue : a.status === 'promoted' ? B.green : B.gray40}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: B.black, fontFamily: hf }}>{a.address || 'Unknown address'}</div>
                    <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{a.city}{a.state ? `, ${a.state}` : ''} &mdash; {a.source} &mdash; {new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                  <Badge bg={g.bg} color={g.tx} border={g.bd}>{grade}&middot;{total}</Badge>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: B.gray80, fontFamily: bf, marginBottom: 8 }}>
                  {a.asking_price ? <span>{fmt(a.asking_price)}</span> : null}
                  {a.building_sf ? <span>{Number(a.building_sf).toLocaleString()} SF</span> : null}
                  {a.lot_acres ? <span>{a.lot_acres} ac</span> : null}
                  {a.cap_rate ? <span>{a.cap_rate}%</span> : null}
                  {a.url && <a href={a.url} target="_blank" rel="noopener" style={{ color: B.blue, textDecoration: 'none' }}>View listing &#8599;</a>}
                </div>
                {a.status === 'new' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => promoteAlert(a)} style={{ padding: '5px 12px', background: B.green, color: B.white, border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: bf }}>Promote to pipeline</button>
                    <button onClick={() => updateStatus(a.id, 'dismissed')} style={{ padding: '5px 12px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 11, cursor: 'pointer', fontFamily: bf }}>Dismiss</button>
                  </div>
                )}
                {a.status === 'promoted' && <div style={{ fontSize: 11, color: B.green, fontWeight: 600, fontFamily: bf }}>Added to pipeline</div>}
                {a.status === 'dismissed' && <div style={{ fontSize: 11, color: B.gray40, fontFamily: bf }}>Dismissed</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
