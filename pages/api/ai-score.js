// AI Deal Scoring — calls Claude to evaluate and re-grade deal scores
// Supports: full deal re-score OR single category re-score

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const { deal, scores, category, scoringModel } = req.body
  if (!deal) return res.status(400).json({ error: 'No deal data provided' })

  // Build deal summary for Claude
  const sf = Number(deal.building_sf) || 0
  const acres = Number(deal.lot_acres) || 0
  const price = Number(deal.asking_price) || Number(deal.purchase_price) || 0
  const psf = sf > 0 && price > 0 ? (price / sf).toFixed(0) : 'unknown'

  const dealSummary = `
DEAL: ${deal.address || 'Unknown'}, ${deal.city || ''} ${deal.state || ''}
Market: ${deal.market || 'Unknown'}
Status: ${deal.status || 'tracked'}
Property type: ${deal.property_type || 'Unknown'}
Building SF: ${sf > 0 ? sf.toLocaleString() : 'Unknown'}
Lot acres: ${acres > 0 ? acres.toFixed(2) : 'Unknown'}
Asking price: ${price > 0 ? '$' + price.toLocaleString() : 'Unknown'}
Price/SF: ${psf !== 'unknown' ? '$' + psf : 'Unknown'}
Clear height: ${deal.clear_height ? deal.clear_height + ' ft' : 'Unknown'}
Dock doors: ${deal.dock_doors || 'Unknown'}
Distance to interstate: ${deal.distance_interstate ? deal.distance_interstate + ' mi' : 'Unknown'}
Cap rate: ${deal.cap_rate ? deal.cap_rate + '%' : 'Unknown'}
Year built: ${deal.year_built || 'Unknown'}
Source: ${deal.source || 'Unknown'}
Broker/Contact: ${deal.contact_name || 'Unknown'} (${deal.contact_method || ''})
Listing URL: ${deal.listing_url || 'None'}
Notes: ${deal.notes || 'None'}
`.trim()

  const currentScores = scores ? `
CURRENT AUTO-SCORES:
- Basis vs Market: ${scores.basis_discount || 0}/25
- Estimated YOC: ${scores.est_yoc || 0}/20 (${scores._yoc_pct || 0}% YOC)
- Clear Height: ${scores.clear_height || 0}/6
- Doors/Access: ${scores.access || 0}/5
- Size Fit: ${scores.size_fit || 0}/4
- Market Quality: ${scores.market || 0}/6
- Interstate: ${scores.interstate || 0}/5
- Tenant Demand: ${scores.demand || 0}/4
- Broker Edge: ${scores.broker || 0}/10
- Off-Market: ${scores.off_market || 0}/6
- Seller Motivation: ${scores.seller || 0}/4
`.trim() : ''

  // Category-specific or full re-score
  const isSingleCategory = category && category !== 'all'

  const systemPrompt = `You are Nate Wellek's AI deal analyst for Duffield Holdings, a commercial real estate investment firm focused on value-add industrial/warehouse properties in smaller MSAs (300K-1.5M pop). Deal size: $1-5M. Strategy: buy below replacement cost, NNN leases, creative financing.

SCORING MODEL v2.1 REFERENCE:
${scoringModel || 'Standard model — 100 total points across Economics (45), Physical (15), Market (15), Deal Edge (25), with penalties.'}

GRADE SCALE:
A+ = 85-100 (Strong buy), A = 75-84 (Pursue aggressively), B+ = 65-74 (Worth serious look), B = 50-64 (Conditional), C = 35-49 (Below threshold), D = 0-34 (Hard pass)

KEY PRINCIPLES:
- Basis discount is THE #1 signal. Buying 40%+ below comps = massive downside protection
- Broker sophistication: KW/Coldwell = bonus (10pts), CBRE/JLL = penalty (0pts)
- Off-market + owner-occupied is the ideal play
- Nate's ideal: ~7,500 SF, 2-3 drive-ins (18ft+), 22ft clear, dock, max yard
- NNN leases preferred — expenses passed to tenant
- YOC > 10% is strong, > 12% is exceptional`

  let userPrompt
  if (isSingleCategory) {
    userPrompt = `Evaluate this deal's "${category}" score specifically.

${dealSummary}

${currentScores}

For the "${category}" category, provide:
1. Your recommended score (integer)
2. A 1-2 sentence reasoning explaining why

IMPORTANT: Respond ONLY in this exact JSON format, no markdown, no backticks:
{"score": <number>, "max": <number>, "reasoning": "<string>", "category": "${category}"}`
  } else {
    userPrompt = `Fully evaluate and re-score this deal. Read all the data, consider what the auto-scorer might be missing, and provide your independent assessment.

${dealSummary}

${currentScores}

For EACH scoring category, provide your recommended score and brief reasoning. Also provide an overall assessment with recommended grade.

IMPORTANT: Respond ONLY in this exact JSON format, no markdown, no backticks:
{
  "scores": {
    "basis_vs_market": {"score": <0-25>, "reasoning": "<string>"},
    "estimated_yoc": {"score": <0-20>, "reasoning": "<string>"},
    "clear_height": {"score": <0-6>, "reasoning": "<string>"},
    "doors": {"score": <0-5>, "reasoning": "<string>"},
    "size_fit": {"score": <0-4>, "reasoning": "<string>"},
    "market_quality": {"score": <0-6>, "reasoning": "<string>"},
    "interstate": {"score": <0-5>, "reasoning": "<string>"},
    "tenant_demand": {"score": <0-4>, "reasoning": "<string>"},
    "broker": {"score": <0-10>, "reasoning": "<string>"},
    "off_market": {"score": <0-6>, "reasoning": "<string>"},
    "seller_motivation": {"score": <0-4>, "reasoning": "<string>"}
  },
  "total": <number>,
  "grade": "<A+|A|B+|B|C|D>",
  "penalties": <number>,
  "penalty_reasons": "<string or empty>",
  "overall_assessment": "<2-3 sentence assessment of the deal>",
  "key_risks": "<1-2 key risks>",
  "edge": "<what makes this deal interesting or not>"
}`
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error:', response.status, errText)
      return res.status(response.status).json({ error: `API error: ${response.status}` })
    }

    const data = await response.json()
    const text = (data.content || []).map(b => b.text || '').join('')

    // Parse JSON — strip any accidental markdown fences
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch (e) {
      console.error('Failed to parse AI response:', clean)
      return res.status(500).json({ error: 'Failed to parse AI response', raw: clean })
    }

    return res.status(200).json({ result: parsed, model: 'claude-sonnet-4-20250514' })
  } catch (e) {
    console.error('AI scoring error:', e)
    return res.status(500).json({ error: e.message })
  }
}
