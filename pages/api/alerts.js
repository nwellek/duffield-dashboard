import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // GET — fetch all alerts (for the bot to read status)
  if (req.method === 'GET') {
    const { status } = req.query
    let query = supabase.from('deal_alerts').select('*').order('created_at', { ascending: false }).limit(50)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ alerts: data })
  }

  // POST — bot sends new alerts from Crexi/LoopNet
  if (req.method === 'POST') {
    const { alerts } = req.body
    if (!alerts || !Array.isArray(alerts)) {
      return res.status(400).json({ error: 'Expected { alerts: [...] }' })
    }

    const results = []
    for (const alert of alerts) {
      const record = {
        source: alert.source || 'unknown',
        address: alert.address || null,
        city: alert.city || null,
        state: alert.state || null,
        market: alert.market || null,
        asking_price: alert.asking_price || null,
        building_sf: alert.building_sf || null,
        lot_acres: alert.lot_acres || null,
        price_per_sf: alert.price_per_sf || null,
        cap_rate: alert.cap_rate || null,
        url: alert.url || null,
        raw_data: alert.raw_data || null,
        status: 'new',
      }
      const { data, error } = await supabase.from('deal_alerts').insert(record).select()
      if (error) results.push({ error: error.message })
      else results.push({ id: data[0].id, address: record.address })
    }

    return res.status(201).json({ inserted: results.length, results })
  }

  // GET deals — for the bot to read the pipeline
  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed' })
}
