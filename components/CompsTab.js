import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, fmt, MARKETS, Badge } from '../lib/brand'

const COMP_TYPES = [
  { id: 'sale', label: 'Sale', color: B.green },
  { id: 'lease', label: 'Lease', color: B.blue },
  { id: 'land', label: 'Land', color: B.amber },
]

const COMP_FIELDS = [
  { key: 'address', label: 'Address', type: 'text', w: 200 },
  { key: 'city', label: 'City', type: 'text', w: 110 },
  { key: 'state', label: 'ST', type: 'text', w: 40 },
  { key: 'comp_type', label: 'Type', type: 'select', w: 60, options: ['sale','lease','land'] },
  { key: 'building_sf', label: 'Bldg SF', type: 'number', w: 80 },
  { key: 'lot_acres', label: 'Acres', type: 'number', w: 60 },
  { key: 'year_built', label: 'Built', type: 'number', w: 55 },
  { key: 'clear_height', label: 'Clr Ht', type: 'number', w: 50 },
  { key: 'docks', label: 'Docks', type: 'number', w: 45 },
  { key: 'price', label: 'Price', type: 'number', w: 90 },
  { key: 'price_per_sf', label: '$/SF', type: 'number', w: 65 },
  { key: 'rent_psf', label: 'Rent/SF', type: 'number', w: 65 },
  { key: 'cap_rate', label: 'Cap', type: 'number', w: 50 },
  { key: 'buyer', label: 'Buyer', type: 'text', w: 110 },
  { key: 'seller', label: 'Seller/Owner', type: 'text', w: 110 },
  { key: 'comp_date', label: 'Date', type: 'date', w: 90 },
  { key: 'source', label: 'Source', type: 'text', w: 80 },
  { key: 'notes', label: 'Notes', type: 'text', w: 150 },
]

const cn = v => { if (!v && v !== 0) return null; const n = parseFloat(String(v).replace(/[$,\s%]/g, '')); return isNaN(n) ? null : n }
const fmtN = (v, d = 0) => v ? Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'
const fmtD = v => v ? new Date(v + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—'

export default function CompsTab() {
  const [comps, setComps] = useState([])
  const [loading, setLoading] = useState(true)
  const [market, setMarket] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('comp_date')
  const [sortDir, setSortDir] = useState(-1)
  const [showAdd, setShowAdd] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [extracting, setExtracting] = useState(false)
  const fileRef = useRef(null)

  const [newComp, setNewComp] = useState({
    market: MARKETS[0], comp_type: 'sale', address: '', city: '', state: '',
    building_sf: '', lot_acres: '', price: '', price_per_sf: '', rent_psf: '',
    cap_rate: '', clear_height: '', year_built: '', docks: '', buyer: '', seller: '',
    source: '', notes: '', comp_date: new Date().toISOString().slice(0, 10)
  })

  const fetchComps = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('market_comps').select('*').order('comp_date', { ascending: false }).limit(1000)
    const { data } = await q
    if (data) setComps(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchComps() }, [fetchComps])

  // Filter & sort
  let filtered = comps
  if (market !== 'all') filtered = filtered.filter(c => c.market === market)
  if (typeFilter !== 'all') filtered = filtered.filter(c => c.comp_type === typeFilter)
  if (search.trim().length >= 2) {
    const q = search.toLowerCase()
    filtered = filtered.filter(c =>
      (c.address || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q) ||
      (c.buyer || '').toLowerCase().includes(q) ||
      (c.seller || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    )
  }
  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'string') return sortDir * (av || '').localeCompare(bv || '')
    return sortDir * ((Number(av) || 0) - (Number(bv) || 0))
  })

  const toggleSort = k => { if (sortKey === k) setSortDir(d => d * -1); else { setSortKey(k); setSortDir(1) } }

  // CRUD
  const addComp = async () => {
    const cleaned = { ...newComp }
    ;['building_sf','lot_acres','price','price_per_sf','rent_psf','cap_rate','clear_height','year_built','docks'].forEach(k => {
      cleaned[k] = cn(cleaned[k])
    })
    if (cleaned.price && cleaned.building_sf && !cleaned.price_per_sf)
      cleaned.price_per_sf = Math.round(cleaned.price / cleaned.building_sf)
    if (!cleaned.comp_date) cleaned.comp_date = null
    await supabase.from('market_comps').insert(cleaned)
    setNewComp({ ...newComp, address: '', city: '', building_sf: '', lot_acres: '', price: '', price_per_sf: '', rent_psf: '', cap_rate: '', clear_height: '', year_built: '', docks: '', buyer: '', seller: '', source: '', notes: '' })
    setShowAdd(false)
    fetchComps()
  }

  const deleteComp = async (id) => {
    if (!confirm('Delete this comp?')) return
    await supabase.from('market_comps').delete().eq('id', id)
    fetchComps()
  }

  const startEdit = (id, field, val) => { setEditing({ id, field }); setEditVal(val || '') }
  const saveEdit = async () => {
    if (!editing) return
    const val = ['building_sf','lot_acres','price','price_per_sf','rent_psf','cap_rate','clear_height','year_built','docks'].includes(editing.field)
      ? cn(editVal) : editVal
    await supabase.from('market_comps').update({ [editing.field]: val }).eq('id', editing.id)
    setEditing(null); setEditVal('')
    fetchComps()
  }
  const cancelEdit = () => { setEditing(null); setEditVal('') }

  // CSV / XLSX Upload
  const handleFileUpload = async (file) => {
    if (!file) return
    const name = file.name.toLowerCase()

    if (name.endsWith('.pdf')) {
      // PDF — use Anthropic API to extract comps
      await extractFromPDF(file)
      return
    }

    setUploadStatus('Parsing...')

    if (name.endsWith('.csv')) {
      const text = await file.text()
      const Papa = (await import('papaparse')).default
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          await ingestRows(results.data, file.name)
        }
      })
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const allRows = []
      wb.SheetNames.forEach(sn => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' })
        const sheetType = sn.toLowerCase().includes('lease') ? 'lease' : sn.toLowerCase().includes('land') ? 'land' : sn.toLowerCase().includes('sale') ? 'sale' : ''
        rows.forEach(r => { if (sheetType) r._sheetType = sheetType; allRows.push(r) })
      })
      await ingestRows(allRows, file.name)
    } else {
      setUploadStatus('Unsupported file type. Use .csv, .xlsx, or .pdf')
    }
  }

  const ingestRows = async (rows, fileName) => {
    const inserts = rows.map(r => mapRow(r)).filter(Boolean)
    if (inserts.length === 0) { setUploadStatus('No valid rows found'); return }
    const { error } = await supabase.from('market_comps').insert(inserts)
    if (error) setUploadStatus(`Error: ${error.message}`)
    else { setUploadStatus(`Imported ${inserts.length} comps from ${fileName}`); fetchComps() }
    setTimeout(() => setUploadStatus(''), 4000)
  }

  const mapRow = (r) => {
    const g = (...keys) => { for (const k of keys) { const v = r[k] || r[k.toLowerCase()] || r[k.toUpperCase()]; if (v) return String(v).trim() } return '' }
    const address = g('address','Address','Property Address','Street Address','Property Name/\nAddress','Property Name/ Address','location','Location')
    if (!address) return null
    const city = g('city','City','town')
    const state = g('state','State','ST')
    const compType = (r._sheetType || g('type','Type','comp_type','Comp Type') || '').toLowerCase()
    const type = compType.includes('lease') ? 'lease' : compType.includes('land') ? 'land' : 'sale'
    return {
      address, city, state: state || 'NC', comp_type: type,
      market: g('market','Market','submarket','Submarket') || (city && state ? `${city}, ${state}` : 'Other'),
      building_sf: cn(g('building_sf','Size','SF','Building SF','Bldg SF','RBA','Size\n(% Leased)','sqft')),
      lot_acres: cn(g('lot_acres','Acres','Land Area','acres','Lot Size')),
      price: cn(g('price','Price','Asking Price','Sale Price','sale_price','Asking Price\n(Cap Rate)')),
      price_per_sf: cn(g('price_per_sf','Price PSF','$/SF','price_psf','Asking Price Per SF')),
      rent_psf: cn(g('rent_psf','Rent','Asking Rent','Rent PSF','rent_per_sf','Asking Rent\n(Cap Rate)')),
      cap_rate: cn(g('cap_rate','Cap Rate','Cap','cap')),
      clear_height: cn(g('clear_height','Clear Height','Clear Ht','Clr Ht')),
      year_built: cn(g('year_built','Built','Year Built','Built/\nRenovated','Yr Built')),
      docks: cn(g('docks','Docks','Dock Doors')),
      buyer: g('buyer','Buyer','Purchaser'),
      seller: g('seller','Seller','Owner','Recorded Owner','True Owner'),
      source: g('source','Source') || 'Upload',
      notes: g('notes','Notes','Comments'),
      comp_date: g('comp_date','Date','Sale Date','Comp Date') || new Date().toISOString().slice(0, 10),
    }
  }

  // PDF extraction via Anthropic API
  const extractFromPDF = async (file) => {
    setExtracting(true)
    setUploadStatus('Extracting comps from PDF with AI...')
    try {
      const buf = await file.arrayBuffer()
      const base64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''))

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: `Extract every property/comp from this document into a JSON array. Each object should have these fields (use null if not found):
address, city, state, comp_type (one of: sale, lease, land), building_sf (number), lot_acres (number), year_built (number), clear_height (number in feet, just the number), docks (number), price (number, the asking/sale price), price_per_sf (number), rent_psf (number, annual $/SF), cap_rate (number, percentage like 7.5), buyer (string), seller (string, the owner name), notes (string, any key details like zoning, property type, availability), comp_date (YYYY-MM-DD or null).

For lease comps, put the asking rent in rent_psf and the asking/sale price in price.
For clear height like 16' or 24'8", convert to just feet as a number (16, 24.67).
Return ONLY the JSON array, no other text.` }
            ]
          }]
        })
      })

      const data = await resp.json()
      const text = (data.content || []).map(c => c.text || '').join('')
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) { setUploadStatus('Could not parse AI response'); setExtracting(false); return }

      const extracted = JSON.parse(jsonMatch[0])
      const inserts = extracted.map(c => ({
        ...c,
        market: (c.city && c.state) ? `${c.city}, ${c.state}` : 'Other',
        source: `PDF: ${file.name}`,
        comp_date: c.comp_date || new Date().toISOString().slice(0, 10),
      })).filter(c => c.address)

      if (inserts.length === 0) { setUploadStatus('No comps found in PDF'); setExtracting(false); return }

      const { error } = await supabase.from('market_comps').insert(inserts)
      if (error) setUploadStatus(`Error: ${error.message}`)
      else { setUploadStatus(`Extracted ${inserts.length} comps from PDF`); fetchComps() }
    } catch (e) {
      console.error('PDF extraction error:', e)
      setUploadStatus(`PDF extraction failed: ${e.message}`)
    }
    setExtracting(false)
    setTimeout(() => setUploadStatus(''), 5000)
  }

  // Stats
  const saleComps = filtered.filter(c => c.comp_type === 'sale')
  const leaseComps = filtered.filter(c => c.comp_type === 'lease')
  const landComps = filtered.filter(c => c.comp_type === 'land')

  const thStyle = (k) => ({
    padding: '8px 6px', textAlign: 'left', fontSize: 10, fontWeight: 700, fontFamily: hf,
    color: B.gray, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
    borderBottom: `2px solid ${B.gray20}`, whiteSpace: 'nowrap', userSelect: 'none',
    background: sortKey === k ? B.blue05 : 'transparent',
    position: 'sticky', top: 0, zIndex: 1,
  })

  const tdStyle = { padding: '6px 6px', fontSize: 12, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }

  const inputStyle = { width: '100%', padding: '7px 8px', border: `1px solid ${B.gray20}`, borderRadius: 3, fontSize: 12, fontFamily: bf, outline: 'none', boxSizing: 'border-box' }

  const editInput = (id, field, val) => {
    if (editing && editing.id === id && editing.field === field) {
      return <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
        onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
        style={{ ...inputStyle, border: `1px solid ${B.blue}`, background: B.blue05, padding: '2px 4px', fontSize: 11 }}
        onClick={e => e.stopPropagation()} />
    }
    return <span onDoubleClick={(e) => { e.stopPropagation(); startEdit(id, field, val) }} style={{ cursor: 'text' }}>{val || '—'}</span>
  }

  const typeColor = (t) => t === 'lease' ? B.blue : t === 'land' ? B.amber : B.green
  const typeBg = (t) => t === 'lease' ? B.blue10 : t === 'land' ? B.amberLight : B.greenLight

  return (
    <div style={{ fontFamily: bf }}>
      {/* Header bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input placeholder="Search address, buyer, seller..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 180px', maxWidth: 280 }} />
        <select value={market} onChange={e => setMarket(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}>
          <option value="all">All Markets</option>
          {[...new Set(comps.map(c => c.market).filter(Boolean))].sort().map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ id: 'all', label: 'All' }, ...COMP_TYPES].map(t => (
            <button key={t.id} onClick={() => setTypeFilter(t.id)}
              style={{ padding: '5px 10px', borderRadius: 3, border: `1px solid ${typeFilter === t.id ? (t.color || B.blue) : B.gray20}`,
                background: typeFilter === t.id ? (t.id === 'all' ? B.blue05 : typeBg(t.id)) : 'white',
                color: typeFilter === t.id ? (t.color || B.blue) : B.gray, fontSize: 11, fontWeight: 600, fontFamily: bf, cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowUpload(true)} style={{ padding: '7px 14px', background: 'white', border: `1px solid ${B.gray20}`, borderRadius: 4, fontSize: 12, fontWeight: 600, fontFamily: bf, cursor: 'pointer', color: B.black }}>
            ⬆ Upload
          </button>
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '7px 14px', background: B.blue, color: 'white', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, fontFamily: bf, cursor: 'pointer' }}>
            + Add Comp
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ padding: '8px 14px', background: B.white, border: `1px solid ${B.gray20}`, borderRadius: 4, fontSize: 12, fontFamily: bf }}>
          <span style={{ color: B.gray, fontWeight: 500 }}>Total:</span> <b>{filtered.length}</b>
        </div>
        {saleComps.length > 0 && <div style={{ padding: '8px 14px', background: B.greenLight, border: `1px solid ${B.green}20`, borderRadius: 4, fontSize: 12, fontFamily: bf }}>
          <span style={{ color: B.green }}>Sales:</span> <b>{saleComps.length}</b>
          {saleComps.some(c => c.price_per_sf) && <span style={{ marginLeft: 8, color: B.gray }}>Avg $/SF: ${Math.round(saleComps.filter(c => c.price_per_sf).reduce((s, c) => s + c.price_per_sf, 0) / saleComps.filter(c => c.price_per_sf).length)}</span>}
        </div>}
        {leaseComps.length > 0 && <div style={{ padding: '8px 14px', background: B.blue10, border: `1px solid ${B.blue}20`, borderRadius: 4, fontSize: 12, fontFamily: bf }}>
          <span style={{ color: B.blue }}>Leases:</span> <b>{leaseComps.length}</b>
          {leaseComps.some(c => c.rent_psf) && <span style={{ marginLeft: 8, color: B.gray }}>Avg Rent: ${(leaseComps.filter(c => c.rent_psf).reduce((s, c) => s + c.rent_psf, 0) / leaseComps.filter(c => c.rent_psf).length).toFixed(2)}/SF</span>}
        </div>}
        {landComps.length > 0 && <div style={{ padding: '8px 14px', background: B.amberLight, border: `1px solid ${B.amber}20`, borderRadius: 4, fontSize: 12, fontFamily: bf }}>
          <span style={{ color: B.amber }}>Land:</span> <b>{landComps.length}</b>
        </div>}
      </div>

      {/* Upload status */}
      {uploadStatus && (
        <div style={{ padding: '10px 14px', background: extracting ? B.amberLight : B.greenLight, border: `1px solid ${extracting ? B.amber : B.green}40`, borderRadius: 4, marginBottom: 12, fontSize: 12, fontFamily: bf, display: 'flex', alignItems: 'center', gap: 8 }}>
          {extracting && <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>}
          {uploadStatus}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowUpload(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 8, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontFamily: hf, fontSize: 18, marginBottom: 16 }}>Upload Comps</h3>
            <div onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${B.gray20}`, borderRadius: 6, padding: 32, textAlign: 'center', cursor: 'pointer', marginBottom: 16 }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.blue }}
              onDragLeave={e => { e.currentTarget.style.borderColor = B.gray20 }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.gray20; handleFileUpload(e.dataTransfer.files[0]); setShowUpload(false) }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: bf }}>Drop file here or click to browse</div>
              <div style={{ fontSize: 12, color: B.gray, marginTop: 4 }}>Supports .csv, .xlsx, and .pdf</div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" style={{ display: 'none' }}
                onChange={e => { handleFileUpload(e.target.files[0]); setShowUpload(false) }} />
            </div>
            <div style={{ fontSize: 11, color: B.gray, lineHeight: 1.6, padding: 12, background: B.gray10, borderRadius: 4 }}>
              <b>CSV/XLSX:</b> Auto-maps columns like Address, Building SF, Price, Rent PSF, Cap Rate, Year Built, etc.<br />
              <b>PDF:</b> Uses AI to extract property details into structured comp rows. Works with CoStar reports, broker OMs, and similar documents.
            </div>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button onClick={() => setShowUpload(false)} style={{ padding: '7px 16px', background: B.gray10, border: 'none', borderRadius: 4, fontSize: 12, fontFamily: bf, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add comp form */}
      {showAdd && (
        <div style={{ background: B.blue05, border: `1px solid ${B.blue20}`, borderRadius: 6, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {[
              { k: 'comp_type', l: 'Type', type: 'select', opts: ['sale','lease','land'] },
              { k: 'address', l: 'Address *' },
              { k: 'city', l: 'City' },
              { k: 'state', l: 'State' },
              { k: 'market', l: 'Market', type: 'select', opts: MARKETS },
              { k: 'building_sf', l: 'Building SF' },
              { k: 'lot_acres', l: 'Acres' },
              { k: 'year_built', l: 'Year Built' },
              { k: 'clear_height', l: 'Clear Height' },
              { k: 'docks', l: 'Docks' },
              { k: 'price', l: 'Price' },
              { k: 'price_per_sf', l: '$/SF' },
              { k: 'rent_psf', l: 'Rent $/SF/YR' },
              { k: 'cap_rate', l: 'Cap Rate %' },
              { k: 'buyer', l: 'Buyer' },
              { k: 'seller', l: 'Seller/Owner' },
              { k: 'comp_date', l: 'Date', type: 'date' },
              { k: 'source', l: 'Source' },
              { k: 'notes', l: 'Notes' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, fontWeight: 600, color: B.gray, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{f.l}</label>
                {f.type === 'select' ? (
                  <select value={newComp[f.k]} onChange={e => setNewComp({ ...newComp, [f.k]: e.target.value })} style={inputStyle}>
                    {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={f.type || 'text'} value={newComp[f.k]} onChange={e => setNewComp({ ...newComp, [f.k]: e.target.value })} style={inputStyle} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addComp} disabled={!newComp.address} style={{ padding: '7px 16px', background: B.blue, color: 'white', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, fontFamily: bf, cursor: 'pointer', opacity: newComp.address ? 1 : 0.5 }}>Save Comp</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '7px 16px', background: B.gray10, border: 'none', borderRadius: 4, fontSize: 12, fontFamily: bf, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', border: `1px solid ${B.gray20}`, borderRadius: 6, background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle(''), width: 30, cursor: 'default' }}>#</th>
              {COMP_FIELDS.map(f => (
                <th key={f.key} onClick={() => toggleSort(f.key)} style={{ ...thStyle(f.key), minWidth: f.w }}>
                  {f.label} {sortKey === f.key ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
              ))}
              <th style={{ ...thStyle(''), width: 40, cursor: 'default' }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={COMP_FIELDS.length + 2} style={{ ...tdStyle, textAlign: 'center', padding: 40, color: B.gray }}>
                {loading ? 'Loading...' : 'No comps found. Add your first comp or upload a file.'}
              </td></tr>
            )}
            {sorted.map((c, i) => (
              <tr key={c.id} style={{ cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = B.gray10}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ ...tdStyle, color: B.gray40, fontSize: 10 }}>{i + 1}</td>
                <td style={tdStyle}>{editInput(c.id, 'address', c.address)}</td>
                <td style={tdStyle}>{editInput(c.id, 'city', c.city)}</td>
                <td style={tdStyle}>{editInput(c.id, 'state', c.state)}</td>
                <td style={tdStyle}>
                  <Badge bg={typeBg(c.comp_type)} color={typeColor(c.comp_type)} style={{ fontSize: 9 }}>
                    {(c.comp_type || 'sale').toUpperCase()}
                  </Badge>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: hf }}>{editInput(c.id, 'building_sf', c.building_sf ? fmtN(c.building_sf) : '')}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: hf }}>{editInput(c.id, 'lot_acres', c.lot_acres ? Number(c.lot_acres).toFixed(1) : '')}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{editInput(c.id, 'year_built', c.year_built)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{editInput(c.id, 'clear_height', c.clear_height ? `${c.clear_height}'` : '')}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{editInput(c.id, 'docks', c.docks)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontFamily: hf }}>{editInput(c.id, 'price', c.price ? fmt(c.price) : '')}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: hf }}>{editInput(c.id, 'price_per_sf', c.price_per_sf ? `$${fmtN(c.price_per_sf)}` : '')}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: hf, color: B.blue }}>{editInput(c.id, 'rent_psf', c.rent_psf ? `$${Number(c.rent_psf).toFixed(2)}` : '')}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: hf }}>{editInput(c.id, 'cap_rate', c.cap_rate ? `${c.cap_rate}%` : '')}</td>
                <td style={tdStyle}>{editInput(c.id, 'buyer', c.buyer)}</td>
                <td style={tdStyle}>{editInput(c.id, 'seller', c.seller)}</td>
                <td style={{ ...tdStyle, fontSize: 11 }}>{fmtD(c.comp_date)}</td>
                <td style={{ ...tdStyle, fontSize: 10, color: B.gray }}>{c.source || '—'}</td>
                <td style={{ ...tdStyle, fontSize: 10, color: B.gray, maxWidth: 150 }}>{c.notes || '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <button onClick={(e) => { e.stopPropagation(); deleteComp(c.id) }}
                    style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 3 }}
                    onMouseEnter={e => { e.currentTarget.style.color = B.red; e.currentTarget.style.background = B.redLight }}
                    onMouseLeave={e => { e.currentTarget.style.color = B.gray40; e.currentTarget.style.background = 'none' }}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
