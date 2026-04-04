import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Fetch all deals
  const { data: deals, error } = await supabase.from('deals').select('*')
  if (error) return res.status(500).json({ error: error.message })

  // Build summary
  const byStatus = {}
  const byMarket = {}
  let totalPipelineValue = 0

  deals.forEach(d => {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1
    byMarket[d.market] = (byMarket[d.market] || 0) + 1
    if (d.asking_price && !['dead', 'owned'].includes(d.status)) {
      totalPipelineValue += Number(d.asking_price)
    }
  })

  // Active deals (not dead, not canvass new_leads)
  const activePipeline = deals.filter(d =>
    !['dead', 'owned'].includes(d.status) &&
    !(d.status === 'tracked' && d.source === 'master_property')
  )

  // Recently updated
  const recentlyUpdated = deals
    .filter(d => d.updated_at)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 10)
    .map(d => ({ id: d.id, address: d.address, city: d.city, market: d.market, status: d.status, updated_at: d.updated_at }))

  // Deals needing attention (pursuit or LOI with no recent update)
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const stale = deals
    .filter(d => ['pursuit', 'loi_sent', 'under_contract'].includes(d.status))
    .filter(d => !d.updated_at || new Date(d.updated_at) < sevenDaysAgo)
    .map(d => ({ id: d.id, address: d.address, market: d.market, status: d.status, updated_at: d.updated_at }))

  // Fetch new alerts count
  const { count: newAlerts } = await supabase.from('deal_alerts').select('*', { count: 'exact', head: true }).eq('status', 'new')

  return res.status(200).json({
    summary: {
      total_deals: deals.length,
      active_pipeline: activePipeline.length,
      pipeline_value: totalPipelineValue,
      new_alerts: newAlerts || 0,
      by_status: byStatus,
      by_market: byMarket,
    },
    recently_updated: recentlyUpdated,
    stale_deals: stale,
    generated_at: new Date().toISOString(),
  })
}
