import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, fmt, MARKETS, Badge } from '../lib/brand'

const COMP_TYPES = [
  { id: 'sale', label: 'Sales', color: '#1C4587' },
  { id: 'listing', label: 'Listings', color: '#F59E0B' },
  { id: 'lease', label: 'Leases', color: '#10B981' },
]

export default function CompsTab() {
  const [comps, setComps] = useState([])
  const [market, setMarket] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState(null)
  const [newComp, setNewComp] = useState({ market: MARKETS[0], comp_type: 'sale', address: '', city: '', state: '', building_sf: '', lot_acres: '', price: '', price_per_sf: '', rent_psf: '', cap_rate: '', clear_height: '', year_built: '', buyer: '', seller: '', broker: '', source: '', notes: '', comp_date: new Date().toISOString().slice(0, 10) })

  const fetchComps = useCallback(async () => {
    let q = supabase.from('market_comps').select('*').order('comp_date', { ascending: false }).limit(500)
    if (market !== 'all') q = q.eq('market', market)
    if (typeFilter !== 'all') q = q.eq('comp_type', typeFilter)
    const { data } = await q
    if (data) setComps(data)
  }, [market, typeFilter])
  useEffect(() => { fetchComps() }, [fetchComps])

  const addComp = async () => {
    const cleaned = { ...newComp }
    ;['building_sf', 'lot_acres', 'price', 'price_per_sf', 'rent_psf', 'cap_rate', 'clear_height', 'year_built'].forEach(k => {
      cleaned[k] = cleaned[k] ? Number(String(cleaned[k]).replace(/,/g, '')) : null
    })
    if (cleaned.price && cleaned.building_sf && !cleaned.price_per_sf) cleaned.price_per_sf = Math.round(cleaned.price / cleaned.building_sf)
    if (cleaned.price && cleaned.lot_acres && !cleaned.price_per_acre) cleaned.price_per_acre = Math.round(cleaned.price / cleaned.lot_acres)
    if (!cleaned.comp_date) cleaned.comp_date = null
    await supabase.from('market_comps').insert(cleaned)
    setNewComp({ ...newComp, address: '', city: '', building_sf: '', lot_acres: '', price: '', price_per_sf: '', rent_psf: '', cap_rate: '', clear_height: '', year_built: '', buyer: '', seller: '', broker: '', source: '', notes: '' })
    setShowAdd(false); fetchComps()
  }

  const deleteComp = async (id) => { await supabase.from('market_comps').delete().eq('id', id); fetchComps() }

  const saveEdit = async () => {
    if (!editing) return
    const cleaned = { ...editing }
    ;['building_sf', 'lot_acres', 'price', 'price_per_sf', 'rent_psf', 'cap_rate', 'clear_height', 'year_built'].forEach(k => {
      cleaned[k] = cleaned[k] ? Number(String(cleaned[k]).replace(/,/g, '')) : null
    })
    await supabase.from('market_comps').update(cleaned).eq('id', cleaned.id)
    setEditing(null); fetchComps()
  }

  // CSV Import
  const handleCSV = async (file) => {
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) { alert('CSV needs a header row + data'); return }
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
    let imported = 0
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].match(/(".*?"|[^,]*)/g)?.map(v => v.replace(/"/g, '').trim()) || []
      const row = {}
      headers.forEach((h, j) => { row[h] = vals[j] || '' })
      const comp = {
        market: row.market || market !== 'all' ? (market !== 'all' ? market : row.market) : MARKETS[0],
        comp_type: (row.type || row.comp_type || 'sale').toLowerCase(),
        address: row.address || row.property || '',
        city: row.city || '',
        state: row.state || '',
        building_sf: row.sf || row.building_sf || row.sqft ? Number(String(row.sf || row.building_sf || row.sqft).replace(/,/g, '')) : null,
        lot_acres: row.acres || row.lot_acres ? Number(String(row.acres || row.lot_acres).replace(/,/g, '')) : null,
        price: row.price || row.sale_price || row.asking ? Number(String(row.price || row.sale_price || row.asking).replace(/[$,]/g, '')) : null,
        price_per_sf: row.psf || row.price_per_sf ? Number(String(row.psf || row.price_per_sf).replace(/[$,]/g, '')) : null,
        rent_psf: row.rent || row.rent_psf || row.nnn ? Number(String(row.rent || row.rent_psf || row.nnn).replace(/[$,]/g, '')) : null,
        cap_rate: row.cap || row.cap_rate ? Number(String(row.cap || row.cap_rate).replace(/%/g, '')) : null,
        clear_height: row.clear_height || row.height ? Number(row.clear_height || row.height) : null,
        year_built: row.year_built || row.year ? Number(row.year_built || row.year) : null,
        buyer: row.buyer || '',
        seller: row.seller || '',
        broker: row.broker || '',
        source: row.source || 'CSV import',
        notes: row.notes || '',
        comp_date: row.date || row.comp_date || row.sale_date || null,
      }
      if (comp.price && comp.building_sf && !comp.price_per_sf) comp.price_per_sf = Math.round(comp.price / comp.building_sf)
      await supabase.from('market_comps').insert(comp)
      imported++
    }
    alert(`Imported ${imported} comps`)
    setShowImport(false); fetchComps()
  }

  // Stats
  const sales = comps.filter(c => c.comp_type === 'sale')
  const listings = comps.filter(c => c.comp_type === 'listing')
  const leases = comps.filter(c => c.comp_type === 'lease')
  const avgPSF = sales.length > 0 ? sales.filter(c => c.price_per_sf).reduce((s, c) => s + Number(c.price_per_sf), 0) / sales.filter(c => c.price_per_sf).length : 0
  const avgRent = leases.length > 0 ? leases.filter(c => c.rent_psf).reduce((s, c) => s + Number(c.rent_psf), 0) / leases.filter(c => c.rent_psf).length : 0
  const avgListPSF = listings.length > 0 ? listings.filter(c => c.price_per_sf).reduce((s, c) => s + Number(c.price_per_sf), 0) / listings.filter(c => c.price_per_sf).length : 0

  const markets = [...new Set(comps.map(c => c.market).filter(Boolean))].sort()
  const is = { padding: '6px 8px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, fontFamily: bf, color: B.black, outline: 'none', boxSizing: 'border-box', background: B.white }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={market} onChange={e => setMarket(e.target.value)} style={{ ...is, fontWeight: 600, fontSize: 13, fontFamily: hf }}>
            <option value="all">All Markets</option>
            {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {COMP_TYPES.map(ct => (
            <button key={ct.id} onClick={() => setTypeFilter(typeFilter === ct.id ? 'all' : ct.id)} style={{
              padding: '4px 10px', borderRadius: 3, fontSize: 11, fontFamily: hf, cursor: 'pointer',
              border: `1px solid ${typeFilter === ct.id ? ct.color : B.gray20}`,
              background: typeFilter === ct.id ? ct.color : 'transparent',
              color: typeFilter === ct.id ? B.white : B.gray,
            }}>{ct.label} ({ct.id === 'sale' ? sales.length : ct.id === 'listing' ? listings.length : leases.length})</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowImport(!showImport)} style={{ padding: '6px 14px', background: B.white, color: B.blue, border: `1px solid ${B.blue}`, borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>Import CSV</button>
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '6px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>+ Add comp</button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { l: 'Avg sale $/SF', v: avgPSF > 0 ? '$' + Math.round(avgPSF) : '—', c: '#1C4587', sub: sales.length + ' sales' },
          { l: 'Avg listing $/SF', v: avgListPSF > 0 ? '$' + Math.round(avgListPSF) : '—', c: '#F59E0B', sub: listings.length + ' listings' },
          { l: 'Avg lease $/SF', v: avgRent > 0 ? '$' + avgRent.toFixed(2) : '—', c: '#10B981', sub: leases.length + ' leases' },
          { l: 'Total comps', v: comps.length, c: B.gray, sub: markets.length + ' markets' },
        ].map((m, i) => (
          <div key={i} style={{ flex: '1 1 120px', background: B.white, borderRadius: 4, padding: '10px 14px', border: `1px solid ${B.gray20}`, minWidth: 100 }}>
            <div style={{ fontSize: 9, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, fontFamily: hf }}>{m.v}</div>
            <div style={{ fontSize: 10, color: B.gray60, fontFamily: bf }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* CSV Import */}
      {showImport && (
        <div style={{ background: B.blue05, borderRadius: 4, padding: 14, border: `1px solid ${B.blue20}`, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 6 }}>Import CSV</div>
          <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, marginBottom: 8 }}>
            CSV headers: address, city, state, market, type (sale/listing/lease), sf, acres, price, psf, rent, cap, clear_height, year, buyer, seller, broker, source, date, notes
          </div>
          <input type="file" accept=".csv" onChange={e => { if (e.target.files[0]) handleCSV(e.target.files[0]) }} style={{ fontSize: 11, fontFamily: bf }} />
        </div>
      )}

      {/* Add comp form */}
      {showAdd && (
        <div style={{ background: B.white, borderRadius: 4, padding: 14, border: `1px solid ${B.gray20}`, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 8 }}>Add comp</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <select value={newComp.market} onChange={e => setNewComp(p => ({ ...p, market: e.target.value }))} style={{ ...is, width: 150 }}>
              {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={newComp.comp_type} onChange={e => setNewComp(p => ({ ...p, comp_type: e.target.value }))} style={{ ...is, width: 100 }}>
              <option value="sale">Sale</option>
              <option value="listing">Listing</option>
              <option value="lease">Lease</option>
            </select>
            <input style={{ ...is, width: 90 }} type="date" value={newComp.comp_date} onChange={e => setNewComp(p => ({ ...p, comp_date: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <input style={{ ...is, flex: '1 1 200px' }} placeholder="Address" value={newComp.address} onChange={e => setNewComp(p => ({ ...p, address: e.target.value }))} />
            <input style={{ ...is, width: 100 }} placeholder="City" value={newComp.city} onChange={e => setNewComp(p => ({ ...p, city: e.target.value }))} />
            <input style={{ ...is, width: 40 }} placeholder="ST" value={newComp.state} onChange={e => setNewComp(p => ({ ...p, state: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <input style={{ ...is, width: 80 }} placeholder="SF" value={newComp.building_sf} onChange={e => setNewComp(p => ({ ...p, building_sf: e.target.value }))} />
            <input style={{ ...is, width: 60 }} placeholder="Acres" value={newComp.lot_acres} onChange={e => setNewComp(p => ({ ...p, lot_acres: e.target.value }))} />
            <input style={{ ...is, width: 100 }} placeholder="Price" value={newComp.price} onChange={e => setNewComp(p => ({ ...p, price: e.target.value }))} />
            <input style={{ ...is, width: 60 }} placeholder="$/SF" value={newComp.price_per_sf} onChange={e => setNewComp(p => ({ ...p, price_per_sf: e.target.value }))} />
            <input style={{ ...is, width: 60 }} placeholder="Rent" value={newComp.rent_psf} onChange={e => setNewComp(p => ({ ...p, rent_psf: e.target.value }))} />
            <input style={{ ...is, width: 50 }} placeholder="Cap%" value={newComp.cap_rate} onChange={e => setNewComp(p => ({ ...p, cap_rate: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <input style={{ ...is, width: 100 }} placeholder="Buyer" value={newComp.buyer} onChange={e => setNewComp(p => ({ ...p, buyer: e.target.value }))} />
            <input style={{ ...is, width: 100 }} placeholder="Seller" value={newComp.seller} onChange={e => setNewComp(p => ({ ...p, seller: e.target.value }))} />
            <input style={{ ...is, width: 100 }} placeholder="Broker" value={newComp.broker} onChange={e => setNewComp(p => ({ ...p, broker: e.target.value }))} />
            <input style={{ ...is, width: 80 }} placeholder="Source" value={newComp.source} onChange={e => setNewComp(p => ({ ...p, source: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input style={{ ...is, flex: 1 }} placeholder="Notes" value={newComp.notes} onChange={e => setNewComp(p => ({ ...p, notes: e.target.value }))} />
            <button onClick={addComp} style={{ padding: '6px 16px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>Save</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '6px 12px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray20}`, borderRadius: 3, fontSize: 11, cursor: 'pointer', fontFamily: bf }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Comps table */}
      <div style={{ background: B.white, borderRadius: 4, border: `1px solid ${B.gray20}`, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['Type', 'Date', 'Address', 'Market', 'SF', 'Acres', 'Price', '$/SF', 'Rent', 'Cap', 'Broker', 'Source', ''].map(h => (
              <th key={h} style={{ background: B.blue05, padding: '6px 8px', fontSize: 10, fontFamily: hf, textAlign: h === 'Price' || h === '$/SF' || h === 'Rent' || h === 'Cap' ? 'right' : 'left', borderBottom: `2px solid ${B.gray20}`, color: B.blue, position: 'sticky', top: 0, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {comps.length === 0 && <tr><td colSpan={13} style={{ padding: 20, textAlign: 'center', color: B.gray40, fontSize: 12, fontFamily: bf }}>No comps yet. Add manually or import CSV.</td></tr>}
            {comps.map(c => {
              const ct = COMP_TYPES.find(t => t.id === c.comp_type) || COMP_TYPES[0]
              const isEd = editing?.id === c.id
              if (isEd) return (
                <tr key={c.id} style={{ background: '#FFFBEB' }}>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}>
                    <select style={{ ...is, width: 60, fontSize: 10 }} value={editing.comp_type} onChange={e => setEditing(p => ({ ...p, comp_type: e.target.value }))}>
                      <option value="sale">Sale</option><option value="listing">Listing</option><option value="lease">Lease</option>
                    </select>
                  </td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}><input style={{ ...is, width: 90, fontSize: 10 }} type="date" value={editing.comp_date || ''} onChange={e => setEditing(p => ({ ...p, comp_date: e.target.value }))} /></td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}><input style={{ ...is, width: 140, fontSize: 10 }} value={editing.address || ''} onChange={e => setEditing(p => ({ ...p, address: e.target.value }))} /></td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}>
                    <select style={{ ...is, width: 100, fontSize: 10 }} value={editing.market} onChange={e => setEditing(p => ({ ...p, market: e.target.value }))}>
                      {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}><input style={{ ...is, width: 55, fontSize: 10, textAlign: 'right' }} value={editing.building_sf || ''} onChange={e => setEditing(p => ({ ...p, building_sf: e.target.value }))} /></td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}><input style={{ ...is, width: 40, fontSize: 10, textAlign: 'right' }} value={editing.lot_acres || ''} onChange={e => setEditing(p => ({ ...p, lot_acres: e.target.value }))} /></td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}><input style={{ ...is, width: 70, fontSize: 10, textAlign: 'right' }} value={editing.price || ''} onChange={e => setEditing(p => ({ ...p, price: e.target.value }))} /></td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}><input style={{ ...is, width: 40, fontSize: 10, textAlign: 'right' }} value={editing.price_per_sf || ''} onChange={e => setEditing(p => ({ ...p, price_per_sf: e.target.value }))} /></td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}><input style={{ ...is, width: 40, fontSize: 10, textAlign: 'right' }} value={editing.rent_psf || ''} onChange={e => setEditing(p => ({ ...p, rent_psf: e.target.value }))} /></td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}><input style={{ ...is, width: 35, fontSize: 10, textAlign: 'right' }} value={editing.cap_rate || ''} onChange={e => setEditing(p => ({ ...p, cap_rate: e.target.value }))} /></td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}><input style={{ ...is, width: 70, fontSize: 10 }} value={editing.broker || ''} onChange={e => setEditing(p => ({ ...p, broker: e.target.value }))} /></td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}><input style={{ ...is, width: 60, fontSize: 10 }} value={editing.source || ''} onChange={e => setEditing(p => ({ ...p, source: e.target.value }))} /></td>
                  <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}`, whiteSpace: 'nowrap' }}>
                    <button onClick={saveEdit} style={{ fontSize: 9, color: B.blue, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: hf }}>Save</button>
                    <button onClick={() => setEditing(null)} style={{ fontSize: 9, color: B.gray, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 2 }}>X</button>
                  </td>
                </tr>
              )
              return (
                <tr key={c.id} onClick={() => setEditing({ ...c })} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = B.blue05} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '5px 8px', borderBottom: `1px solid ${B.gray10}` }}>
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, background: ct.color + '18', color: ct.color, fontWeight: 600, fontFamily: hf }}>{ct.label.slice(0, -1)}</span>
                  </td>
                  <td style={{ padding: '5px 8px', fontSize: 11, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, color: B.gray, whiteSpace: 'nowrap' }}>{c.comp_date ? new Date(c.comp_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '—'}</td>
                  <td style={{ padding: '5px 8px', fontSize: 11, fontFamily: hf, fontWeight: 600, borderBottom: `1px solid ${B.gray10}`, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || '—'}</td>
                  <td style={{ padding: '5px 8px', fontSize: 10, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, color: B.gray }}>{c.market}</td>
                  <td style={{ padding: '5px 8px', fontSize: 11, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, textAlign: 'right' }}>{c.building_sf ? Number(c.building_sf).toLocaleString() : '—'}</td>
                  <td style={{ padding: '5px 8px', fontSize: 11, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, textAlign: 'right' }}>{c.lot_acres || '—'}</td>
                  <td style={{ padding: '5px 8px', fontSize: 11, fontFamily: hf, fontWeight: 600, borderBottom: `1px solid ${B.gray10}`, textAlign: 'right' }}>{c.price ? fmt(c.price) : '—'}</td>
                  <td style={{ padding: '5px 8px', fontSize: 11, fontFamily: hf, fontWeight: 600, borderBottom: `1px solid ${B.gray10}`, textAlign: 'right', color: '#1C4587' }}>{c.price_per_sf ? '$' + Number(c.price_per_sf).toLocaleString() : '—'}</td>
                  <td style={{ padding: '5px 8px', fontSize: 11, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, textAlign: 'right', color: '#10B981' }}>{c.rent_psf ? '$' + Number(c.rent_psf).toFixed(2) : '—'}</td>
                  <td style={{ padding: '5px 8px', fontSize: 11, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, textAlign: 'right' }}>{c.cap_rate ? c.cap_rate + '%' : '—'}</td>
                  <td style={{ padding: '5px 8px', fontSize: 10, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, color: B.gray, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.broker || '—'}</td>
                  <td style={{ padding: '5px 8px', fontSize: 10, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, color: B.gray40 }}>{c.source || '—'}</td>
                  <td style={{ padding: '5px 4px', borderBottom: `1px solid ${B.gray10}` }}>
                    <button onClick={e => { e.stopPropagation(); deleteComp(c.id) }} style={{ fontSize: 10, color: B.gray40, background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
