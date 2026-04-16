import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

const PROMPT = `Extract deal info from this commercial real estate listing or offering memorandum. Return ONLY a valid JSON object with no markdown backticks. Use null for any field you cannot find.

{"address":"street address","city":"city name","state":"2-letter state code","asking_price":number_or_null,"building_sf":number_or_null,"lot_acres":number_or_null,"property_type":"one of: IOS (outdoor storage), Small bay industrial, Warehouse/distribution, Flex/light industrial, Truck terminal, Laydown yard","cap_rate":number_or_null,"year_built":number_or_null,"clear_height":number_or_null,"dock_doors":number_or_null,"price_per_sf":number_or_null,"zoning":"zoning code or null","owner":"owner or seller name or null","contact_name":"broker or contact name or null","contact_method":"broker email or phone or null","notes":"2-3 sentence deal summary"}`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set. Add it in Vercel Environment Variables.' })

  const { url, pdf_base64, pdf_name } = req.body
  if (!url && !pdf_base64) return res.status(400).json({ error: 'Provide url or pdf_base64' })

  try {
    let requestBody = { model: 'claude-sonnet-4-5-20241022', max_tokens: 2000 }

    if (url) {
      requestBody.messages = [{ role: 'user', content: `Extract deal data from this listing URL: ${url}\n\n${PROMPT}` }]
      requestBody.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
    } else {
      requestBody.messages = [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } },
          { type: 'text', text: PROMPT },
        ],
      }]
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    })

    // Read response as text first to handle non-JSON errors
    const responseText = await response.text()
    
    if (!response.ok) {
      return res.status(500).json({ error: 'Anthropic API error (HTTP ' + response.status + '): ' + responseText.slice(0, 300) })
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseErr) {
      return res.status(500).json({ error: 'API returned non-JSON: ' + responseText.slice(0, 300) })
    }

    // Check for API errors
    if (data.error) {
      return res.status(500).json({ error: 'Anthropic API error: ' + (data.error.message || JSON.stringify(data.error)) })
    }

    if (!data.content || data.content.length === 0) {
      return res.status(422).json({ error: 'Empty response from API', debug: JSON.stringify(data).slice(0, 500) })
    }

    // Extract text from all content blocks
    const allText = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n')

    if (!allText) {
      return res.status(422).json({ error: 'No text in API response', debug: JSON.stringify(data.content.map(b => b.type)) })
    }

    // Parse JSON - try to find it in the response
    const cleaned = allText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      return res.status(422).json({ error: 'Could not find JSON in response', raw: allText.slice(0, 500) })
    }

    let extracted
    try {
      extracted = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      return res.status(422).json({ error: 'Invalid JSON: ' + parseErr.message, raw: jsonMatch[0].slice(0, 500) })
    }

    // Create the deal
    const market = mapMarket(extracted.city, extracted.state)
    const deal = {
      address: extracted.address,
      city: extracted.city,
      state: extracted.state,
      market,
      status: 'under_review',
      property_type: extracted.property_type || 'Small bay industrial',
      asking_price: extracted.asking_price,
      building_sf: extracted.building_sf,
      lot_acres: extracted.lot_acres,
      price_per_sf: extracted.price_per_sf,
      cap_rate: extracted.cap_rate,
      year_built: extracted.year_built,
      clear_height: extracted.clear_height,
      dock_doors: extracted.dock_doors,
      zoning: extracted.zoning,
      owner: extracted.owner,
      contact_name: extracted.contact_name,
      contact_method: extracted.contact_method,
      notes: extracted.notes,
      source: url ? 'url_import: ' + url : 'pdf_import: ' + (pdf_name || 'upload.pdf'),
    }

    // Remove null/undefined fields
    Object.keys(deal).forEach(k => { if (deal[k] === null || deal[k] === undefined || deal[k] === '') delete deal[k] })

    // Auto-calc price_per_sf
    if (deal.asking_price && deal.building_sf && !deal.price_per_sf) {
      deal.price_per_sf = Math.round((deal.asking_price / deal.building_sf) * 100) / 100
    }

    // Insert
    const { data: inserted, error: dbError } = await supabase.from('deals').insert(deal).select()
    if (dbError) return res.status(500).json({ error: 'Database error: ' + dbError.message })

    // Save OM PDF to Supabase Storage
    if (pdf_base64 && inserted && inserted[0]) {
      try {
        const dealId = inserted[0].id
        const fileName = `${dealId}/${pdf_name || 'om.pdf'}`
        const buffer = Buffer.from(pdf_base64, 'base64')
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('deal-oms')
          .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('deal-oms').getPublicUrl(fileName)
          await supabase.from('deals').update({
            om_url: urlData?.publicUrl || fileName,
            om_filename: pdf_name || 'om.pdf',
          }).eq('id', dealId)
          inserted[0].om_url = urlData?.publicUrl || fileName
          inserted[0].om_filename = pdf_name || 'om.pdf'
        }
      } catch (e) { /* OM save failed, non-critical */ }
    }

    // Geocode
    try {
      if (deal.address && deal.city) {
        const q = `${deal.address}, ${deal.city}, ${deal.state || ''}`
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`, {
          headers: { 'User-Agent': 'DuffieldDashboard/1.0' }
        })
        const geoData = await geoRes.json()
        if (geoData && geoData.length > 0) {
          await supabase.from('deals').update({
            latitude: parseFloat(geoData[0].lat),
            longitude: parseFloat(geoData[0].lon),
          }).eq('id', inserted[0].id)
          inserted[0].latitude = parseFloat(geoData[0].lat)
          inserted[0].longitude = parseFloat(geoData[0].lon)
        }
      }
    } catch (e) { /* geocode failed, non-critical */ }

    return res.status(201).json({ deal: inserted[0], extracted })

  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + e.message })
  }
}

function mapMarket(city, state) {
  const c = (city || '').toLowerCase()
  if (c.includes('laredo')) return 'Laredo TX'
  if (c.includes('brownsville')) return 'Brownsville TX'
  if (c.includes('mcallen') || c.includes('hidalgo')) return 'McAllen TX'
  if (c.includes('el paso')) return 'El Paso TX'
  if (c.includes('nogales') || c.includes('rio rico')) return 'Nogales AZ'
  if (c.includes('greenville') && (state || '').toUpperCase() === 'SC') return 'Greenville SC'
  if (c.includes('spartanburg') && (state || '').toUpperCase() === 'SC') return 'Greenville SC'
  if (c.includes('conway') && (state || '').toUpperCase() === 'SC') return 'Myrtle Beach SC'
  if (c.includes('myrtle beach')) return 'Myrtle Beach SC'
  if (c.includes('louisville')) return 'Louisville KY'
  if (c.includes('lumberton')) return 'Lumberton NC'
  if (c.includes('evansville')) return 'Evansville IN'
  if (c.includes('gainesville')) return 'Gainesville FL'
  if (c.includes('milwaukee') || c.includes('beloit')) return 'Milwaukee WI'
  if (c.includes('ann arbor')) return 'Ann Arbor MI'
  return city && state ? `${city} ${state}` : 'Other'
}
