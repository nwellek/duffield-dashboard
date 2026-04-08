import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function geocodeAddress(address, city, state) {
  try {
    // Try structured query first for best accuracy
    const structUrl = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state || '')}&country=US&format=json&limit=1&addressdetails=1`
    const res1 = await fetch(structUrl, { headers: { 'User-Agent': 'DuffieldDashboard/1.0' } })
    const data1 = await res1.json()
    if (data1 && data1.length > 0) {
      return { lat: parseFloat(data1[0].lat), lon: parseFloat(data1[0].lon) }
    }
    // Fallback to free text query
    const query = `${address}, ${city}${state ? ', ' + state : ''}, USA`
    const res2 = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`, { headers: { 'User-Agent': 'DuffieldDashboard/1.0' } })
    const data2 = await res2.json()
    if (data2 && data2.length > 0) {
      return { lat: parseFloat(data2[0].lat), lon: parseFloat(data2[0].lon) }
    }
    // Last fallback — city level
    const res3 = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state || '')}&country=US&format=json&limit=1`, { headers: { 'User-Agent': 'DuffieldDashboard/1.0' } })
    const data3 = await res3.json()
    if (data3 && data3.length > 0) {
      return { lat: parseFloat(data3[0].lat), lon: parseFloat(data3[0].lon) }
    }
  } catch (e) { console.error('Geocode error:', e.message) }
  return null
}

export default async function handler(req, res) {
  // GET — batch geocode up to 25 deals
  const limit = Math.min(parseInt(req.query?.limit) || 25, 50)
  
  const { data: deals } = await supabase.from('deals').select('id, address, city, state')
    .or('latitude.is.null,latitude.eq.0').not('address', 'is', null).not('city', 'is', null).limit(limit)

  if (!deals || deals.length === 0) {
    const { count } = await supabase.from('deals').select('*', { count: 'exact', head: true })
    const { count: geocoded } = await supabase.from('deals').select('*', { count: 'exact', head: true }).not('latitude', 'is', null)
    return res.status(200).json({ message: 'All done', geocoded: geocoded || 0, total: count || 0, remaining: 0 })
  }

  const results = []
  for (const deal of deals) {
    const geo = await geocodeAddress(deal.address, deal.city, deal.state)
    if (geo) {
      await supabase.from('deals').update({ latitude: geo.lat, longitude: geo.lon }).eq('id', deal.id)
      results.push({ id: deal.id, address: deal.address, status: 'ok' })
    } else {
      results.push({ id: deal.id, address: deal.address, status: 'not_found' })
    }
    await sleep(1100)
  }

  const { count: remaining } = await supabase.from('deals').select('*', { count: 'exact', head: true }).is('latitude', null).not('address', 'is', null)

  return res.status(200).json({ processed: results.length, found: results.filter(r => r.status === 'ok').length, remaining: remaining || 0, results })
}
