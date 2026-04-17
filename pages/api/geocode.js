import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Same market coords as brand.js — used as instant fallback
const MARKET_COORDS = {
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

async function geocodeAddress(address, city, state) {
  try {
    const structUrl = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state || '')}&country=US&format=json&limit=1`
    const res1 = await fetch(structUrl, { headers: { 'User-Agent': 'DuffieldDashboard/1.0' } })
    const data1 = await res1.json()
    if (data1 && data1.length > 0) {
      return { lat: parseFloat(data1[0].lat), lon: parseFloat(data1[0].lon), exact: true }
    }
    const query = `${address}, ${city}${state ? ', ' + state : ''}, USA`
    const res2 = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`, { headers: { 'User-Agent': 'DuffieldDashboard/1.0' } })
    const data2 = await res2.json()
    if (data2 && data2.length > 0) {
      return { lat: parseFloat(data2[0].lat), lon: parseFloat(data2[0].lon), exact: true }
    }
  } catch (e) { /* geocode failed */ }
  return null
}

export default async function handler(req, res) {
  const mode = req.query?.mode || 'smart' // 'smart' = try Nominatim then fallback, 'fallback' = market coords only
  const limit = Math.min(parseInt(req.query?.limit) || 25, 200)
  
  // Get deals needing geocoding — exclude ones we already failed (marked with lat=0.0001)
  const { data: deals } = await supabase.from('deals').select('id, address, city, state, market')
    .or('latitude.is.null,latitude.eq.0').not('address', 'is', null).not('city', 'is', null).limit(limit)

  if (!deals || deals.length === 0) {
    const { count: remaining } = await supabase.from('deals').select('*', { count: 'exact', head: true })
      .or('latitude.is.null,latitude.eq.0').not('address', 'is', null)
    return res.status(200).json({ message: 'All done', remaining: remaining || 0 })
  }

  const results = []
  for (const deal of deals) {
    let geo = null

    // Try Nominatim if in smart mode
    if (mode === 'smart') {
      geo = await geocodeAddress(deal.address, deal.city, deal.state)
      if (geo) {
        await supabase.from('deals').update({ latitude: geo.lat, longitude: geo.lon }).eq('id', deal.id)
        results.push({ id: deal.id, status: 'exact' })
        await sleep(1100) // Rate limit
        continue
      }
    }

    // Fallback: use market coords with small jitter
    const mc = MARKET_COORDS[deal.market]
    if (mc) {
      const jlat = mc[0] + (Math.random() - 0.5) * 0.04
      const jlon = mc[1] + (Math.random() - 0.5) * 0.04
      await supabase.from('deals').update({ latitude: jlat, longitude: jlon }).eq('id', deal.id)
      results.push({ id: deal.id, status: 'market_fallback' })
    } else {
      // No market coords either — mark with 0.0001 so we don't retry
      await supabase.from('deals').update({ latitude: 0.0001, longitude: 0.0001 }).eq('id', deal.id)
      results.push({ id: deal.id, status: 'no_coords' })
    }

    if (mode === 'smart') await sleep(1100)
  }

  const { count: remaining } = await supabase.from('deals').select('*', { count: 'exact', head: true })
    .or('latitude.is.null,latitude.eq.0').not('address', 'is', null)

  const exact = results.filter(r => r.status === 'exact').length
  const fallback = results.filter(r => r.status === 'market_fallback').length
  return res.status(200).json({ processed: results.length, exact, fallback, remaining: remaining || 0 })
}
