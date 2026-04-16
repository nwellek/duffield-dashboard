export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

const PROMPT = `Read this commercial real estate document and extract key information. Return ONLY valid JSON with no markdown backticks:
{
  "doc_type": "one of: LOI, PSA, Lease, Loan, Insurance, Inspection, Appraisal, Survey, Title, Environmental, Tax, OM, Invoice, Legal, Other",
  "summary": "2-4 sentence summary of what this document is and its key terms",
  "extracted": {
    "parties": "names of parties involved",
    "effective_date": "date or null",
    "expiration_date": "date or null", 
    "amount": "dollar amount if applicable or null",
    "term": "lease/loan term if applicable or null",
    "key_terms": "important terms, conditions, or provisions",
    "property_address": "property address if mentioned or null",
    "status": "executed, draft, expired, or null"
  },
  "deal_fields": {
    "address": "property street address or null",
    "city": "city or null",
    "state": "2-letter state code or null",
    "asking_price": null,
    "building_sf": null,
    "lot_acres": null,
    "clear_height": null,
    "dock_doors": null,
    "zoning": "zoning code or null",
    "property_type": "one of: IOS (outdoor storage), Small bay industrial, Warehouse/distribution, Flex/light industrial, Truck terminal, Laydown yard, or null",
    "cap_rate": null,
    "owner": "property owner name or null",
    "contact_name": "broker or contact name or null",
    "contact_method": "broker email/phone or null",
    "notes_append": "any key info worth adding to deal notes, 1-2 sentences"
  }
}
For numeric fields, use numbers only (no $ or commas). For amounts, extract the purchase price, asking price, or offer amount. Extract ALL available property details.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  const { pdf_base64, filename, doc_id } = req.body
  if (!pdf_base64) return res.status(400).json({ error: 'No PDF provided' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250217',
        max_tokens: 2500,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } },
            { type: 'text', text: `Filename: ${filename || 'document.pdf'}\n\n${PROMPT}` },
          ],
        }],
      }),
    })

    const responseText = await response.text()
    if (!response.ok) return res.status(500).json({ error: 'API error (' + response.status + '): ' + responseText.slice(0, 500) })

    let data
    try { data = JSON.parse(responseText) } catch (e) { return res.status(500).json({ error: 'Non-JSON response: ' + responseText.slice(0, 300) }) }

    if (data.error) return res.status(500).json({ error: 'Anthropic error: ' + (data.error.message || JSON.stringify(data.error)) })

    const allText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
    const cleaned = allText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)

    if (!jsonMatch) return res.status(422).json({ error: 'Could not parse AI response', raw: allText.slice(0, 300) })

    const result = JSON.parse(jsonMatch[0])
    return res.status(200).json({
      summary: result.summary || '',
      extracted: result.extracted || {},
      doc_type: result.doc_type || 'Other',
      deal_fields: result.deal_fields || {},
    })
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + e.message })
  }
}
