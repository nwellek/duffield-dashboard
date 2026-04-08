import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // GET — fetch all deals (for daily briefing, pipeline status)
  if (req.method === 'GET') {
    const { status, market } = req.query
    let query = supabase.from('deals').select('*').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (market) query = query.eq('market', market)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ deals: data })
  }

  // POST — bot can create a new deal
  if (req.method === 'POST') {
    const { data, error } = await supabase.from('deals').insert(req.body).select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ deal: data[0] })
  }

  // PATCH — bot can update a deal status
  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    updates.updated_at = new Date().toISOString()
    const { data, error } = await supabase.from('deals').update(updates).eq('id', id).select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ deal: data[0] })
  }

  res.setHeader('Allow', 'GET, POST, PATCH')
  res.status(405).json({ error: 'Method not allowed' })
}
