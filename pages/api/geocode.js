import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Market coords fallback
const MC = {
  'Laredo TX': [27.5,-99.5], 'McAllen TX': [26.2,-98.2], 'Brownsville TX': [25.9,-97.5],
  'El Paso TX': [31.8,-106.4], 'Nogales AZ': [31.34,-110.94], 'Phoenix AZ': [33.45,-112.07],
  'Louisville KY': [38.25,-85.76], 'Lumberton NC': [34.62,-79.0],
  'Aberdeen NC': [35.13,-79.43], 'Moore County NC': [35.3,-79.5], 'Wilmington NC': [34.24,-77.95],
  'Spokane WA': [47.66,-117.43], 'Milwaukee WI': [43.04,-87.91], 'Conway SC': [33.84,-79.05],
  'Myrtle Beach SC': [33.69,-78.89], 'Greenville SC': [34.85,-82.39],
  'Lynchburg VA': [37.41,-79.14], 'Gainesville FL': [29.65,-82.32], 'Evansville IN': [37.97,-87.56],
  'Ann Arbor MI': [42.28,-83.74], 'Chicago IL': [41.88,-87.63],
  'Pensacola FL': [30.44,-87.22], 'Gulfport MS': [30.37,-89.09],
  'Baltimore MD': [39.29,-76.61], 'Kansas City KS': [39.11,-94.63],
  'Columbus OH': [39.96,-82.99], 'Hammond LA': [30.50,-90.46],
  'Kalispell MT': [48.20,-114.31], 'Pell City AL': [33.59,-86.29],
  'Tucson AZ': [32.22,-110.97], 'Toledo OH': [41.66,-83.56],
  'Youngstown OH': [41.10,-80.65], 'Winston-Salem NC': [36.10,-80.24],
}

// US Census Geocoder — free, no API key, accurate for US addresses
async function censusgeocode(address, city, state) {
  try {
    const street = encodeURIComponent(address)
    const c = encodeURIComponent(city)
    const s = encodeURIComponent(state || '')
    const url = `https://geocoding.geo.census.gov/geocoder/locations/address?street=${street}&city=${c}&state=${s}&benchmark=Public_AR_Current&format=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    const matches = data?.result?.addressMatches
    if (matches && matches.length > 0) {
      const coords = matches[0].coordinates
      return { lat: coords.y, lon: coords.x, source: 'census' }
    }
  } catch (e) { /* census geocoder failed */ }
  return null
}

// Nominatim fallback
async function nominatimGeocode(address, city, state) {
  try {
    const query = `${address}, ${city}${state ? ', ' + state : ''}, USA`
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`, {
      headers: { 'User-Agent': 'DuffieldDashboard/1.0' },
      signal: AbortSignal.timeout(5000)
    })
    const data = await res.json()
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), source: 'nominatim' }
    }
  } catch (e) { /* nominatim failed */ }
  return null
}

export default async function handler(req, res) {
  const mode = req.query?.mode || 'smart' // smart, fallback
  const limit = Math.min(parseInt(req.query?.limit) || 25, 200)
  
  const { data: deals } = await supabase.from('deals').select('id, address, city, state, market')
    .or('latitude.is.null,latitude.eq.0').not('address', 'is', null).not('city', 'is', null).limit(limit)

  if (!deals || deals.length === 0) {
    const { count: remaining } = await supabase.from('deals').select('*', { count: 'exact', head: true })
      .or('latitude.is.null,latitude.eq.0').not('address', 'is', null)
    return res.status(200).json({ message: 'All done', remaining: remaining || 0 })
  }

  const results = []
  for (const deal of deals) {
    if (mode === 'fallback') {
      // Instant market-coords fallback
      const mc = MC[deal.market]
      if (mc) {
        const jlat = mc[0] + (Math.random() - 0.5) * 0.04
        const jlon = mc[1] + (Math.random() - 0.5) * 0.04
        await supabase.from('deals').update({ latitude: jlat, longitude: jlon }).eq('id', deal.id)
        results.push({ id: deal.id, status: 'market_fallback' })
      } else {
        await supabase.from('deals').update({ latitude: 0.0001, longitude: 0.0001 }).eq('id', deal.id)
        results.push({ id: deal.id, status: 'no_coords' })
      }
      continue
    }

    // Smart mode: Census first → Nominatim → market fallback
    let geo = await censusgeocode(deal.address, deal.city, deal.state)
    if (!geo) {
      geo = await nominatimGeocode(deal.address, deal.city, deal.state)
      if (geo) await sleep(1100) // Rate limit Nominatim
    }

    if (geo) {
      await supabase.from('deals').update({ latitude: geo.lat, longitude: geo.lon }).eq('id', deal.id)
      results.push({ id: deal.id, status: geo.source })
    } else {
      // Market coords fallback
      const mc = MC[deal.market]
      if (mc) {
        const jlat = mc[0] + (Math.random() - 0.5) * 0.04
        const jlon = mc[1] + (Math.random() - 0.5) * 0.04
        await supabase.from('deals').update({ latitude: jlat, longitude: jlon }).eq('id', deal.id)
        results.push({ id: deal.id, status: 'market_fallback' })
      } else {
        await supabase.from('deals').update({ latitude: 0.0001, longitude: 0.0001 }).eq('id', deal.id)
        results.push({ id: deal.id, status: 'no_coords' })
      }
    }
  }

  const { count: remaining } = await supabase.from('deals').select('*', { count: 'exact', head: true })
    .or('latitude.is.null,latitude.eq.0').not('address', 'is', null)

  const census = results.filter(r => r.status === 'census').length
  const nominatim = results.filter(r => r.status === 'nominatim').length
  const fallback = results.filter(r => r.status === 'market_fallback').length
  return res.status(200).json({ processed: results.length, census, nominatim, fallback, remaining: remaining || 0 })
}
