import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

const EXTRACT_PROMPT = `Extract contact information from this content. Return ONLY a JSON array of contacts. Each contact object should have these exact keys (use null for missing fields):
{
  "name": "Full name",
  "category": "one of: Investor, Broker, Lender, Seller, Partner, Mentor, Contact, Golf, Other",
  "company": "company name",
  "title": "job title",
  "phone": "phone number",
  "email": "email address",
  "city": "city, state",
  "notes": "any other info"
}
Return ONLY the JSON array, no other text. If there is only one contact, still return an array with one object.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { type, data, filename } = req.body
  // type: 'csv', 'json', 'image', 'pdf'
  // data: base64 for image/pdf, or raw text for csv, or JSON array for json

  try {
    let contacts = []

    if (type === 'json') {
      // Direct JSON array of contacts (from CSV/Excel parsed client-side)
      contacts = Array.isArray(data) ? data : JSON.parse(data)

    } else if (type === 'csv') {
      // Raw CSV text - parse it
      const lines = data.split('\n').filter(l => l.trim())
      if (lines.length < 2) return res.status(400).json({ error: 'CSV needs a header row and at least one data row' })
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
        const row = {}
        headers.forEach((h, j) => { row[h] = vals[j] || null })
        contacts.push({
          name: row.name || row['full name'] || row['first name'] ? `${row['first name'] || ''} ${row['last name'] || ''}`.trim() : null,
          email: row.email || row['email address'] || null,
          phone: row.phone || row['phone number'] || row.mobile || null,
          company: row.company || row.organization || row.firm || null,
          title: row.title || row['job title'] || row.role || null,
          city: row.city || row.location || null,
          category: row.category || row.type || 'Contact',
          notes: row.notes || row.note || null,
        })
      }

    } else if (type === 'image') {
      // Business card photo - send to Claude Vision
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
              { type: 'text', text: 'This is a business card. ' + EXTRACT_PROMPT },
            ],
          }],
        }),
      })
      const result = await response.json()
      const text = (result.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) contacts = JSON.parse(jsonMatch[0])
      else return res.status(422).json({ error: 'Could not read business card', raw: text })

    } else if (type === 'pdf') {
      // PDF contact list - send to Claude
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
              { type: 'text', text: EXTRACT_PROMPT },
            ],
          }],
        }),
      })
      const result = await response.json()
      const text = (result.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) contacts = JSON.parse(jsonMatch[0])
      else return res.status(422).json({ error: 'Could not extract contacts from PDF', raw: text })
    }

    // Filter out contacts without a name
    contacts = contacts.filter(c => c && c.name && c.name.trim())

    if (contacts.length === 0) return res.status(400).json({ error: 'No contacts found in the uploaded data' })

    // Dedup by email - fetch existing emails
    const existingEmails = new Set()
    const { data: existing } = await supabase.from('contacts').select('email').not('email', 'is', null)
    if (existing) existing.forEach(e => { if (e.email) existingEmails.add(e.email.toLowerCase().trim()) })

    const newContacts = []
    const skipped = []

    for (const c of contacts) {
      const email = (c.email || '').toLowerCase().trim()
      if (email && existingEmails.has(email)) {
        skipped.push({ name: c.name, email, reason: 'duplicate email' })
        continue
      }

      // Map category
      const cat = mapCategory(c.category)

      const record = {
        name: c.name.trim(),
        category: cat,
        company: c.company || null,
        title: c.title || null,
        phone: c.phone || null,
        email: c.email || null,
        city: c.city || null,
        notes: c.notes || null,
      }

      const { data: inserted, error } = await supabase.from('contacts').insert(record).select()
      if (!error && inserted) {
        newContacts.push(inserted[0])
        if (email) existingEmails.add(email)
      }
    }

    return res.status(201).json({
      imported: newContacts.length,
      skipped: skipped.length,
      total_processed: contacts.length,
      new_contacts: newContacts,
      skipped_contacts: skipped,
    })

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

function mapCategory(raw) {
  if (!raw) return 'Contact'
  const c = raw.toLowerCase().trim()
  const map = {
    'investor': 'Investor', 'i': 'Investor',
    'broker': 'Broker', 'b': 'Broker', 'agent': 'Broker',
    'lender': 'Lender', 'l': 'Lender', 'bank': 'Lender', 'banker': 'Lender',
    'seller': 'Seller', 's': 'Seller',
    'partner': 'Partner', 'p': 'Partner',
    'mentor': 'Mentor', 'm': 'Mentor',
    'golf': 'Golf', 'g': 'Golf',
    'contact': 'Contact', 'c': 'Contact',
  }
  return map[c] || 'Contact'
}
