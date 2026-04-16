import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, COLUMNS, scoreDeal, gradeColor, fmt, Badge } from '../lib/brand'

const STATUS_ORDER = { owned: 0, under_contract: 1, loi_sent: 2, pursuit: 3, under_review: 4, tracked: 5, dead: 6 }

export default function TableView({ deals, onClickDeal, onRefresh }) {
  const [sk, setSk] = useState('_status_order')
  const [sd, setSd] = useState(1)
  const [statusFilter, setStatusFilter] = useState('active')
  const [marketFilter, setMarketFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [processing, setProcessing] = useState(false)

  let fd = deals
  if (statusFilter === 'active') fd = fd.filter(d => d.status !== 'dead')
  else if (statusFilter !== 'all') fd = fd.filter(d => d.status === statusFilter)
  if (marketFilter !== 'all') fd = fd.filter(d => d.market === marketFilter)
  if (typeFilter !== 'all') fd = fd.filter(d => d.property_type === typeFilter)
  if (search.trim().length >= 2) {
    const q = search.toLowerCase()
    fd = fd.filter(d => (d.address && d.address.toLowerCase().includes(q)) || (d.owner && d.owner.toLowerCase().includes(q)) || (d.city && d.city.toLowerCase().includes(q)))
  }

  const sorted = [...fd].sort((a, b) => {
    if (sk === '_status_order') {
      const ao = STATUS_ORDER[a.status] ?? 99, bo = STATUS_ORDER[b.status] ?? 99
      return sd * (ao - bo)
    }
    let av = a[sk], bv = b[sk]
    if (typeof av === 'string') return sd * (av || '').localeCompare(bv || '')
    return sd * ((Number(av) || 0) - (Number(bv) || 0))
  })

  const tg = k => { if (sk === k) setSd(d => d * -1); else { setSk(k); setSd(1) } }

  const toggleSelect = (id) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const toggleAll = () => {
    if (selected.size === sorted.length) setSelected(new Set())
    else setSelected(new Set(sorted.map(d => d.id)))
  }

  const executeBulk = async () => {
    if (!bulkAction || selected.size === 0) return
    setProcessing(true)
    const ids = [...selected]
    if (bulkAction === 'delete') {
      for (const id of ids) await supabase.from('deals').delete().eq('id', id)
    } else {
      for (const id of ids) await supabase.from('deals').update({ status: bulkAction, updated_at: new Date().toISOString() }).eq('id', id)
    }
    setSelected(new Set()); setBulkAction(''); setProcessing(false)
    if (onRefresh) onRefresh()
  }

  // Inline edit
  const [editCell, setEditCell] = useState(null) // {id, field}
  const [editVal, setEditVal] = useState('')

  const startEdit = (id, field, val) => { setEditCell({ id, field }); setEditVal(val || '') }
  const saveEdit = async () => {
    if (!editCell) return
    const val = ['asking_price', 'lot_acres', 'building_sf'].includes(editCell.field) ? (editVal ? Number(editVal) : null) : editVal
    await supabase.from('deals').update({ [editCell.field]: val, updated_at: new Date().toISOString() }).eq('id', editCell.id)
    setEditCell(null); setEditVal('')
    if (onRefresh) onRefresh()
  }
  const cancelEdit = () => { setEditCell(null); setEditVal('') }

  const editInput = (id, field, val) => {
    if (editCell && editCell.id === id && editCell.field === field) {
      return <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
        onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
        style={{ width: '100%', padding: '2px 4px', border: `1px solid ${B.blue}`, borderRadius: 2, fontSize: 11, fontFamily: bf, outline: 'none', boxSizing: 'border-box', background: B.blue05 }}
        onClick={e => e.stopPropagation()} />
    }
    return <span onClick={e => { e.stopPropagation(); startEdit(id, field, val) }} style={{ cursor: 'text', display: 'block', minWidth: 30, minHeight: 16 }}>{val || '\u2014'}</span>
  }
  const changeStatus = async (id, newStatus) => {
    await supabase.from('deals').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    if (onRefresh) onRefresh()
  }

  const exportCSV = () => {
    const headers = ['Address','City','State','Market','Status','Type','Latest Acq Price','SF','Acres','Cap Rate','Score','Grade','Owner','Phone','Email','Notes']
    const rows = sorted.map(d => {
      let total = 0, grade = 'D'; try { const r = scoreDeal(d); total = r.total || 0; grade = r.grade || 'D' } catch(e) {}
      return [d.address, d.city, d.state, d.market, d.status, d.property_type, d.asking_price || '', d.building_sf || '', d.lot_acres || '', d.cap_rate || '', total, grade, d.owner || '', d.owner_phone || '', d.owner_email || '', (d.notes || '').replace(/"/g, '""')]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `duffield_deals_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const activeMarkets = [...new Set(deals.map(d => d.market).filter(Boolean))].sort()
  const activeTypes = [...new Set(deals.map(d => d.property_type).filter(Boolean))].sort()

  const th = { fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', letterSpacing: 0.3, padding: '6px 6px', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }
  const td = { fontSize: 12, color: B.black, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, whiteSpace: 'nowrap', fontFamily: bf }
  const selStyle = { padding: '3px 8px', border: `1px solid ${B.gray20}`, borderRadius: 3, fontSize: 11, fontFamily: bf, color: B.gray, background: B.white, cursor: 'pointer' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ padding: '6px 10px', border: `1px solid ${B.gray20}`, borderRadius: 3, fontSize: 12, fontFamily: bf, color: B.black, width: 170, outline: 'none' }} placeholder="Filter address / owner..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={selStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {COLUMNS.map(c => { const n = deals.filter(d => d.status === c.id).length; return n > 0 ? <option key={c.id} value={c.id}>{c.label} ({n})</option> : null })}
        </select>
        <select style={selStyle} value={marketFilter} onChange={e => setMarketFilter(e.target.value)}>
          <option value="all">All markets</option>
          {activeMarkets.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select style={selStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {activeTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{sorted.length} deals</span>
          <button onClick={exportCSV} style={{ padding: '4px 10px', background: B.white, border: `1px solid ${B.gray20}`, borderRadius: 3, fontSize: 11, fontFamily: hf, color: B.blue, cursor: 'pointer', fontWeight: 600 }}>Export CSV</button>
        </div>
      </div>

      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: B.blue05, borderRadius: 3, border: `1px solid ${B.blue20}`, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: B.blue, fontFamily: hf }}>{selected.size} selected</span>
          <select style={{ ...selStyle, borderColor: B.blue20 }} value={bulkAction} onChange={e => setBulkAction(e.target.value)}>
            <option value="">Choose action...</option>
            {COLUMNS.map(c => <option key={c.id} value={c.id}>Move to: {c.label}</option>)}
            <option value="delete">Delete selected</option>
          </select>
          <button onClick={executeBulk} disabled={!bulkAction || processing} style={{ padding: '4px 12px', background: bulkAction === 'delete' ? B.red : B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: !bulkAction || processing ? 0.5 : 1 }}>
            {processing ? 'Working...' : 'Apply'}
          </button>
          <button onClick={() => setSelected(new Set())} style={{ padding: '4px 10px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 11, cursor: 'pointer', fontFamily: bf }}>Clear</button>
        </div>
      )}

      <div style={{ marginBottom: 6, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <button onClick={() => setStatusFilter('active')} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: statusFilter === 'active' ? 700 : 400, border: `1px solid ${statusFilter === 'active' ? B.blue : B.gray20}`, background: statusFilter === 'active' ? B.blue : 'transparent', color: statusFilter === 'active' ? B.white : B.gray, cursor: 'pointer', fontFamily: hf, textTransform: 'uppercase' }}>Active ({deals.filter(d => d.status !== 'dead').length})</button>
        <button onClick={() => setStatusFilter('all')} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: statusFilter === 'all' ? 700 : 400, border: `1px solid ${statusFilter === 'all' ? B.gray : B.gray20}`, background: statusFilter === 'all' ? B.gray : 'transparent', color: statusFilter === 'all' ? B.white : B.gray, cursor: 'pointer', fontFamily: hf, textTransform: 'uppercase' }}>All ({deals.length})</button>
        {COLUMNS.map(c => {
          const n = deals.filter(d => d.status === c.id).length
          if (n === 0) return null
          const a = statusFilter === c.id
          return <button key={c.id} onClick={() => setStatusFilter(a ? 'all' : c.id)} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: a ? 700 : 400, border: `1px solid ${a ? c.color : B.gray20}`, background: a ? c.color : 'transparent', color: a ? B.white : B.gray, cursor: 'pointer', fontFamily: hf, textTransform: 'uppercase' }}>{c.label} ({n})</button>
        })}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 3, border: `1px solid ${B.gray20}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: B.white }}>
          <thead><tr>
            <th style={th} onClick={() => tg('address')}>Property {sk === 'address' ? (sd > 0 ? '\u2191' : '\u2193') : ''}</th>
            <th style={th} onClick={() => tg('city')}>City, St {sk === 'city' ? (sd > 0 ? '\u2191' : '\u2193') : ''}</th>
            <th style={th} onClick={() => tg('market')}>Market</th>
            <th style={th} onClick={() => tg('_status_order')}>Status {sk === '_status_order' ? (sd > 0 ? '\u2191' : '\u2193') : ''}</th>
            <th style={th} onClick={() => tg('asking_price')}>Price</th>
            <th style={th} onClick={() => tg('lot_acres')}>Acres</th>
            <th style={th} onClick={() => tg('building_sf')}>SF</th>
            <th style={th}>Owner</th>
            <th style={th}>Broker</th>
            <th style={th}>Score</th>
          </tr></thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: B.gray40, fontSize: 12, fontFamily: bf }}>No deals match</td></tr>}
            {sorted.map(d => {
              let total = 0, grade = 'D'; try { const r = scoreDeal(d); total = r.total || 0; grade = r.grade || 'D' } catch(e) {}; const g = gradeColor(grade); const col = COLUMNS.find(c => c.id === d.status)
              return (
                <tr key={d.id} style={{ background: B.white }}
                  onMouseEnter={e => e.currentTarget.style.background = B.gray10}
                  onMouseLeave={e => e.currentTarget.style.background = B.white}>
                  <td style={{ ...td, fontWeight: 600, fontFamily: hf, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }} onClick={() => onClickDeal(d)}>{d.address || '\u2014'}</td>
                  <td style={{ ...td, fontSize: 11, color: B.gray, whiteSpace: 'nowrap' }}>{d.city}{d.state ? `, ${d.state}` : ''}</td>
                  <td style={{ ...td, fontSize: 11 }}>{d.market}</td>
                  <td style={{ ...td, padding: '3px 4px' }} onClick={e => e.stopPropagation()}>
                    <select value={d.status} onChange={e => changeStatus(d.id, e.target.value)} style={{
                      padding: '2px 4px', borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${col?.color || B.gray}20`,
                      background: (col?.color || B.gray) + '18',
                      color: col?.color || B.gray, fontFamily: hf,
                    }}>
                      {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </td>
                  <td style={td}>{editInput(d.id, 'asking_price', d.asking_price ? fmt(d.asking_price) : '')}</td>
                  <td style={td}>{editInput(d.id, 'lot_acres', d.lot_acres)}</td>
                  <td style={td}>{editInput(d.id, 'building_sf', d.building_sf ? Number(d.building_sf).toLocaleString() : '')}</td>
                  <td style={{ ...td, fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', color: B.gray }}>{d.owner || '\u2014'}</td>
                  <td style={{ ...td, fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', color: B.gray }}>{d.contact_name || '\u2014'}</td>
                  <td style={td}><Badge bg={g.bg} color={g.tx}>{grade}&middot;{total}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
