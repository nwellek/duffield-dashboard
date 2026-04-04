import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // GET — fetch activity for a deal
  if (req.method === 'GET') {
    const { deal_id } = req.query
    if (!deal_id) return res.status(400).json({ error: 'deal_id required' })
    const { data, error } = await supabase.from('deal_activity').select('*').eq('deal_id', deal_id).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ activity: data })
  }

  // POST — bot logs activity on a deal
  if (req.method === 'POST') {
    const { deal_id, type, content, created_by } = req.body
    if (!deal_id || !content) return res.status(400).json({ error: 'deal_id and content required' })
    const { data, error } = await supabase.from('deal_activity').insert({
      deal_id,
      type: type || 'note',
      content,
      created_by: created_by || 'Bot',
    }).select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ activity: data[0] })
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed' })
}
