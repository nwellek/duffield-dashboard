import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, COLUMNS, MARKET_COORDS, scoreDeal, gradeColor, fmt, Badge } from '../lib/brand'

let L = null
if (typeof window !== 'undefined') { L = require('leaflet') }

const SC = {}
COLUMNS.forEach(c => { SC[c.id] = c.color })

export default function MapView({ deals, onClickDeal }) {
  const mapRef = useRef(null)
  const map = useRef(null)
  const markers = useRef(null)
  const [selDeal, setSelDeal] = useState(null)
  const [selMarket, setSelMarket] = useState(null)
  const [ready, setReady] = useState(false)
  const [style, setStyle] = useState('satellite')
  const [geocoding, setGeocoding] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')
  const [activities, setActivities] = useState([])
  const [newNote, setNewNote] = useState('')

  const mc = {}
  deals.forEach(d => { mc[d.market || 'Other'] = (mc[d.market || 'Other'] || 0) + 1 })
  const geocoded = deals.filter(d => d.latitude && d.longitude && d.latitude !== 0).length
  const ungeocoded = deals.filter(d => !d.latitude && d.address && d.city).length

  const fetchAct = useCallback(async (id) => {
    if (!id) return
    const { data } = await supabase.from('deal_activity').select('*').eq('deal_id', id).order('created_at', { ascending: false }).limit(10)
    if (data) setActivities(data)
  }, [])

  const addNote = async () => {
    if (!newNote.trim() || !selDeal?.id) return
    await supabase.from('deal_activity').insert({ deal_id: selDeal.id, type: 'note', content: newNote.trim() })
    setNewNote('')
    fetchAct(selDeal.id)
  }

  // Init map
  useEffect(() => {
    if (!L || !mapRef.current || map.current) return
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    })
    const m = L.map(mapRef.current, { center: [33, -98], zoom: 5, scrollWheelZoom: true })
    map.current = m
    markers.current = L.layerGroup().addTo(m)
    setReady(true)
    return () => { m.remove(); map.current = null }
  }, [])

  // Apply tiles
  useEffect(() => {
    if (!map.current || !L) return
    map.current.eachLayer(l => { if (l instanceof L.TileLayer) map.current.removeLayer(l) })
    if (style === 'hybrid') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map.current)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { maxZoom: 19, opacity: 0.9 }).addTo(map.current)
    } else if (style === 'satellite') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map.current)
    } else {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map.current)
    }
  }, [style])

  // Markers
  useEffect(() => {
    if (!ready || !markers.current || !L) return
    markers.current.clearLayers()
    const show = selMarket ? deals.filter(d => d.market === selMarket) : deals

    show.forEach(d => {
      let lat, lon, exact = false
      if (d.latitude && d.longitude && d.latitude !== 0 && d.longitude !== 0) {
        lat = d.latitude; lon = d.longitude; exact = true
      } else {
        const co = MARKET_COORDS[d.market]
        if (!co) return
        lat = co[0] + (Math.random() - 0.5) * 0.02
        lon = co[1] + (Math.random() - 0.5) * 0.02
      }

      const color = SC[d.status] || B.gray
      const sz = exact ? 16 : 10
      const op = exact ? 1 : 0.4

      const icon = L.divIcon({
        className: '',
        html: '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + color + ';border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.6);opacity:' + op + ';"></div>',
        iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
      })

      const mk = L.marker([lat, lon], { icon })
      mk.on('click', () => { setSelDeal(d); fetchAct(d.id) })
      markers.current.addLayer(mk)
    })

    if (!selMarket) {
      Object.entries(MARKET_COORDS).forEach(([mkt, [mlat, mlon]]) => {
        const n = mc[mkt] || 0
        if (n === 0) return
        const c = L.circleMarker([mlat, mlon], {
          radius: Math.min(6 + Math.sqrt(n) * 1.5, 28),
          fillColor: 'white', fillOpacity: 0.7, color: B.blue, weight: 2,
        })
        c.bindTooltip('<b>' + mkt + '</b>: ' + n + ' deals', { direction: 'top', className: '' })
        c.on('click', () => { setSelMarket(mkt); map.current.setView([mlat, mlon], 13, { animate: true }) })
        markers.current.addLayer(c)
      })
    }
  }, [ready, deals, selMarket, mc, fetchAct])

  const reset = () => { setSelMarket(null); setSelDeal(null); map.current?.setView([33, -98], 5, { animate: true }) }

  // Auto-geocode loop
  const runGeocode = async () => {
    setGeocoding(true)
    let total = 0
    for (let i = 0; i < 4; i++) {
      setGeoMsg('Batch ' + (i + 1) + '/4...')
      try {
        const res = await fetch('/api/geocode?limit=25')
        const data = await res.json()
        total += data.found || 0
        if (data.remaining === 0) { setGeoMsg('Done! ' + total + ' addresses geocoded.'); break }
        setGeoMsg(total + ' geocoded, ' + data.remaining + ' remaining...')
      } catch (e) { setGeoMsg('Error: ' + e.message); break }
    }
    if (!geoMsg.includes('Done')) setGeoMsg(total + ' geocoded this round. Click again for more.')
    setGeocoding(false)
  }

  const col = selDeal ? COLUMNS.find(c => c.id === selDeal.status) : null
  const ds = selDeal ? scoreDeal(selDeal) : null
  const g = ds ? gradeColor(ds.grade) : null

  return (
    <div>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={reset} style={{ padding: '4px 10px', background: B.white, border: '1px solid ' + B.gray20, borderRadius: 3, fontSize: 11, fontFamily: hf, color: B.blue, fontWeight: 600, cursor: 'pointer' }}>Reset</button>
        {['hybrid', 'satellite', 'street'].map(s => (
          <button key={s} onClick={() => setStyle(s)} style={{ padding: '3px 8px', borderRadius: 3, fontSize: 10, fontFamily: hf, border: '1px solid ' + (style === s ? B.blue : B.gray20), background: style === s ? B.blue : 'transparent', color: style === s ? B.white : B.gray, cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
        ))}
        <button onClick={runGeocode} disabled={geocoding || ungeocoded === 0} style={{ padding: '4px 10px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 11, fontFamily: hf, fontWeight: 600, cursor: 'pointer', opacity: geocoding || ungeocoded === 0 ? 0.5 : 1, marginLeft: 6 }}>
          {geocoding ? 'Working...' : 'Geocode ' + ungeocoded}
        </button>
        {geoMsg && <span style={{ fontSize: 10, color: B.gray, fontFamily: bf }}>{geoMsg}</span>}
        {selMarket && <span style={{ fontSize: 12, color: B.blue, fontFamily: hf, fontWeight: 700, marginLeft: 6 }}>{selMarket} <button onClick={() => { setSelMarket(null); map.current?.setView([33, -98], 5) }} style={{ background: 'none', border: 'none', color: B.gray, cursor: 'pointer', fontSize: 13 }}>x</button></span>}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: B.gray60, fontFamily: bf }}>{geocoded} exact / {deals.length} total</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
        {Object.entries(mc).sort((a, b) => b[1] - a[1]).map(([m, n]) => {
          const co = MARKET_COORDS[m]; if (!co) return null
          return <button key={m} onClick={() => { setSelMarket(selMarket === m ? null : m); if (selMarket !== m) map.current?.setView(co, 13, { animate: true }); else map.current?.setView([33, -98], 5) }} style={{ padding: '2px 7px', borderRadius: 3, fontSize: 9, fontFamily: hf, border: '1px solid ' + (selMarket === m ? B.blue : B.gray20), background: selMarket === m ? B.blue05 : B.white, color: selMarket === m ? B.blue : B.gray, cursor: 'pointer', fontWeight: selMarket === m ? 700 : 400 }}>{m} ({n})</button>
        })}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div ref={mapRef} style={{ width: '100%', height: 550, borderRadius: 4, border: '1px solid ' + B.gray20 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {COLUMNS.map(c => { const n = deals.filter(d => d.status === c.id).length; if (!n) return null; return <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: B.gray, fontFamily: bf }}><div style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />{c.label} ({n})</div> })}
            <span style={{ fontSize: 10, color: B.gray60, fontFamily: bf, marginLeft: 'auto' }}>Click dot to view. Click market circle to zoom.</span>
          </div>
        </div>

        {selDeal && (
          <div style={{ width: 300, flexShrink: 0, maxHeight: 590, overflowY: 'auto', background: B.white, borderRadius: 4, border: '1px solid ' + B.gray20, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: B.black, fontFamily: hf }}>{selDeal.address}</div>
              <button onClick={() => setSelDeal(null)} style={{ background: 'none', border: 'none', color: B.gray, cursor: 'pointer', fontSize: 15 }}>x</button>
            </div>
            <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 6 }}>{selDeal.city}{selDeal.state ? ', ' + selDeal.state : ''} &mdash; {selDeal.market}</div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {col && <Badge bg={col.color + '18'} color={col.color}>{col.label}</Badge>}
              {g && <Badge bg={g.bg} color={g.tx} border={g.bd}>{ds.grade}&middot;{ds.total}</Badge>}
            </div>

            <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 8 }}>
              {selDeal.property_type && <div style={{ marginBottom: 1 }}><span style={{ color: B.gray }}>Type:</span> {selDeal.property_type}</div>}
              {selDeal.lot_acres && <div style={{ marginBottom: 1 }}><span style={{ color: B.gray }}>Acres:</span> {selDeal.lot_acres}</div>}
              {selDeal.building_sf && <div style={{ marginBottom: 1 }}><span style={{ color: B.gray }}>SF:</span> {Number(selDeal.building_sf).toLocaleString()}</div>}
              {selDeal.asking_price && <div style={{ marginBottom: 1 }}><span style={{ color: B.gray }}>Price:</span> <b>{fmt(selDeal.asking_price)}</b></div>}
              {selDeal.cap_rate && <div style={{ marginBottom: 1 }}><span style={{ color: B.gray }}>Cap:</span> {selDeal.cap_rate}%</div>}
              {selDeal.parcel_number && <div style={{ marginBottom: 1 }}><span style={{ color: B.gray }}>Parcel:</span> {selDeal.parcel_number}</div>}
            </div>

            {selDeal.owner && (
              <div style={{ background: B.blue05, borderRadius: 3, padding: '6px 8px', border: '1px solid ' + B.blue20, marginBottom: 8, fontSize: 11, fontFamily: bf }}>
                <div style={{ fontWeight: 600, color: B.black }}>{selDeal.owner}</div>
                {selDeal.owner_phone && <a href={'tel:' + selDeal.owner_phone} style={{ color: B.blue, textDecoration: 'none', display: 'block' }}>{selDeal.owner_phone}</a>}
                {selDeal.owner_email && <a href={'mailto:' + selDeal.owner_email} style={{ color: B.blue, textDecoration: 'none', display: 'block' }}>{selDeal.owner_email}</a>}
              </div>
            )}

            {selDeal.notes && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, padding: '5px 7px', background: B.gray10, borderRadius: 3, marginBottom: 8, lineHeight: 1.4 }}>{selDeal.notes.slice(0, 300)}{selDeal.notes.length > 300 ? '...' : ''}</div>}

            <button onClick={() => onClickDeal && onClickDeal(selDeal)} style={{ width: '100%', padding: '7px 0', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: hf, marginBottom: 8 }}>Open full detail</button>

            <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>Add note</div>
            <textarea style={{ width: '100%', padding: '5px 7px', border: '1px solid ' + B.gray40, borderRadius: 3, fontSize: 11, fontFamily: bf, minHeight: 36, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} placeholder="Called owner..." value={newNote} onChange={e => setNewNote(e.target.value)} />
            <button onClick={addNote} disabled={!newNote.trim()} style={{ marginTop: 3, padding: '4px 10px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: newNote.trim() ? 1 : 0.4 }}>Save</button>

            {activities.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 3 }}>Activity</div>
                {activities.slice(0, 6).map(a => (
                  <div key={a.id} style={{ fontSize: 10, fontFamily: bf, padding: '2px 0', borderBottom: '1px solid ' + B.gray10 }}>
                    <span style={{ color: B.gray60 }}>{new Date(a.created_at).toLocaleDateString()}</span>
                    <span style={{ color: B.blue, fontWeight: 600, marginLeft: 4 }}>{a.type}</span>
                    <div style={{ color: B.black, marginTop: 1, fontSize: 11 }}>{a.content}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 8, fontSize: 9, color: B.gray60, fontFamily: bf }}>
              {selDeal.latitude && selDeal.latitude !== 0 ? 'Exact: ' + Number(selDeal.latitude).toFixed(4) + ', ' + Number(selDeal.longitude).toFixed(4) : 'Not geocoded yet'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
