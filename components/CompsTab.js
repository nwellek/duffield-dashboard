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

const TC = { sale: B.green, lease: B.blue, land: B.amber }
const TB = { sale: B.greenLight, lease: B.blue10, land: B.amberLight }
const DASH = '\u2014'

const cn = v => { if (!v && v !== 0) return null; const n = parseFloat(String(v).replace(/[$,\s%]/g, '')); return isNaN(n) ? null : n }
const fmtN = (v, d) => v ? Number(v).toLocaleString('en-US', { minimumFractionDigits: d||0, maximumFractionDigits: d||0 }) : DASH
const fmtD = v => v ? new Date(v + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : DASH
const fmtPrice = v => v ? '$' + Number(v).toLocaleString() : DASH
const fmtRent = v => v ? '$' + Number(v).toFixed(2) : DASH

async function geocodeAddr(address, city, state) {
  const q = [address, city, state].filter(Boolean).join(', ')
  if (!q || q.length < 5) return null
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&limit=1&countrycodes=us', { headers: { 'User-Agent': 'DuffieldDashboard/1.0' } })
    const d = await r.json()
    if (d && d.length > 0) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) }
  } catch (e) {}
  return null
}

function mkIcon(type) {
  if (!L) return null
  return L.divIcon({ className: 'comp-marker', html: '<div style="width:14px;height:14px;background:' + (TC[type]||B.gray) + ';border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>', iconSize: [14,14], iconAnchor: [7,7] })
}

function popupHtml(c) {
  const r = (l, v) => v ? '<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#888">' + l + '</span><b>' + v + '</b></div>' : ''
  var h = '<div style="font-family:sans-serif;font-size:12px;min-width:200px">'
  h += '<div style="font-weight:700;font-size:14px;margin-bottom:2px">' + (c.address || '') + '</div>'
  h += '<div style="color:#888;font-size:11px;margin-bottom:8px">' + [c.city,c.state].filter(Boolean).join(', ') + '</div>'
  if (c.comp_type === 'lease') { h += r('Rent/SF', c.rent_psf ? '$'+Number(c.rent_psf).toFixed(2) : ''); h += r('Bldg SF', c.building_sf ? Number(c.building_sf).toLocaleString() : '') }
  else if (c.comp_type === 'land') { h += r('Acres', c.lot_acres ? Number(c.lot_acres).toFixed(1) : ''); h += r('Price', c.price ? '$'+Number(c.price).toLocaleString() : '') }
  else { h += r('Price', c.price ? '$'+Number(c.price).toLocaleString() : ''); h += r('$/SF', c.price_per_sf ? '$'+Number(c.price_per_sf).toLocaleString() : ''); h += r('Cap', c.cap_rate ? c.cap_rate+'%' : '') }
  h += r('Built', c.year_built); h += r('Date', fmtD(c.comp_date)); if (c.seller) h += r('Owner', c.seller)
  return h + '</div>'
}

function CompsMap({ comps, filtered, onGeocodeDone }) {
  const mapRef = useRef(null), mapInst = useRef(null), markersRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')

  useEffect(() => {
    if (!L || !mapRef.current || mapInst.current) return
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png', iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png' })
    const m = L.map(mapRef.current, { center: [35.5, -80], zoom: 6, zoomControl: true })
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri', maxZoom: 19 })
    const lbl = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19, pane: 'shadowPane' })
    const hybrid = L.layerGroup([sat, lbl])
    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 })
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
    hybrid.addTo(m)
    L.control.layers({ 'Satellite': hybrid, 'Dark': dark, 'Street': osm }, null, { position: 'topright' }).addTo(m)
    markersRef.current = L.layerGroup().addTo(m)
    mapInst.current = m; setReady(true)
    return () => { m.remove(); mapInst.current = null }
  }, [])

  useEffect(() => {
    if (!ready || !markersRef.current || !L) return
    markersRef.current.clearLayers()
    const bounds = []
    filtered.forEach(c => {
      const lat = parseFloat(c.latitude), lng = parseFloat(c.longitude)
      if (!lat || !lng || (Math.abs(lat) < 0.1 && Math.abs(lng) < 0.1)) return
      const marker = L.marker([lat, lng], { icon: mkIcon(c.comp_type) })
      marker.bindPopup(popupHtml(c), { maxWidth: 280 })
      markersRef.current.addLayer(marker); bounds.push([lat, lng])
    })
    if (bounds.length > 0 && mapInst.current) mapInst.current.fitBounds(bounds, { padding: [40,40], maxZoom: 14 })
  }, [filtered, ready])

  const geocodeAll = async () => {
    const missing = comps.filter(c => (!c.latitude || !c.longitude) && c.address && c.city)
    if (missing.length === 0) { setGeoMsg('All comps geocoded'); return }
    setGeocoding(true); setGeoMsg('Geocoding ' + missing.length + '...')
    var done = 0, fail = 0
    for (const c of missing) {
      const r = await geocodeAddr(c.address, c.city, c.state)
      if (r) { await supabase.from('market_comps').update({ latitude: r.lat, longitude: r.lng }).eq('id', c.id); done++ } else fail++
      setGeoMsg(done + '/' + missing.length + (fail ? ' ('+fail+' failed)' : ''))
      await new Promise(r => setTimeout(r, 1100))
    }
    setGeocoding(false); setGeoMsg('Done: ' + done + ' geocoded'); if (onGeocodeDone) onGeocodeDone()
    setTimeout(() => setGeoMsg(''), 4000)
  }

  const mapped = filtered.filter(c => c.latitude && c.longitude && (Math.abs(c.latitude) > 0.1 || Math.abs(c.longitude) > 0.1)).length
  const unmapped = filtered.length - mapped

  return (
    <div style={{ position: 'relative' }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div ref={mapRef} style={{ height: 580, borderRadius: 6, border: '1px solid '+B.gray20 }} />
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 1000, display: 'flex', gap: 8, alignItems: 'center' }}>
        {unmapped > 0 && <button onClick={geocodeAll} disabled={geocoding} style={{ padding: '6px 12px', background: 'white', border: '1px solid '+B.gray20, borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: bf, cursor: geocoding ? 'wait' : 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>{geocoding ? 'Geocoding...' : '\uD83C\uDF10 Geocode '+unmapped+' comps'}</button>}
        {geoMsg && <span style={{ padding: '4px 10px', background: 'white', borderRadius: 4, fontSize: 11, fontFamily: bf, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>{geoMsg}</span>}
      </div>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', gap: 8 }}>
        <span style={{ padding: '4px 10px', background: 'white', borderRadius: 4, fontSize: 11, fontFamily: bf, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>{mapped} mapped{unmapped > 0 ? ' \u00b7 '+unmapped+' unmapped' : ''}</span>
        <div style={{ padding: '4px 10px', background: 'white', borderRadius: 4, fontSize: 10, fontFamily: bf, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          <span style={{ display:'flex',alignItems:'center',gap:3 }}><span style={{ width:8,height:8,borderRadius:'50%',background:B.green,display:'inline-block' }} />Sale</span>
          <span style={{ display:'flex',alignItems:'center',gap:3 }}><span style={{ width:8,height:8,borderRadius:'50%',background:B.blue,display:'inline-block' }} />Lease</span>
          <span style={{ display:'flex',alignItems:'center',gap:3 }}><span style={{ width:8,height:8,borderRadius:'50%',background:B.amber,display:'inline-block' }} />Land</span>
        </div>
      </div>
    </div>
  )
}

function normalizeCol(col) {
  if (!col) return null
  const c = String(col).replace(/[\n\r]+/g,' ').trim().toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'_')
  if (!c) return null
  const M = { address:'address',property_address:'address',street_address:'address',location:'address',property_name_address:'address',property_name:'address',site:'address',city:'city',town:'city',state:'state',st:'state',type:'comp_type',comp_type:'comp_type',property_type:'_proptype',building_sf:'building_sf',size:'building_sf',sf:'building_sf',sqft:'building_sf',size_leased:'building_sf',rba:'building_sf',bldg_sf:'building_sf',total_sf:'building_sf',gla:'building_sf',lot_acres:'lot_acres',acres:'lot_acres',acreage:'lot_acres',land_area:'lot_acres',year_built:'year_built',built:'year_built',built_renovated:'year_built',yr_built:'year_built',clear_height:'clear_height',clear_ht:'clear_height',ceiling_height:'clear_height',docks:'docks',dock_doors:'docks',loading_docks:'docks',price:'price',asking_price:'price',sale_price:'price',purchase_price:'price',asking_price_cap_rate:'price',price_per_sf:'price_per_sf',price_psf:'price_per_sf',psf:'price_per_sf',asking_price_per_sf:'price_per_sf',rent_psf:'rent_psf',rent:'rent_psf',asking_rent:'rent_psf',rent_per_sf:'rent_psf',rental_rate:'rent_psf',base_rent:'rent_psf',asking_rent_cap_rate:'rent_psf',cap_rate:'cap_rate',cap:'cap_rate',buyer:'buyer',purchaser:'buyer',seller:'seller',owner:'seller',true_owner:'seller',recorded_owner:'seller',source:'source',notes:'notes',comments:'notes',date:'comp_date',sale_date:'comp_date',comp_date:'comp_date',latitude:'latitude',lat:'latitude',longitude:'longitude',lng:'longitude',lon:'longitude',tenant:'_tenant',tenant_name:'_tenant',submarket:'market',market:'market',zoning:'_zoning' }
  if (M[c]) return M[c]
  if (c.includes('address')||c.includes('property_name')) return 'address'
  if (c.includes('building')&&c.includes('sf')) return 'building_sf'
  if (c.includes('clear')&&c.includes('h')) return 'clear_height'
  if (c.includes('year')&&c.includes('built')) return 'year_built'
  if (c.includes('cap')&&c.includes('rate')) return 'cap_rate'
  if (c.includes('rent')&&(c.includes('sf')||c.includes('psf'))) return 'rent_psf'
  if (c.includes('price')&&c.includes('sf')) return 'price_per_sf'
  if (c.includes('asking')&&c.includes('rent')) return 'rent_psf'
  if (c.includes('dock')) return 'docks'
  if (c.includes('acre')) return 'lot_acres'
  return null
}

function cleanNum(v) {
  if (!v && v !== 0) return null
  var s = String(v).trim()
  if (!s||s==='-'||s===DASH||s.toLowerCase()==='withheld'||s.toLowerCase().includes('not for sale')||s.toLowerCase().includes('not disclosed')||s.toLowerCase()==='negotiable') return null
  var raw = s.split(/\s*[-\/]\s*/)[0].replace(/[$,\s%sfSF]/g,'').replace(/['\u2019\u2032]/g,'')
  var n = parseFloat(raw); return isNaN(n) ? null : n
}

function cleanHeight(v) {
  if (!v) return null
  var s = String(v).trim()
  var m = s.match(/(\d+)['\u2019\u2032]\s*(\d+)?/)
  if (m) return m[2] ? parseFloat(m[1])+parseFloat(m[2])/12 : parseFloat(m[1])
  return cleanNum(s)
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
  const [pendingComps, setPendingComps] = useState(null)
  const fileRef = useRef(null)

  const emptyComp = { market: MARKETS[0], comp_type: 'sale', address: '', city: '', state: '', building_sf: '', lot_acres: '', price: '', price_per_sf: '', rent_psf: '', cap_rate: '', clear_height: '', year_built: '', buyer: '', seller: '', source: '', notes: '', comp_date: new Date().toISOString().slice(0,10) }
  const [newComp, setNewComp] = useState(emptyComp)

  const fetchComps = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('market_comps').select('*').order('comp_date', { ascending: false }).limit(1000)
    if (data) setComps(data); setLoading(false)
  }, [])
  useEffect(() => { fetchComps() }, [fetchComps])

  var filtered = comps
  if (market !== 'all') filtered = filtered.filter(c => c.market === market)
  if (typeFilter !== 'all') filtered = filtered.filter(c => c.comp_type === typeFilter)
  if (search.trim().length >= 2) { var q = search.toLowerCase(); filtered = filtered.filter(c => (c.address||'').toLowerCase().includes(q)||(c.city||'').toLowerCase().includes(q)||(c.buyer||'').toLowerCase().includes(q)||(c.seller||'').toLowerCase().includes(q)||(c.notes||'').toLowerCase().includes(q)) }
  const sorted = [...filtered].sort((a,b) => { var av=a[sortKey],bv=b[sortKey]; if (typeof av==='string') return sortDir*(av||'').localeCompare(bv||''); return sortDir*((Number(av)||0)-(Number(bv)||0)) })
  const toggleSort = k => { if (sortKey===k) setSortDir(d=>d*-1); else { setSortKey(k); setSortDir(1) } }

  const addComp = async () => {
    var cl = { ...newComp }
    ;['building_sf','lot_acres','price','price_per_sf','rent_psf','cap_rate','clear_height','year_built'].forEach(k => { cl[k] = cn(cl[k]) })
    if (cl.price&&cl.building_sf&&!cl.price_per_sf) cl.price_per_sf = Math.round(cl.price/cl.building_sf)
    if (!cl.comp_date) cl.comp_date = null
    await supabase.from('market_comps').insert(cl)
    setNewComp(emptyComp); setShowAdd(false); fetchComps()
  }
  const deleteComp = async id => { if (!confirm('Delete this comp?')) return; await supabase.from('market_comps').delete().eq('id',id); fetchComps() }
  const startEdit = (id,field,val) => { setEditing({id,field}); setEditVal(val||'') }
  const saveEdit = async () => { if (!editing) return; var val = ['building_sf','lot_acres','price','price_per_sf','rent_psf','cap_rate','clear_height','year_built'].includes(editing.field)?cn(editVal):editVal; await supabase.from('market_comps').update({[editing.field]:val}).eq('id',editing.id); setEditing(null); setEditVal(''); fetchComps() }
  const cancelEdit = () => { setEditing(null); setEditVal('') }

  const handleFileUpload = async (file) => {
    if (!file) return; var name = file.name.toLowerCase()
    if (name.endsWith('.pdf')) { await extractFromPDF(file); return }
    setUploadStatus('Parsing '+file.name+'...')
    try {
      if (name.endsWith('.csv')) {
        var text = await file.text(); var Papa = (await import('papaparse')).default
        Papa.parse(text, { header:true, skipEmptyLines:true, complete: async function(r) { setUploadStatus('Parsed '+r.data.length+' rows...'); await ingestRows(r.data, file.name) } })
      } else if (name.endsWith('.xlsx')||name.endsWith('.xls')) {
        var XLSX = await import('xlsx'); var buf = await file.arrayBuffer()
        var wb = XLSX.read(buf, { type:'array', cellDates:true, dateNF:'yyyy-mm-dd' })
        var allRows = []
        wb.SheetNames.forEach(function(sn) {
          var aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header:1, defval:'', raw:false })
          var hi = -1
          for (var i=0;i<Math.min(aoa.length,10);i++) { if ((aoa[i]||[]).filter(function(c){return c!==null&&c!==undefined&&String(c).trim()!==''}).length>=3) { hi=i; break } }
          if (hi===-1) return
          var headers = aoa[hi].map(function(h){return String(h||'').trim()})
          var sl = sn.toLowerCase(); var st = sl.includes('lease')?'lease':sl.includes('land')?'land':sl.includes('sale')?'sale':''
          for (var i2=hi+1;i2<aoa.length;i2++) {
            var row=aoa[i2]||[]; if (row.filter(function(c){return c!==null&&c!==undefined&&String(c).trim()!==''}).length<2) continue
            var rs = row.join(' ').toLowerCase(); if (rs.includes('total')||rs.includes('weighted average')) continue
            var obj = {}; headers.forEach(function(h,idx) { if (h&&idx<row.length) obj[h]=row[idx] }); if (st) obj._sheetType=st; allRows.push(obj)
          }
        })
        setUploadStatus('Parsed '+allRows.length+' rows...'); await ingestRows(allRows, file.name)
      } else setUploadStatus('Unsupported file type')
    } catch(e) { setUploadStatus('Upload failed: '+e.message); setTimeout(function(){setUploadStatus('')},5000) }
  }

  const ingestRows = async (rows, fileName) => {
    var keys = rows.length>0?Object.keys(rows[0]):[]; var colMap = {}
    keys.forEach(function(k) { if (k.startsWith('_')) return; var m=normalizeCol(k); if (m&&!colMap[m]) colMap[m]=k })
    var inserts = []
    rows.forEach(function(r) {
      var get = function(f) { var k=colMap[f]; if (!k) return ''; var v=r[k]; return v!=null?String(v).trim():'' }
      var getAny = function(f) { var v=get(f); if (v) return v; var alts = Array.prototype.slice.call(arguments,1); for (var ai=0;ai<alts.length;ai++) { for (var ki in r) { if (ki.toLowerCase().replace(/[^a-z]/g,'').includes(alts[ai].toLowerCase().replace(/[^a-z]/g,''))) { var v2=r[ki]; if (v2!=null&&String(v2).trim()) return String(v2).trim() } } } return '' }
      var addr = get('address')||getAny('address','propertyname','location')
      if (!addr||addr.length<3) return
      var city=get('city')||getAny('city','town'), state=get('state')||getAny('state','st')||'NC'
      var ct = (r._sheetType||get('comp_type')||'').toLowerCase()
      var rentV=get('rent_psf')||getAny('rent_psf','askingrent'), priceV=get('price')||getAny('price','saleprice')
      if (!ct||['lease','sale','land'].indexOf(ct)===-1) { if (rentV&&cleanNum(rentV)) ct='lease'; else ct='sale' }
      var notes = [getAny('_proptype','propertytype','type'), getAny('_zoning','zoning')?'Zoning: '+getAny('_zoning','zoning'):'', getAny('_tenant','tenant')?'Tenant: '+getAny('_tenant','tenant'):'', get('notes')].filter(Boolean).join(' | ')||null
      var comp = { address:addr.split('\n')[0].trim(), city:city, state:state, comp_type:ct, market:get('market')||(city&&state?city+', '+state:'Other'), building_sf:cleanNum(get('building_sf')||getAny('building_sf','size','sqft')), lot_acres:cleanNum(get('lot_acres')||getAny('lot_acres','acres')), year_built:cleanNum(get('year_built')||getAny('year_built','built')), clear_height:cleanHeight(get('clear_height')||getAny('clear_height','clearheight')), price:cleanNum(priceV), price_per_sf:cleanNum(get('price_per_sf')||getAny('price_per_sf','pricepsf')), rent_psf:cleanNum(rentV), cap_rate:cleanNum(get('cap_rate')||getAny('cap_rate','caprate')), buyer:get('buyer')||getAny('buyer','purchaser'), seller:get('seller')||getAny('seller','owner','trueowner'), source:'Upload: '+fileName, notes:notes, comp_date:get('comp_date')||getAny('comp_date','saledate','date')||new Date().toISOString().slice(0,10), latitude:cleanNum(get('latitude')), longitude:cleanNum(get('longitude')) }
      if (!comp.price_per_sf&&comp.price&&comp.building_sf) comp.price_per_sf=Math.round(comp.price/comp.building_sf)
      inserts.push(comp)
    })
    if (inserts.length===0) { setUploadStatus('No valid comps found'); setTimeout(function(){setUploadStatus('')},5000); return }
    setPendingComps({ comps:inserts, source:fileName }); setUploadStatus('Found '+inserts.length+' comps. Review below.')
  }

  const extractFromPDF = async (file) => {
    setExtracting(true); setUploadStatus('Reading PDF text...')
    try {
      var buf = await file.arrayBuffer()
      // Load pdf.js from CDN to extract text client-side (avoids 4.5MB Vercel body limit)
      if (!window.pdfjsLib) {
        var script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        document.head.appendChild(script)
        await new Promise(function(resolve) { script.onload = resolve })
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      var pdf = await window.pdfjsLib.getDocument({ data: buf }).promise
      var allText = ''
      for (var p = 1; p <= pdf.numPages; p++) {
        var page = await pdf.getPage(p)
        var content = await page.getTextContent()
        var pageText = content.items.map(function(item) { return item.str }).join(' ')
        allText += '\n--- PAGE ' + p + ' ---\n' + pageText
      }
      console.log('PDF text extracted:', allText.length, 'chars from', pdf.numPages, 'pages')
      console.log('First 2000 chars:', allText.substring(0, 2000))
      if (allText.trim().length < 50) { setUploadStatus('PDF appears to be image-only (no extractable text). Try a text-based PDF.'); setExtracting(false); return }
      setUploadStatus('Extracted ' + Math.round(allText.length/1024) + 'KB text from ' + pdf.numPages + ' pages. Sending to AI...')
      var resp = await fetch('/api/extract-comps', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pdf_text:allText}) })
      var data = await resp.json()
      console.log('API response:', JSON.stringify(data).substring(0, 1000))
      if (!resp.ok) { console.error('API error details:', data); setUploadStatus('API error: '+(data.error||resp.status)); setExtracting(false); return }
      var extracted = data.comps
      if (!extracted||extracted.length===0) { console.log('AI returned empty comps array. Full response:', JSON.stringify(data)); setUploadStatus('No properties found in PDF. Check console for details.'); setExtracting(false); return }
      var inserts = extracted.map(function(c) {
        var cl = function(v) { return (v==null||String(v).trim()===''||String(v).toLowerCase()==='null')?null:String(v).trim() }
        var addr = cl(c.address); if (!addr) return null
        var city=cl(c.city), state=cl(c.state)||'NC'
        return { address:addr, city:city, state:state, comp_type:['sale','lease','land'].indexOf(c.comp_type)>=0?c.comp_type:'lease', market:(city&&state)?city+', '+state:'Other', building_sf:cleanNum(c.building_sf), lot_acres:cleanNum(c.lot_acres), year_built:cleanNum(c.year_built), clear_height:cleanNum(c.clear_height), price:cleanNum(c.price), price_per_sf:cleanNum(c.price_per_sf), rent_psf:cleanNum(c.rent_psf), cap_rate:cleanNum(c.cap_rate), buyer:cl(c.buyer), seller:cl(c.seller), notes:cl(c.notes), source:'PDF: '+file.name, comp_date:cl(c.comp_date)||new Date().toISOString().slice(0,10), latitude:cleanNum(c.latitude), longitude:cleanNum(c.longitude) }
      }).filter(Boolean)
      inserts.forEach(function(c) { if (!c.price_per_sf&&c.price&&c.building_sf) c.price_per_sf=Math.round(c.price/c.building_sf) })
      if (inserts.length===0) { setUploadStatus('No valid addresses found'); setExtracting(false); return }
      setPendingComps({ comps:inserts, source:'PDF: '+file.name }); setUploadStatus('AI found '+inserts.length+' comps. Review below.')
    } catch(e) { setUploadStatus('PDF extraction failed: '+e.message) }
    setExtracting(false)
  }

  const approveComps = async () => {
    if (!pendingComps) return; var ins = pendingComps.comps
    setUploadStatus('Inserting '+ins.length+' comps...'); var done=0
    for (var i=0;i<ins.length;i+=50) { var ch=ins.slice(i,i+50); var res=await supabase.from('market_comps').insert(ch); if (res.error) { setUploadStatus('DB error: '+res.error.message); break } done+=ch.length }
    setUploadStatus('Inserted '+done+' comps'); setPendingComps(null); fetchComps(); setTimeout(function(){setUploadStatus('')},4000)
  }
  const rejectComps = () => { setPendingComps(null); setUploadStatus('Cancelled.'); setTimeout(function(){setUploadStatus('')},2000) }

  var saleComps=filtered.filter(function(c){return c.comp_type==='sale'}), leaseComps=filtered.filter(function(c){return c.comp_type==='lease'}), landComps=filtered.filter(function(c){return c.comp_type==='land'})

  const thS = (k) => ({ padding:'8px 6px',textAlign:'left',fontSize:10,fontWeight:700,fontFamily:hf,color:B.gray,textTransform:'uppercase',letterSpacing:'0.04em',cursor:'pointer',borderBottom:'2px solid '+B.gray20,whiteSpace:'nowrap',userSelect:'none',background:sortKey===k?B.blue05:'transparent',position:'sticky',top:0,zIndex:1 })
  const tdS = { padding:'6px',fontSize:12,fontFamily:bf,borderBottom:'1px solid '+B.gray10,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:200 }
  const inpS = { width:'100%',padding:'7px 8px',border:'1px solid '+B.gray20,borderRadius:3,fontSize:12,fontFamily:bf,outline:'none',boxSizing:'border-box' }

  const editInput = (id,field,val) => {
    if (editing&&editing.id===id&&editing.field===field) return <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={e=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')cancelEdit()}} style={{...inpS,border:'1px solid '+B.blue,background:B.blue05,padding:'2px 4px',fontSize:11}} onClick={e=>e.stopPropagation()} />
    return <span onDoubleClick={e=>{e.stopPropagation();startEdit(id,field,val)}} style={{cursor:'text'}}>{val||DASH}</span>
  }

  const compTd = (c, field) => {
    if (field === 'comp_type') return <Badge bg={TB[c.comp_type]} color={TC[c.comp_type]} style={{fontSize:9}}>{(c.comp_type||'sale').toUpperCase()}</Badge>
    if (field === 'building_sf') return editInput(c.id, field, c.building_sf ? fmtN(c.building_sf) : '')
    if (field === 'lot_acres') return editInput(c.id, field, c.lot_acres ? Number(c.lot_acres).toFixed(1) : '')
    if (field === 'clear_height') return editInput(c.id, field, c.clear_height ? c.clear_height+"'" : '')
    if (field === 'price') return editInput(c.id, field, c.price ? fmt(c.price) : '')
    if (field === 'price_per_sf') return editInput(c.id, field, c.price_per_sf ? fmtPrice(c.price_per_sf) : '')
    if (field === 'rent_psf') return editInput(c.id, field, c.rent_psf ? fmtRent(c.rent_psf) : '')
    if (field === 'cap_rate') return editInput(c.id, field, c.cap_rate ? c.cap_rate+'%' : '')
    if (field === 'comp_date') return fmtD(c.comp_date)
    return editInput(c.id, field, c[field])
  }

  const numFields = new Set(['building_sf','lot_acres','year_built','clear_height','price','price_per_sf','rent_psf','cap_rate'])

  return (
    <div style={{ fontFamily: bf }}>
      <div style={{ display:'flex',gap:8,alignItems:'center',marginBottom:14,flexWrap:'wrap' }}>
        <input placeholder="Search address, buyer, seller..." value={search} onChange={e=>setSearch(e.target.value)} style={{...inpS,flex:'1 1 180px',maxWidth:280}} />
        <select value={market} onChange={e=>setMarket(e.target.value)} style={{...inpS,width:'auto',flex:'0 0 auto'}}>
          <option value="all">All Markets</option>
          {[...new Set(comps.map(c=>c.market).filter(Boolean))].sort().map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{display:'flex',gap:4}}>
          {[{id:'all',label:'All'},...COMP_TYPES].map(t=><button key={t.id} onClick={()=>setTypeFilter(t.id)} style={{padding:'5px 10px',borderRadius:3,border:'1px solid '+(typeFilter===t.id?(t.color||B.blue):B.gray20),background:typeFilter===t.id?(t.id==='all'?B.blue05:TB[t.id]):'white',color:typeFilter===t.id?(t.color||B.blue):B.gray,fontSize:11,fontWeight:600,fontFamily:bf,cursor:'pointer'}}>{t.label}</button>)}
        </div>
        <div style={{display:'flex',border:'1px solid '+B.gray20,borderRadius:4,overflow:'hidden'}}>
          <button onClick={()=>setView('table')} style={{padding:'5px 12px',border:'none',background:view==='table'?B.blue:'white',color:view==='table'?'white':B.gray,fontSize:11,fontWeight:600,fontFamily:bf,cursor:'pointer'}}>Table</button>
          <button onClick={()=>setView('map')} style={{padding:'5px 12px',border:'none',borderLeft:'1px solid '+B.gray20,background:view==='map'?B.blue:'white',color:view==='map'?'white':B.gray,fontSize:11,fontWeight:600,fontFamily:bf,cursor:'pointer'}}>Map</button>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
          <button onClick={()=>setShowUpload(true)} style={{padding:'7px 14px',background:'white',border:'1px solid '+B.gray20,borderRadius:4,fontSize:12,fontWeight:600,fontFamily:bf,cursor:'pointer'}}>&#11014; Upload</button>
          <button onClick={()=>setShowAdd(!showAdd)} style={{padding:'7px 14px',background:B.blue,color:'white',border:'none',borderRadius:4,fontSize:12,fontWeight:600,fontFamily:bf,cursor:'pointer'}}>+ Add Comp</button>
        </div>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <div style={{padding:'8px 14px',background:B.white,border:'1px solid '+B.gray20,borderRadius:4,fontSize:12,fontFamily:bf}}><span style={{color:B.gray}}>Total:</span> <b>{filtered.length}</b></div>
        {saleComps.length>0&&<div style={{padding:'8px 14px',background:B.greenLight,border:'1px solid '+B.green+'20',borderRadius:4,fontSize:12,fontFamily:bf}}><span style={{color:B.green}}>Sales:</span> <b>{saleComps.length}</b></div>}
        {leaseComps.length>0&&<div style={{padding:'8px 14px',background:B.blue10,border:'1px solid '+B.blue+'20',borderRadius:4,fontSize:12,fontFamily:bf}}><span style={{color:B.blue}}>Leases:</span> <b>{leaseComps.length}</b></div>}
        {landComps.length>0&&<div style={{padding:'8px 14px',background:B.amberLight,border:'1px solid '+B.amber+'20',borderRadius:4,fontSize:12,fontFamily:bf}}><span style={{color:B.amber}}>Land:</span> <b>{landComps.length}</b></div>}
      </div>

      {uploadStatus&&<div style={{padding:'10px 14px',background:extracting?B.amberLight:B.greenLight,border:'1px solid '+(extracting?B.amber:B.green)+'40',borderRadius:4,marginBottom:12,fontSize:12,fontFamily:bf}}>{uploadStatus}</div>}

      {pendingComps&&(
        <div style={{border:'2px solid '+B.blue,borderRadius:6,background:B.blue05,marginBottom:14,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',background:B.blue,color:'white',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontFamily:hf,fontWeight:700,fontSize:14}}>Review {pendingComps.comps.length} Extracted Comps</span>
            <span style={{fontSize:11,opacity:0.8}}>from {pendingComps.source}</span>
          </div>
          <div style={{maxHeight:400,overflowY:'auto',overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead><tr style={{background:B.blue10}}>
                {['#','Address','City','Type','Bldg SF','Price','Rent/SF','Built','Owner','Notes'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:['Bldg SF','Price','Rent/SF','Built'].includes(h)?'right':'left',fontFamily:hf,fontSize:10,color:B.gray,fontWeight:700}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {pendingComps.comps.map((c,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid '+B.gray10}}>
                    <td style={{padding:'5px 8px',color:B.gray40,fontSize:10}}>{i+1}</td>
                    <td style={{padding:'5px 8px',fontWeight:600,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.address}</td>
                    <td style={{padding:'5px 8px'}}>{[c.city,c.state].filter(Boolean).join(', ')}</td>
                    <td style={{padding:'5px 8px'}}><Badge bg={TB[c.comp_type]} color={TC[c.comp_type]} style={{fontSize:8}}>{(c.comp_type||'').toUpperCase()}</Badge></td>
                    <td style={{padding:'5px 8px',textAlign:'right',fontFamily:hf}}>{c.building_sf?Number(c.building_sf).toLocaleString():DASH}</td>
                    <td style={{padding:'5px 8px',textAlign:'right',fontFamily:hf}}>{c.price?fmtPrice(c.price):DASH}</td>
                    <td style={{padding:'5px 8px',textAlign:'right',fontFamily:hf,color:B.blue}}>{c.rent_psf?fmtRent(c.rent_psf):DASH}</td>
                    <td style={{padding:'5px 8px',textAlign:'right'}}>{c.year_built||DASH}</td>
                    <td style={{padding:'5px 8px',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.seller||DASH}</td>
                    <td style={{padding:'5px 8px',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:B.gray,fontSize:10}}>{c.notes||DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:'12px 16px',borderTop:'1px solid '+B.gray20,display:'flex',gap:8,justifyContent:'flex-end',background:'white'}}>
            <button onClick={rejectComps} style={{padding:'8px 20px',background:'white',border:'1px solid '+B.red,color:B.red,borderRadius:4,fontSize:12,fontWeight:600,fontFamily:bf,cursor:'pointer'}}>Reject All</button>
            <button onClick={approveComps} style={{padding:'8px 20px',background:B.green,color:'white',border:'none',borderRadius:4,fontSize:12,fontWeight:600,fontFamily:bf,cursor:'pointer'}}>Approve All ({pendingComps.comps.length})</button>
          </div>
        </div>
      )}

      {showUpload&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowUpload(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'white',borderRadius:8,padding:24,width:480,boxShadow:'0 16px 48px rgba(0,0,0,0.15)'}}>
            <h3 style={{fontFamily:hf,fontSize:18,marginBottom:16}}>Upload Comps</h3>
            <div onClick={()=>fileRef.current&&fileRef.current.click()} style={{border:'2px dashed '+B.gray20,borderRadius:6,padding:32,textAlign:'center',cursor:'pointer',marginBottom:16}} onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=B.blue}} onDragLeave={e=>{e.currentTarget.style.borderColor=B.gray20}} onDrop={e=>{e.preventDefault();handleFileUpload(e.dataTransfer.files[0]);setShowUpload(false)}}>
              <div style={{fontSize:28,marginBottom:8}}>&#128196;</div>
              <div style={{fontSize:14,fontWeight:600}}>Drop file or click to browse</div>
              <div style={{fontSize:12,color:B.gray,marginTop:4}}>.csv, .xlsx, .pdf</div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" style={{display:'none'}} onChange={e=>{handleFileUpload(e.target.files[0]);setShowUpload(false)}} />
            </div>
            <div style={{fontSize:11,color:B.gray,lineHeight:1.6,padding:12,background:B.gray10,borderRadius:4}}><b>CSV/XLSX:</b> Auto-maps columns.<br /><b>PDF:</b> AI extracts comps from CoStar, OMs, etc.</div>
            <div style={{textAlign:'right',marginTop:16}}><button onClick={()=>setShowUpload(false)} style={{padding:'7px 16px',background:B.gray10,border:'none',borderRadius:4,fontSize:12,fontFamily:bf,cursor:'pointer'}}>Cancel</button></div>
          </div>
        </div>
      )}

      {showAdd&&(
        <div style={{background:B.blue05,border:'1px solid '+B.blue20,borderRadius:6,padding:16,marginBottom:14}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))',gap:8}}>
            {[{k:'comp_type',l:'Type',type:'select',opts:['sale','lease','land']},{k:'address',l:'Address *'},{k:'city',l:'City'},{k:'state',l:'State'},{k:'market',l:'Market',type:'select',opts:MARKETS},{k:'building_sf',l:'Building SF'},{k:'lot_acres',l:'Acres'},{k:'year_built',l:'Year Built'},{k:'clear_height',l:'Clear Height'},{k:'price',l:'Price'},{k:'price_per_sf',l:'$/SF'},{k:'rent_psf',l:'Rent $/SF/YR'},{k:'cap_rate',l:'Cap Rate %'},{k:'buyer',l:'Buyer'},{k:'seller',l:'Seller/Owner'},{k:'comp_date',l:'Date',type:'date'},{k:'source',l:'Source'},{k:'notes',l:'Notes'}].map(f=>(
              <div key={f.k}><label style={{fontSize:10,fontWeight:600,color:B.gray,textTransform:'uppercase'}}>{f.l}</label>
                {f.type==='select'?<select value={newComp[f.k]} onChange={e=>setNewComp({...newComp,[f.k]:e.target.value})} style={inpS}>{f.opts.map(o=><option key={o} value={o}>{o}</option>)}</select>
                :<input type={f.type||'text'} value={newComp[f.k]} onChange={e=>setNewComp({...newComp,[f.k]:e.target.value})} style={inpS} />}
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button onClick={addComp} disabled={!newComp.address} style={{padding:'7px 16px',background:B.blue,color:'white',border:'none',borderRadius:4,fontSize:12,fontWeight:600,fontFamily:bf,cursor:'pointer',opacity:newComp.address?1:0.5}}>Save Comp</button>
            <button onClick={()=>setShowAdd(false)} style={{padding:'7px 16px',background:B.gray10,border:'none',borderRadius:4,fontSize:12,fontFamily:bf,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      )}

      {view==='map'&&<CompsMap comps={comps} filtered={filtered} onGeocodeDone={fetchComps} />}

      {view==='table'&&(
        <div style={{overflowX:'auto',border:'1px solid '+B.gray20,borderRadius:6,background:'white'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>
              <th style={{...thS(''),width:30,cursor:'default'}}>#</th>
              {COMP_FIELDS.map(f=><th key={f.key} onClick={()=>toggleSort(f.key)} style={{...thS(f.key),minWidth:f.w}}>{f.label} {sortKey===f.key?(sortDir>0?'\u25B2':'\u25BC'):''}</th>)}
              <th style={{...thS(''),width:40,cursor:'default'}}></th>
            </tr></thead>
            <tbody>
              {sorted.length===0&&<tr><td colSpan={COMP_FIELDS.length+2} style={{...tdS,textAlign:'center',padding:40,color:B.gray}}>{loading?'Loading...':'No comps found. Upload a file or add manually.'}</td></tr>}
              {sorted.map((c,i)=>(
                <tr key={c.id} onMouseEnter={e=>{e.currentTarget.style.background=B.gray10}} onMouseLeave={e=>{e.currentTarget.style.background=''}}>
                  <td style={{...tdS,color:B.gray40,fontSize:10}}>{i+1}</td>
                  {COMP_FIELDS.map(f=><td key={f.key} style={{...tdS,textAlign:numFields.has(f.key)?'right':'left',fontFamily:numFields.has(f.key)?hf:bf,color:f.key==='rent_psf'?B.blue:undefined,fontWeight:f.key==='price'?600:undefined,fontSize:f.key==='source'||f.key==='notes'?10:12,maxWidth:f.key==='notes'?150:undefined}}>{compTd(c,f.key)}</td>)}
                  <td style={{...tdS,textAlign:'center'}}><button onClick={e=>{e.stopPropagation();deleteComp(c.id)}} style={{background:'none',border:'none',color:B.gray40,cursor:'pointer',fontSize:13,padding:'2px 4px',borderRadius:3}} onMouseEnter={e=>{e.currentTarget.style.color=B.red;e.currentTarget.style.background=B.redLight}} onMouseLeave={e=>{e.currentTarget.style.color=B.gray40;e.currentTarget.style.background='none'}}>&#128465;</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
