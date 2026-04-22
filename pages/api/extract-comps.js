export const config = { api: { bodyParser: { sizeLimit: '10mb' }, maxDuration: 60 } }

const EXTRACT_PROMPT = `You are a commercial real estate data extraction tool. Extract EVERY property listed in this document into a JSON array.

This may be a CoStar report, broker OM, market survey, or property listing. Extract ALL properties — there could be 1 to 100+.

For EACH property, return an object with these exact fields:
- "address": street address only (no city/state)
- "city": city name
- "state": 2-letter state code
- "comp_type": exactly one of "sale", "lease", or "land"
  - If the document shows asking rent / rent PSF / lease terms = "lease"
  - If the document shows sale price / cap rate / buyer = "sale"
  - If primarily vacant land with acreage = "land"
- "building_sf": total building square footage as a number (use RBA, not available SF)
- "lot_acres": land area in acres as a number (convert "2.14 AC (93,218 SF)" to 2.14)
- "year_built": 4-digit year as number (for "1965/2011" use 1965)
- "clear_height": warehouse clear height in feet as a number (convert 24'8" to 24.67)
- "price": asking price or sale price as a number (no $). For "$1,295,000" use 1295000
- "price_per_sf": price per square foot as a number
- "rent_psf": annual asking rent per SF as a number (if "$4.50 SF/Year/NNN" use 4.50)
- "cap_rate": cap rate as a number (7.5 not 0.075)
- "buyer": buyer name or null
- "seller": owner/seller name — use "True Owner" field, or "Recorded Owner" if no True Owner
- "notes": combine: property type (Warehouse, Distribution, Manufacturing), zoning, tenant names, drive-ins count, key details
- "comp_date": date as YYYY-MM-DD or null

RULES:
- "Withheld", "Not For Sale", "Not Disclosed", "Negotiable", "Price Not Disclosed" = use null
- Use TOTAL building SF (RBA), NOT available/vacant SF
- Extract owner from "True Owner" or "Recorded Owner" in the Contacts section
- Do NOT skip any properties
- Return ONLY the JSON array, no markdown, no explanation`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pdf_base64, pdf_text } = req.body
  if (!pdf_base64 && !pdf_text) return res.status(400).json({ error: 'Missing pdf_base64 or pdf_text' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  try {
    var messages
    if (pdf_base64) {
      // Send PDF as document (best quality)
      messages = [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } },
        { type: 'text', text: EXTRACT_PROMPT }
      ]}]
    } else {
      // Send extracted text (fallback for large PDFs)
      messages = [{ role: 'user', content: EXTRACT_PROMPT + '\n\nDOCUMENT TEXT:\n' + pdf_text }]
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8000, messages })
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('Anthropic API error:', resp.status, errText)
      return res.status(resp.status).json({ error: 'Anthropic API error: ' + resp.status, details: errText.substring(0, 500) })
    }

    const data = await resp.json()
    const text = (data.content || []).map(c => c.text || '').join('')

    let jsonStr = text
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced) jsonStr = fenced[1]
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return res.status(422).json({ error: 'No JSON array found in AI response', raw: text.substring(0, 500) })
    }

    const extracted = JSON.parse(jsonMatch[0])
    return res.status(200).json({ comps: extracted, count: extracted.length })

  } catch (e) {
    console.error('Extract comps error:', e)
    return res.status(500).json({ error: e.message })
  }
}
