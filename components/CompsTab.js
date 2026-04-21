import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, fmt, MARKETS, Badge } from '../lib/brand'

let L = null
if (typeof window !== 'undefined') { L = require('leaflet') }

const COMP_TYPES = [
  { id: 'sale', label: 'Sale', color: B.green },
  { id: 'lease', label: 'Lease', color: B.blue },
  { id: 'land', label: 'Land', color: B.amber },
]

const COMP_FIELDS = [
  { key: 'address', label: 'Address', w: 200 },
  { key: 'city', label: 'City', w: 110 },
  { key: 'state', label: 'ST', w: 40 },
  { key: 'comp_type', label: 'Type', w: 60 },
  { key: 'building_sf', label: 'Bldg SF', w: 80 },
  { key: 'lot_acres', label: 'Acres', w: 60 },
  { key: 'year_built', label: 'Built', w: 55 },
  { key: 'clear_height', label: 'Clr Ht', w: 50 },
  { key: 'docks', label: 'Docks', w: 45 },
  { key: 'price', label: 'Price', w: 90 },
  { key: 'price_per_sf', label: '$/SF', w: 65 },
  { key: 'rent_psf', label: 'Rent/SF', w: 65 },
  { key: 'cap_rate', label: 'Cap', w: 50 },
  { key: 'buyer', label: 'Buyer', w: 110 },
  { key: 'seller', label: 'Seller/Owner', w: 110 },
  { key: 'comp_date', label: 'Date', w: 90 },
  { key: 'source', label: 'Source', w: 80 },
  { key: 'notes', label: 'Notes', w: 150 },
]

const TYPE_COLORS = { sale: B.green, lease: B.blue, land: B.amber }
const TYPE_BG = { sale: B.greenLight, lease: B.blue10, land: B.amberLight }

const cn = v => { if (!v && v !== 0) return null; const n = parseFloat(String(v).replace(/[$,\s%]/g, '')); return isNaN(n) ? null : n }
const fmtN = (v, d = 0) => v ? Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '\u2014'
const fmtD = v => v ? new Date(v + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '\u2014'

async function geocodeAddress(address, city, state) {
  const q = [address, city, state].filter(Boolean).join(', ')
  if (!q || q.length < 5) return null
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&limit=1&countrycodes=us', { headers: { 'User-Agent': 'DuffieldDashboard/1.0' } })
    const d = await r.json()
    if (d && d.length > 0) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) }
  } catch (e) { console.warn('Geocode failed:', e) }
  return null
}

function makeIcon(type) {
  if (!L) return null
  const color = TYPE_COLORS[type] || B.gray
  return L.divIcon({
    className: 'comp-marker',
    html: '<div style="width:14px;height:14px;background:' + color + ';border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
    iconSize: [14, 14], iconAnchor: [7, 7]
  })
}

function popupHtml(c) {
  const r = (label, val) => val ? '<div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:#888;">' + label + '</span><b>' + val + '</b></div>' : ''
  let h = '<div style="font-family:sans-serif;font-size:12px;min-width:200px;">'
  h += '<div style="font-weight:700;font-size:14px;margin-bottom:2px;">' + (c.address || 'No address') + '</div>'
  h += '<div style="color:#888;font-size:11px;margin-bottom:8px;">' + [c.city, c.state].filter(Boolean).join(', ') + '</div>'
  if (c.comp_type === 'lease') {
    h += r('Rent/SF', c.rent_psf ? '$' + Number(c.rent_psf).toFixed(2) : '')
    h += r('Bldg SF', c.building_sf ? Number(c.building_sf).toLocaleString() : '')
    h += r('Clear Ht', c.clear_height ? c.clear_height + "'" : '')
    h += r('Docks', c.docks)
  } else if (c.comp_type === 'land') {
    h += r('Acres', c.lot_acres ? Number(c.lot_acres).toFixed(1) : '')
    h += r('Price', c.price ? '$' + Number(c.price).toLocaleString() : '')
  } else {
    h += r('Price', c.price ? '$' + Number(c.price).toLocaleString() : '')
    h += r('$/SF', c.price_per_sf ? '$' + Number(c.price_per_sf).toLocaleString() : '')
    h += r('Cap Rate', c.cap_rate ? c.cap_rate + '%' : '')
    h += r('Bldg SF', c.building_sf ? Number(c.building_sf).toLocaleString() : '')
  }
  h += r('Built', c.year_built)
  h += r('Date', fmtD(c.comp_date))
  if (c.seller) h += r('Owner', c.seller)
  h += '</div>'
  return h
}

function CompsMap({ comps, filtered, onGeocodeDone }) {
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const markersRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')

  useEffect(() => {
    if (!L || !mapRef.current || mapInst.current) return
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    })
    const m = L.map(mapRef.current, { center: [35.5, -80], zoom: 6, zoomControl: true })
    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '\u00a9 CARTO', subdomains: 'abcd', maxZoom: 19 })
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri', maxZoom: 19 })
    const labels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19, pane: 'shadowPane' })
    const hybrid = L.layerGroup([satellite, labels])
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '\u00a9 OSM', maxZoom: 19 })
    hybrid.addTo(m)
    L.control.layers({ 'Satellite': hybrid, 'Dark': dark, 'Street': osm }, null, { position: 'topright' }).addTo(m)
    markersRef.current = L.layerGroup().addTo(m)
    mapInst.current = m
    setReady(true)
    return () => { m.remove(); mapInst.current = null }
  }, [])

  useEffect(() => {
    if (!ready || !markersRef.current || !L) return
    markersRef.current.clearLayers()
    const bounds = []
    filtered.forEach(c => {
      const lat = parseFloat(c.latitude), lng = parseFloat(c.longitude)
      if (!lat || !lng || (Math.abs(lat) < 0.1 && Math.abs(lng) < 0.1)) return
      const marker = L.marker([lat, lng], { icon: makeIcon(c.comp_type) })
      marker.bindPopup(popupHtml(c), { maxWidth: 280 })
      markersRef.current.addLayer(marker)
      bounds.push([lat, lng])
    })
    if (bounds.length > 0 && mapInst.current) mapInst.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }, [filtered, ready])

  const geocodeAll = async () => {
    const missing = comps.filter(c => (!c.latitude || !c.longitude) && c.address && c.city)
    if (missing.length === 0) { setGeoMsg('All comps have coordinates'); return }
    setGeocoding(true); setGeoMsg('Geocoding ' + missing.length + ' comps...')
    let done = 0, failed = 0
    for (const c of missing) {
      const result = await geocodeAddress(c.address, c.city, c.state)
      if (result) {
        await supabase.from('market_comps').update({ latitude: result.lat, longitude: result.lng }).eq('id', c.id)
        done++
      } else { failed++ }
      setGeoMsg('Geocoded ' + done + '/' + missing.length + (failed ? ' (' + failed + ' failed)' : ''))
      await new Promise(r => setTimeout(r, 1100))
    }
    setGeocoding(false)
    setGeoMsg('Done: ' + done + ' geocoded' + (failed ? ', ' + failed + ' failed' : ''))
    if (onGeocodeDone) onGeocodeDone()
    setTimeout(() => setGeoMsg(''), 4000)
  }

  const mapped = filtered.filter(c => c.latitude && c.longitude && (Math.abs(c.latitude) > 0.1 || Math.abs(c.longitude) > 0.1)).length
  const unmapped = filtered.length - mapped

  return (
    <div style={{ position: 'relative' }}>
      <div ref={mapRef} style={{ height: 580, borderRadius: 6, border: '1px solid ' + B.gray20 }} />
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 1000, display: 'flex', gap: 8, alignItems: 'center' }}>
        {unmapped > 0 && (
          <button onClick={geocodeAll} disabled={geocoding}
            style={{ padding: '6px 12px', background: 'white', border: '1px solid ' + B.gray20, borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: bf, cursor: geocoding ? 'wait' : 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {geocoding ? 'Geocoding...' : '\uD83C\uDF10 Geocode ' + unmapped + ' comps'}
          </button>
        )}
        {geoMsg && <span style={{ padding: '4px 10px', background: 'white', borderRadius: 4, fontSize: 11, fontFamily: bf, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>{geoMsg}</span>}
      </div>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', gap: 8 }}>
        <span style={{ padding: '4px 10px', background: 'white', borderRadius: 4, fontSize: 11, fontFamily: bf, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          {mapped} mapped{unmapped > 0 ? ' \u00b7 ' + unmapped + ' unmapped' : ''}
        </span>
        <div style={{ padding: '4px 10px', background: 'white', borderRadius: 4, fontSize: 10, fontFamily: bf, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: B.green, display: 'inline-block' }} />Sale</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: B.blue, display: 'inline-block' }} />Lease</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: B.amber, display: 'inline-block' }} />Land</span>
        </div>
      </div>
    </div>
  )
}

export default function CompsTab() {
  const [comps, setComps] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('table')
  const [market, setMarket] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('comp_date')
  const [sortDir, setSortDir] = useState(-1)
  const [showAdd, setShowAdd] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
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
    const { data } = await supabase.from('market_comps').select('*').order('comp_date', { ascending: false }).limit(1000)
    if (data) setComps(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchComps() }, [fetchComps])

  let filtered = comps
  if (market !== 'all') filtered = filtered.filter(c => c.market === market)
  if (typeFilter !== 'all') filtered = filtered.filter(c => c.comp_type === typeFilter)
  if (search.trim().length >= 2) {
    const q = search.toLowerCase()
    filtered = filtered.filter(c =>
      (c.address || '').toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q) ||
      (c.buyer || '').toLowerCase().includes(q) || (c.seller || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    )
  }
  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'string') return sortDir * (av || '').localeCompare(bv || '')
    return sortDir * ((Number(av) || 0) - (Number(bv) || 0))
  })

  const toggleSort = k => { if (sortKey === k) setSortDir(d => d * -1); else { setSortKey(k); setSortDir(1) } }

  const addComp = async () => {
    const cleaned = { ...newComp }
    ;['building_sf','lot_acres','price','price_per_sf','rent_psf','cap_rate','clear_height','year_built','docks'].forEach(k => { cleaned[k] = cn(cleaned[k]) })
    if (cleaned.price && cleaned.building_sf && !cleaned.price_per_sf) cleaned.price_per_sf = Math.round(cleaned.price / cleaned.building_sf)
    if (!cleaned.comp_date) cleaned.comp_date = null
    await supabase.from('market_comps').insert(cleaned)
    setNewComp({ ...newComp, address: '', city: '', building_sf: '', lot_acres: '', price: '', price_per_sf: '', rent_psf: '', cap_rate: '', clear_height: '', year_built: '', docks: '', buyer: '', seller: '', source: '', notes: '' })
    setShowAdd(false); fetchComps()
  }

  const deleteComp = async (id) => { if (!confirm('Delete this comp?')) return; await supabase.from('market_comps').delete().eq('id', id); fetchComps() }

  const startEdit = (id, field, val) => { setEditing({ id, field }); setEditVal(val || '') }
  const saveEdit = async () => {
    if (!editing) return
    const val = ['building_sf','lot_acres','price','price_per_sf','rent_psf','cap_rate','clear_height','year_built','docks'].includes(editing.field) ? cn(editVal) : editVal
    await supabase.from('market_comps').update({ [editing.field]: val }).eq('id', editing.id)
    setEditing(null); setEditVal(''); fetchComps()
  }
  const cancelEdit = () => { setEditing(null); setEditVal('') }

  // ─── SMART COLUMN MAPPER ───
  // Handles CoStar multi-line headers, CBRE abbreviations, and common variations
  const normalizeCol = (col) => {
    if (!col) return null
    const c = String(col).replace(/[\n\r]+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_')
    if (!c) return null
    const MAP = {
      address: 'address', property_address: 'address', street_address: 'address', location: 'address',
      property_name_address: 'address', property_name: 'address', site: 'address',
      city: 'city', town: 'city',
      state: 'state', st: 'state',
      type: 'comp_type', comp_type: 'comp_type', property_type: 'notes',
      building_sf: 'building_sf', size: 'building_sf', sf: 'building_sf', sqft: 'building_sf',
      size_leased: 'building_sf', rba: 'building_sf', bldg_sf: 'building_sf', total_sf: 'building_sf',
      gla: 'building_sf', nra: 'building_sf', square_feet: 'building_sf', square_footage: 'building_sf',
      lot_acres: 'lot_acres', acres: 'lot_acres', acreage: 'lot_acres', land_area: 'lot_acres',
      land_size: 'lot_acres', parcel_size: 'lot_acres', lot_size: 'lot_acres',
      year_built: 'year_built', built: 'year_built', built_renovated: 'year_built', yr_built: 'year_built', vintage: 'year_built',
      clear_height: 'clear_height', clear_ht: 'clear_height', ceiling_height: 'clear_height',
      docks: 'docks', dock_doors: 'docks', loading_docks: 'docks',
      price: 'price', asking_price: 'price', sale_price: 'price', purchase_price: 'price',
      asking_price_cap_rate: 'price', total_price: 'price',
      price_per_sf: 'price_per_sf', price_psf: 'price_per_sf', psf: 'price_per_sf',
      asking_price_per_sf: 'price_per_sf', per_sf: 'price_per_sf',
      rent_psf: 'rent_psf', rent: 'rent_psf', asking_rent: 'rent_psf', rent_per_sf: 'rent_psf',
      rental_rate: 'rent_psf', base_rent: 'rent_psf', net_rent: 'rent_psf',
      asking_rent_cap_rate: 'rent_psf', rental_rate_per_sf: 'rent_psf',
      cap_rate: 'cap_rate', cap: 'cap_rate',
      buyer: 'buyer', purchaser: 'buyer', grantee: 'buyer',
      seller: 'seller', owner: 'seller', true_owner: 'seller', recorded_owner: 'seller', grantor: 'seller',
      source: 'source', notes: 'notes', comments: 'notes', remarks: 'notes',
      date: 'comp_date', sale_date: 'comp_date', comp_date: 'comp_date', closing_date: 'comp_date',
      transaction_date: 'comp_date',
      latitude: 'latitude', lat: 'latitude',
      longitude: 'longitude', lng: 'longitude', lon: 'longitude',
      sf_available: '_sf_available', available: '_available', vacancy: '_vacancy',
      tenant: '_tenant', tenant_name: '_tenant', lessee: '_tenant',
      submarket: 'market', market: 'market',
      zoning: '_zoning', land_use: '_zoning',
    }
    if (MAP[c]) return MAP[c]
    // Fuzzy match patterns
    if (c.includes('address') || c.includes('location') || c.includes('property_name')) return 'address'
    if (c.includes('building') && c.includes('sf')) return 'building_sf'
    if (c.includes('clear') && c.includes('h')) return 'clear_height'
    if (c.includes('year') && c.includes('built')) return 'year_built'
    if (c.includes('cap') && c.includes('rate')) return 'cap_rate'
    if (c.includes('rent') && (c.includes('sf') || c.includes('psf'))) return 'rent_psf'
    if (c.includes('price') && c.includes('sf')) return 'price_per_sf'
    if (c.includes('sale') && c.includes('price')) return 'price'
    if (c.includes('asking') && c.includes('price')) return 'price'
    if (c.includes('asking') && c.includes('rent')) return 'rent_psf'
    if (c.includes('dock')) return 'docks'
    if (c.includes('acre')) return 'lot_acres'
    return null
  }

  // Clean numeric value: strip $, commas, %, SF, etc. Handle "Withheld", "Not For Sale", ranges
  const cleanNum = (v) => {
    if (!v && v !== 0) return null
    const s = String(v).trim()
    if (!s || s === '-' || s === '\u2014' || s.toLowerCase() === 'withheld' || s.toLowerCase().includes('not for sale') || s.toLowerCase().includes('not disclosed') || s.toLowerCase() === 'negotiable') return null
    // Handle ranges like "24,000 - 200,000" — take the first number
    const rangeParts = s.split(/\s*[-\/]\s*/)
    const raw = rangeParts[0].replace(/[$,\s%sfSF]/g, '').replace(/['’′]/g, '')
    const n = parseFloat(raw)
    return isNaN(n) ? null : n
  }

  // Clean clear height: "16'" -> 16, "24'8\"" -> 24.67, "24 ft" -> 24
  const cleanHeight = (v) => {
    if (!v) return null
    const s = String(v).trim()
    const m = s.match(/(\d+)['’′]\s*(\d+)?/)
    if (m) return m[2] ? parseFloat(m[1]) + parseFloat(m[2]) / 12 : parseFloat(m[1])
    return cleanNum(s)
  }

  // ─── FILE UPLOAD HANDLER ───
  const handleFileUpload = async (file) => {
    if (!file) return; const name = file.name.toLowerCase()
    if (name.endsWith('.pdf')) { await extractFromPDF(file); return }
    setUploadStatus('Parsing ' + file.name + '...')
    try {
      if (name.endsWith('.csv')) {
        const text = await file.text(); const Papa = (await import('papaparse')).default
        Papa.parse(text, { header: true, skipEmptyLines: true, complete: async (results) => {
          setUploadStatus('Parsed ' + results.data.length + ' rows, mapping columns...')
          await ingestRows(results.data, file.name, '')
        }})
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const XLSX = await import('xlsx'); const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' })
        const allRows = []; let totalParsed = 0
        wb.SheetNames.forEach(sn => {
          const sheet = wb.Sheets[sn]
          const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
          // Find header row: first row with 3+ non-empty cells
          let headerIdx = -1
          for (let i = 0; i < Math.min(aoa.length, 10); i++) {
            const nonEmpty = (aoa[i] || []).filter(c => c !== null && c !== undefined && String(c).trim() !== '').length
            if (nonEmpty >= 3) { headerIdx = i; break }
          }
          if (headerIdx === -1) return
          const headers = aoa[headerIdx].map(h => String(h || '').trim())
          // Sheet type from name
          const sl = sn.toLowerCase()
          const sheetType = sl.includes('lease') ? 'lease' : sl.includes('land') ? 'land' : sl.includes('sale') ? 'sale' : ''
          // Data rows: skip headers, stop at totals/empty
          for (let i = headerIdx + 1; i < aoa.length; i++) {
            const row = aoa[i] || []
            const nonEmpty = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').length
            if (nonEmpty < 2) continue
            const rowStr = row.join(' ').toLowerCase()
            if (rowStr.includes('total') || rowStr.includes('weighted average') || rowStr.includes('summary')) continue
            const obj = {}
            headers.forEach((h, idx) => { if (h && idx < row.length) obj[h] = row[idx] })
            if (sheetType) obj._sheetType = sheetType
            allRows.push(obj)
          }
          totalParsed += allRows.length
        })
        setUploadStatus('Parsed ' + allRows.length + ' rows from ' + wb.SheetNames.length + ' sheets, mapping...')
        await ingestRows(allRows, file.name, '')
      } else { setUploadStatus('Unsupported file type. Use .csv, .xlsx, or .pdf') }
    } catch (e) {
      console.error('Upload error:', e)
      setUploadStatus('Upload failed: ' + e.message)
      setTimeout(() => setUploadStatus(''), 5000)
    }
  }

  // ─── MAP ROWS TO COMPS AND INSERT ───
  const ingestRows = async (rows, fileName, fileType) => {
    // Build column mapping from first row's keys
    const sampleKeys = rows.length > 0 ? Object.keys(rows[0]) : []
    const colMap = {}
    sampleKeys.forEach(k => {
      if (k.startsWith('_')) return
      const mapped = normalizeCol(k)
      if (mapped && !colMap[mapped]) colMap[mapped] = k
    })

    const inserts = []
    rows.forEach(r => {
      const get = (field) => {
        const key = colMap[field]
        if (!key) return ''
        const val = r[key]
        return val !== null && val !== undefined ? String(val).trim() : ''
      }

      // Also try direct key access for unmapped columns
      const getAny = (field, ...alts) => {
        const v = get(field)
        if (v) return v
        for (const alt of alts) {
          for (const k of Object.keys(r)) {
            if (k.toLowerCase().replace(/[^a-z]/g, '').includes(alt.toLowerCase().replace(/[^a-z]/g, ''))) {
              const val = r[k]
              if (val !== null && val !== undefined && String(val).trim()) return String(val).trim()
            }
          }
        }
        return ''
      }

      const address = get('address') || getAny('address', 'propertyname', 'location', 'site')
      if (!address || address.length < 3) return

      const city = get('city') || getAny('city', 'town')
      const state = get('state') || getAny('state', 'st') || 'NC'

      // Determine comp type
      let ct = (r._sheetType || get('comp_type') || '').toLowerCase()
      const rentVal = get('rent_psf') || getAny('rent_psf', 'askingrent', 'rentalsf')
      const priceVal = get('price') || getAny('price', 'saleprice', 'askingprice')
      const acresVal = get('lot_acres') || getAny('lot_acres', 'acres')
      if (!ct || (ct !== 'lease' && ct !== 'sale' && ct !== 'land')) {
        if (rentVal && cleanNum(rentVal)) ct = 'lease'
        else if (acresVal && cleanNum(acresVal) && !get('building_sf')) ct = 'land'
        else ct = 'sale'
      }

      // Notes: combine property type, zoning, tenant, available SF
      const noteParts = []
      const propType = getAny('notes', 'propertytype', 'type')
      if (propType && !['sale','lease','land'].includes(propType.toLowerCase())) noteParts.push(propType)
      const zoning = getAny('_zoning', 'zoning')
      if (zoning) noteParts.push('Zoning: ' + zoning)
      const tenant = getAny('_tenant', 'tenant')
      if (tenant) noteParts.push('Tenant: ' + tenant)
      const avail = getAny('_sf_available', 'sfavailable', 'available')
      if (avail) noteParts.push('Avail: ' + avail)
      const existingNotes = get('notes')
      if (existingNotes) noteParts.push(existingNotes)

      const comp = {
        address: address.split('\n')[0].trim(),
        city, state,
        comp_type: ct.includes('lease') ? 'lease' : ct.includes('land') ? 'land' : 'sale',
        market: get('market') || (city && state ? city + ', ' + state : 'Other'),
        building_sf: cleanNum(get('building_sf') || getAny('building_sf', 'size', 'buildingsf', 'sqft')),
        lot_acres: cleanNum(get('lot_acres') || acresVal),
        year_built: cleanNum(get('year_built') || getAny('year_built', 'yearbuilt', 'built')),
        clear_height: cleanHeight(get('clear_height') || getAny('clear_height', 'clearheight', 'ceilingheight')),
        docks: cleanNum(get('docks') || getAny('docks', 'dockdoors')),
        price: cleanNum(priceVal),
        price_per_sf: cleanNum(get('price_per_sf') || getAny('price_per_sf', 'pricepsf', 'persf')),
        rent_psf: cleanNum(rentVal),
        cap_rate: cleanNum(get('cap_rate') || getAny('cap_rate', 'caprate')),
        buyer: get('buyer') || getAny('buyer', 'purchaser'),
        seller: get('seller') || getAny('seller', 'owner', 'trueowner', 'recordedowner'),
        source: get('source') || 'Upload: ' + fileName,
        notes: noteParts.join(' | ') || null,
        comp_date: get('comp_date') || getAny('comp_date', 'saledate', 'date') || new Date().toISOString().slice(0, 10),
        latitude: cleanNum(get('latitude')),
        longitude: cleanNum(get('longitude')),
      }

      // Auto-calc price_per_sf
      if (!comp.price_per_sf && comp.price && comp.building_sf) comp.price_per_sf = Math.round(comp.price / comp.building_sf)

      inserts.push(comp)
    })

    if (inserts.length === 0) { setUploadStatus('No valid comps found in file. Check column headers.'); setTimeout(() => setUploadStatus(''), 5000); return }

    setUploadStatus('Inserting ' + inserts.length + ' comps into database...')

    // Batch insert in chunks of 100
    let inserted = 0; let errors = 0
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100)
      const { error } = await supabase.from('market_comps').insert(chunk)
      if (error) { console.error('Insert error:', error); errors++ }
      else { inserted += chunk.length }
      setUploadStatus('Inserted ' + inserted + '/' + inserts.length + '...')
    }

    if (errors > 0) setUploadStatus('Imported ' + inserted + ' comps (' + errors + ' batch errors) from ' + fileName)
    else setUploadStatus('Imported ' + inserted + ' comps from ' + fileName)
    fetchComps()
    setTimeout(() => setUploadStatus(''), 5000)
  }

  // ─── PDF EXTRACTION VIA ANTHROPIC API ───
  const extractFromPDF = async (file) => {
    setExtracting(true); setUploadStatus('Sending PDF to AI for extraction...')
    try {
      const buf = await file.arrayBuffer()
      // Convert to base64 in chunks to avoid call stack overflow on large PDFs
      const bytes = new Uint8Array(buf)
      let binary = ''
      const chunkSize = 8192
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
      }
      const base64 = btoa(binary)

      setUploadStatus('AI is reading ' + Math.round(buf.byteLength / 1024) + 'KB PDF...')

      const resp = await fetch('/api/extract-comps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_base64: base64 })
      })

      const data = await resp.json()

      if (!resp.ok) {
        console.error('API error:', resp.status, data)
        setUploadStatus('API error: ' + (data.error || resp.status) + '. Check console.')
        setExtracting(false); return
      }

      const extracted = data.comps
      if (!extracted || extracted.length === 0) {
        setUploadStatus('AI found no properties in the PDF.')
        setExtracting(false); return
      }

      setUploadStatus('AI found ' + extracted.length + ' properties, inserting...')

      // Clean and prepare inserts
      const inserts = extracted.map(c => {
        // Sanitize every field
        const clean = (v) => (v === null || v === undefined || String(v).trim() === '' || String(v).toLowerCase() === 'null') ? null : String(v).trim()
        const cleanN = (v) => { const n = cleanNum(v); return (n !== null && !isNaN(n)) ? n : null }
        const addr = clean(c.address)
        if (!addr) return null
        const city = clean(c.city)
        const state = clean(c.state) || 'NC'
        return {
          address: addr, city, state,
          comp_type: ['sale','lease','land'].includes(c.comp_type) ? c.comp_type : 'lease',
          market: (city && state) ? city + ', ' + state : 'Other',
          building_sf: cleanN(c.building_sf),
          lot_acres: cleanN(c.lot_acres),
          year_built: cleanN(c.year_built),
          clear_height: cleanN(c.clear_height),
          docks: cleanN(c.docks),
          price: cleanN(c.price),
          price_per_sf: cleanN(c.price_per_sf),
          rent_psf: cleanN(c.rent_psf),
          cap_rate: cleanN(c.cap_rate),
          buyer: clean(c.buyer),
          seller: clean(c.seller),
          notes: clean(c.notes),
          source: 'PDF: ' + file.name,
          comp_date: clean(c.comp_date) || new Date().toISOString().slice(0, 10),
          latitude: cleanN(c.latitude),
          longitude: cleanN(c.longitude),
        }
      }).filter(Boolean)

      if (inserts.length === 0) { setUploadStatus('AI found properties but none had valid addresses.'); setExtracting(false); return }

      // Auto-calc price_per_sf where missing
      inserts.forEach(c => { if (!c.price_per_sf && c.price && c.building_sf) c.price_per_sf = Math.round(c.price / c.building_sf) })

      // Batch insert
      let inserted = 0
      for (let i = 0; i < inserts.length; i += 50) {
        const chunk = inserts.slice(i, i + 50)
        const { error } = await supabase.from('market_comps').insert(chunk)
        if (error) { console.error('Insert error:', error.message, chunk[0]); setUploadStatus('DB error: ' + error.message); break }
        inserted += chunk.length
        setUploadStatus('Inserted ' + inserted + '/' + inserts.length + '...')
      }

      setUploadStatus('Extracted ' + inserted + ' comps from PDF')
      fetchComps()
    } catch (e) {
      console.error('PDF extraction error:', e)
      setUploadStatus('PDF extraction failed: ' + e.message)
    }
    setExtracting(false); setTimeout(() => setUploadStatus(''), 6000)
  }

  const saleComps = filtered.filter(c => c.comp_type === 'sale')
  const leaseComps = filtered.filter(c => c.comp_type === 'lease')
  const landComps = filtered.filter(c => c.comp_type === 'land')

  const thStyle = (k) => ({
    padding: '8px 6px', textAlign: 'left', fontSize: 10, fontWeight: 700, fontFamily: hf,
    color: B.gray, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
    borderBottom: '2px solid ' + B.gray20, whiteSpace: 'nowrap', userSelect: 'none',
    background: sortKey === k ? B.blue05 : 'transparent', position: 'sticky', top: 0, zIndex: 1,
  })
  const tdStyle = { padding: '6px 6px', fontSize: 12, fontFamily: bf, borderBottom: '1px solid ' + B.gray10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }
  const inputStyle = { width: '100%', padding: '7px 8px', border: '1px solid ' + B.gray20, borderRadius: 3, fontSize: 12, fontFamily: bf, outline: 'none', boxSizing: 'border-box' }

  const editInput = (id, field, val) => {
    if (editing && editing.id === id && editing.field === field) {
      return <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
        onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
        style={{ ...inputStyle, border: '1px solid ' + B.blue, background: B.blue05, padding: '2px 4px', fontSize: 11 }}
        onClick={e => e.stopPropagation()} />
    }
    return <span onDoubleClick={(e) => { e.stopPropagation(); startEdit(id, field, val) }} style={{ cursor: 'text' }}>{val || '\u2014'}</span>
  }

  return (
    <div style={{ fontFamily: bf }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input placeholder="Search address, buyer, seller..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: '1 1 180px', maxWidth: 280 }} />
        <select value={market} onChange={e => setMarket(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}>
          <option value="all">All Markets</option>
          {[...new Set(comps.map(c => c.market).filter(Boolean))].sort().map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ id: 'all', label: 'All' }, ...COMP_TYPES].map(t => (
            <button key={t.id} onClick={() => setTypeFilter(t.id)}
              style={{ padding: '5px 10px', borderRadius: 3, border: '1px solid ' + (typeFilter === t.id ? (t.color || B.blue) : B.gray20),
                background: typeFilter === t.id ? (t.id === 'all' ? B.blue05 : TYPE_BG[t.id]) : 'white',
                color: typeFilter === t.id ? (t.color || B.blue) : B.gray, fontSize: 11, fontWeight: 600, fontFamily: bf, cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', border: '1px solid ' + B.gray20, borderRadius: 4, overflow: 'hidden' }}>
          <button onClick={() => setView('table')} style={{ padding: '5px 12px', border: 'none', background: view === 'table' ? B.blue : 'white', color: view === 'table' ? 'white' : B.gray, fontSize: 11, fontWeight: 600, fontFamily: bf, cursor: 'pointer' }}>Table</button>
          <button onClick={() => setView('map')} style={{ padding: '5px 12px', border: 'none', borderLeft: '1px solid ' + B.gray20, background: view === 'map' ? B.blue : 'white', color: view === 'map' ? 'white' : B.gray, fontSize: 11, fontWeight: 600, fontFamily: bf, cursor: 'pointer' }}>Map</button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowUpload(true)} style={{ padding: '7px 14px', background: 'white', border: '1px solid ' + B.gray20, borderRadius: 4, fontSize: 12, fontWeight: 600, fontFamily: bf, cursor: 'pointer' }}>&#11014; Upload</button>
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '7px 14px', background: B.blue, color: 'white', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, fontFamily: bf, cursor: 'pointer' }}>+ Add Comp</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ padding: '8px 14px', background: B.white, border: '1px solid ' + B.gray20, borderRadius: 4, fontSize: 12, fontFamily: bf }}><span style={{ color: B.gray }}>Total:</span> <b>{filtered.length}</b></div>
        {saleComps.length > 0 && <div style={{ padding: '8px 14px', background: B.greenLight, border: '1px solid ' + B.green + '20', borderRadius: 4, fontSize: 12, fontFamily: bf }}>
          <span style={{ color: B.green }}>Sales:</span> <b>{saleComps.length}</b>
          {saleComps.some(c => c.price_per_sf) && <span style={{ marginLeft: 8, color: B.gray }}>Avg $/SF: ${Math.round(saleComps.filter(c => c.price_per_sf).reduce((s, c) => s + c.price_per_sf, 0) / saleComps.filter(c => c.price_per_sf).length)}</span>}
        </div>}
        {leaseComps.length > 0 && <div style={{ padding: '8px 14px', background: B.blue10, border: '1px solid ' + B.blue + '20', borderRadius: 4, fontSize: 12, fontFamily: bf }}>
          <span style={{ color: B.blue }}>Leases:</span> <b>{leaseComps.length}</b>
          {leaseComps.some(c => c.rent_psf) && <span style={{ marginLeft: 8, color: B.gray }}>Avg Rent: ${(leaseComps.filter(c => c.rent_psf).reduce((s, c) => s + c.rent_psf, 0) / leaseComps.filter(c => c.rent_psf).length).toFixed(2)}/SF</span>}
        </div>}
        {landComps.length > 0 && <div style={{ padding: '8px 14px', background: B.amberLight, border: '1px solid ' + B.amber + '20', borderRadius: 4, fontSize: 12, fontFamily: bf }}><span style={{ color: B.amber }}>Land:</span> <b>{landComps.length}</b></div>}
      </div>

      {uploadStatus && <div style={{ padding: '10px 14px', background: extracting ? B.amberLight : B.greenLight, border: '1px solid ' + (extracting ? B.amber : B.green) + '40', borderRadius: 4, marginBottom: 12, fontSize: 12, fontFamily: bf }}>{uploadStatus}</div>}

      {/* Upload modal */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowUpload(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 8, padding: 24, width: 480, boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontFamily: hf, fontSize: 18, marginBottom: 16 }}>Upload Comps</h3>
            <div onClick={() => fileRef.current && fileRef.current.click()}
              style={{ border: '2px dashed ' + B.gray20, borderRadius: 6, padding: 32, textAlign: 'center', cursor: 'pointer', marginBottom: 16 }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.blue }}
              onDragLeave={e => { e.currentTarget.style.borderColor = B.gray20 }}
              onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]); setShowUpload(false) }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>&#128196;</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Drop file here or click to browse</div>
              <div style={{ fontSize: 12, color: B.gray, marginTop: 4 }}>Supports .csv, .xlsx, and .pdf</div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" style={{ display: 'none' }} onChange={e => { handleFileUpload(e.target.files[0]); setShowUpload(false) }} />
            </div>
            <div style={{ fontSize: 11, color: B.gray, lineHeight: 1.6, padding: 12, background: B.gray10, borderRadius: 4 }}>
              <b>CSV/XLSX:</b> Auto-maps columns like Address, Building SF, Price, Rent PSF, etc.<br /><b>PDF:</b> AI extracts property details from CoStar reports, broker OMs, etc.
            </div>
            <div style={{ textAlign: 'right', marginTop: 16 }}><button onClick={() => setShowUpload(false)} style={{ padding: '7px 16px', background: B.gray10, border: 'none', borderRadius: 4, fontSize: 12, fontFamily: bf, cursor: 'pointer' }}>Cancel</button></div>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div style={{ background: B.blue05, border: '1px solid ' + B.blue20, borderRadius: 6, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {[
              { k: 'comp_type', l: 'Type', type: 'select', opts: ['sale','lease','land'] },
              { k: 'address', l: 'Address *' }, { k: 'city', l: 'City' }, { k: 'state', l: 'State' },
              { k: 'market', l: 'Market', type: 'select', opts: MARKETS },
              { k: 'building_sf', l: 'Building SF' }, { k: 'lot_acres', l: 'Acres' },
              { k: 'year_built', l: 'Year Built' }, { k: 'clear_height', l: 'Clear Height' },
              { k: 'docks', l: 'Docks' }, { k: 'price', l: 'Price' }, { k: 'price_per_sf', l: '$/SF' },
              { k: 'rent_psf', l: 'Rent $/SF/YR' }, { k: 'cap_rate', l: 'Cap Rate %' },
              { k: 'buyer', l: 'Buyer' }, { k: 'seller', l: 'Seller/Owner' },
              { k: 'comp_date', l: 'Date', type: 'date' }, { k: 'source', l: 'Source' }, { k: 'notes', l: 'Notes' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, fontWeight: 600, color: B.gray, textTransform: 'uppercase' }}>{f.l}</label>
                {f.type === 'select' ? <select value={newComp[f.k]} onChange={e => setNewComp({ ...newComp, [f.k]: e.target.value })} style={inputStyle}>{f.opts.map(o => <option key={o} value={o}>{o}</option>)}</select>
                  : <input type={f.type || 'text'} value={newComp[f.k]} onChange={e => setNewComp({ ...newComp, [f.k]: e.target.value })} style={inputStyle} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addComp} disabled={!newComp.address} style={{ padding: '7px 16px', background: B.blue, color: 'white', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, fontFamily: bf, cursor: 'pointer', opacity: newComp.address ? 1 : 0.5 }}>Save Comp</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '7px 16px', background: B.gray10, border: 'none', borderRadius: 4, fontSize: 12, fontFamily: bf, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* MAP VIEW */}
      {view === 'map' && <CompsMap comps={comps} filtered={filtered} onGeocodeDone={fetchComps} />}

      {/* TABLE VIEW */}
      {view === 'table' && (
        <div style={{ overflowX: 'auto', border: '1px solid ' + B.gray20, borderRadius: 6, background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              <th style={{ ...thStyle(''), width: 30, cursor: 'default' }}>#</th>
              {COMP_FIELDS.map(f => <th key={f.key} onClick={() => toggleSort(f.key)} style={{ ...thStyle(f.key), minWidth: f.w }}>{f.label} {sortKey === f.key ? (sortDir > 0 ? '\u25B2' : '\u25BC') : ''}</th>)}
              <th style={{ ...thStyle(''), width: 40, cursor: 'default' }}></th>
            </tr></thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan={COMP_FIELDS.length + 2} style={{ ...tdStyle, textAlign: 'center', padding: 40, color: B.gray }}>{loading ? 'Loading...' : 'No comps found. Add your first comp or upload a file.'}</td></tr>}
              {sorted.map((c, i) => (
                <tr key={c.id} onMouseEnter={e => e.currentTarget.style.background = B.gray10} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ ...tdStyle, color: B.gray40, fontSize: 10 }}>{i + 1}</td>
                  <td style={tdStyle}>{editInput(c.id, 'address', c.address)}</td>
                  <td style={tdStyle}>{editInput(c.id, 'city', c.city)}</td>
                  <td style={tdStyle}>{editInput(c.id, 'state', c.state)}</td>
                  <td style={tdStyle}><Badge bg={TYPE_BG[c.comp_type]} color={TYPE_COLORS[c.comp_type]} style={{ fontSize: 9 }}>{(c.comp_type || 'sale').toUpperCase()}</Badge></td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: hf }}>{editInput(c.id, 'building_sf', c.building_sf ? fmtN(c.building_sf) : '')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: hf }}>{editInput(c.id, 'lot_acres', c.lot_acres ? Number(c.lot_acres).toFixed(1) : '')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{editInput(c.id, 'year_built', c.year_built)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{editInput(c.id, 'clear_height', c.clear_height ? c.clear_height + "'" : '')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{editInput(c.id, 'docks', c.docks)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontFamily: hf }}>{editInput(c.id, 'price', c.price ? fmt(c.price) : '')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: hf }}>{editInput(c.id, 'price_per_sf', c.price_per_sf ? '$' + fmtN(c.price_per_sf) : '')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: hf, color: B.blue }}>{editInput(c.id, 'rent_psf', c.rent_psf ? '$' + Number(c.rent_psf).toFixed(2) : '')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: hf }}>{editInput(c.id, 'cap_rate', c.cap_rate ? c.cap_rate + '%' : '')}</td>
                  <td style={tdStyle}>{editInput(c.id, 'buyer', c.buyer)}</td>
                  <td style={tdStyle}>{editInput(c.id, 'seller', c.seller)}</td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>{fmtD(c.comp_date)}</td>
                  <td style={{ ...tdStyle, fontSize: 10, color: B.gray }}>{c.source || '\u2014'}</td>
                  <td style={{ ...tdStyle, fontSize: 10, color: B.gray, maxWidth: 150 }}>{c.notes || '\u2014'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button onClick={(e) => { e.stopPropagation(); deleteComp(c.id) }}
                      style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 3 }}
                      onMouseEnter={e => { e.currentTarget.style.color = B.red; e.currentTarget.style.background = B.redLight }}
                      onMouseLeave={e => { e.currentTarget.style.color = B.gray40; e.currentTarget.style.background = 'none' }}>&#128465;</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
