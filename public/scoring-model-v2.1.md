# DUFFIELD HOLDINGS — Deal Scoring Model v2.1
## Designed for Nate Wellek | April 2026

---

## PHILOSOPHY

The old model used absolute thresholds (e.g. "if price/SF < $45 → full points"). That's wrong because every deal is relative to its local market. A $45/SF building in Louisville is a steal. $45/SF in Laredo might be overpriced.

**The new model estimates what stabilized NOI would be, calculates implied YOC (Yield on Cost), and scores the deal based on the YOC-to-Exit-Cap spread.** Wider spread = better deal. Everything else either feeds into the NOI estimate or signals edge (broker quality, seller motivation, off-market).

---

## MARKET BENCHMARKS (Mid-Market Assumptions)

These are used to estimate stabilized NOI when actual rent data isn't available. Updated from your deal data + public sources.

| Market | Building Rent ($/SF/yr NNN) | IOS Yard Rent ($/ac/mo) | Target $/SF (buy) | Target $/Acre (buy) | Exit Cap |
|--------|----------------------------|-------------------------|--------------------|--------------------|----------|
| Louisville KY | $6.00 | $3,500–$4,500 | $40–$70 | $150K–$300K | 7.5%–8.5% |
| Laredo TX | $5.50 | $3,000–$4,000 | $25–$60 | $200K–$400K | 8.0%–9.0% |
| Brownsville TX | $5.00 | $2,500–$3,500 | $20–$50 | $150K–$350K | 8.0%–9.5% |
| McAllen TX | $5.00 | $2,500–$3,500 | $20–$50 | $150K–$300K | 8.0%–9.5% |
| El Paso TX | $5.50 | $3,000–$4,000 | $30–$60 | $175K–$350K | 7.5%–8.5% |
| Evansville IN | $4.50 | $2,500–$3,500 | $25–$50 | $100K–$250K | 8.5%–9.5% |
| Lumberton NC | $4.50 | $2,000–$3,000 | $20–$45 | $80K–$200K | 9.0%–10.0% |
| Nogales AZ | $5.00 | $3,000–$4,000 | $30–$55 | $200K–$450K | 8.0%–9.0% |
| Milwaukee WI | $6.50 | $3,500–$4,500 | $40–$70 | $150K–$350K | 7.5%–8.5% |
| National avg (secondary) | $6.00 | $3,500 | $35–$65 | $150K–$300K | 8.0%–9.0% |

*Sources: Your LOI data (24 LOIs), master property spreadsheet (1,400+ properties), LoopNet Louisville avg $7/SF asking, Cushman & Wakefield Louisville $4–$10/SF range, national secondary market avg $6–$8/SF (CommercialEdge 2025).*

---

## SCORING MODEL — 100 POINTS

### TIER 1: ECONOMICS (40 pts)
*The numbers that determine if you make money*

#### 1A. Estimated YOC Potential (20 pts)
The system estimates stabilized NOI:
- **IOS component:** usable IOS acres × market yard rent/mo × 12
- **Building component:** building SF × market building rent/SF/yr
- **Less expenses:** 4% mgmt + $0.20/SF capex + estimated taxes/insurance
- **YOC = NOI ÷ asking price**

| YOC | Points |
|-----|--------|
| 12%+ | 20 |
| 10%–12% | 16 |
| 8%–10% | 12 |
| 7%–8% | 8 |
| 6%–7% | 4 |
| <6% | 0 |

#### 1B. Price Relative to Market (20 pts)
Scored on two dimensions depending on deal type:

**For IOS-heavy sites (building coverage <25%):**
- Price per usable acre vs market target $/acre
- Below 60% of market midpoint = 20 pts
- Below 80% = 15 pts
- At market = 10 pts
- Above market = 5 pts
- Way above = 0 pts

**For building-heavy sites (building coverage >25%):**
- Price per SF vs market target $/SF
- Same relative tiers as above

---

### TIER 2: PHYSICAL PLANT (25 pts)
*Does the property fit your box?*

#### 2A. Building Coverage / IOS Potential (8 pts)
*Only applied to IOS-type sites*

| Coverage | Points | Label |
|----------|--------|-------|
| <15% | 8 | IDEAL — mostly yard |
| 15%–20% | 7 | Great |
| 20%–35% | 5 | OK |
| 35%–50% | 2 | Heavy building |
| >50% | 0 | Not IOS |

*For non-IOS deals, these 8 pts redistribute into Tier 1 pricing.*

#### 2B. Clear Height (6 pts)
*Check-the-box but critical — under 16ft is almost a no*

| Clear Height | Points |
|--------------|--------|
| 22ft+ | 6 (your ideal) |
| 18ft–22ft | 5 |
| 16ft–18ft | 3 |
| 14ft–16ft | 1 |
| <14ft | 0 (auto-flag) |

#### 2C. Access — Drive-Ins & Docks (6 pts)
*More doors relative to SF = better. Bigger doors = better.*

| Configuration | Points |
|---------------|--------|
| 2-3 large drive-ins (18ft+) + dock on <10K SF | 6 (YOUR IDEAL) |
| 2+ drive-ins + dock | 5 |
| 1 drive-in + dock | 4 |
| 1-2 standard drive-ins, no dock | 2 |
| Overhead doors only | 1 |
| No truck access | 0 |

#### 2D. Lot-to-Building Ratio & Size (5 pts)

| Lot:Building | Points |
|-------------|--------|
| >6x | 5 (tons of yard) |
| 4x–6x | 4 |
| 3x–4x | 3 |
| 2x–3x | 1 |
| <2x | 0 |

---

### TIER 3: MARKET & LOCATION (15 pts)

#### 3A. MSA Population Growth (6 pts)
*Growing > big. A 400K MSA growing 3%/yr beats a 1.2M stagnant one.*

| Growth Rate | Points |
|-------------|--------|
| 2%+/yr | 6 |
| 1%–2% | 4 |
| 0%–1% | 2 |
| Declining | 0 |

#### 3B. Interstate Proximity (5 pts)

| Distance | Points |
|----------|--------|
| <1 mile | 5 |
| 1–3 miles | 4 |
| 3–5 miles | 2 |
| >5 miles | 0 |

#### 3C. Industrial Vacancy / Tenant Demand (4 pts)

| Vacancy | Points |
|---------|--------|
| <5% | 4 (tight = fast lease-up) |
| 5%–8% | 3 |
| 8%–12% | 1 |
| >12% | 0 |

---

### TIER 4: DEAL EDGE (20 pts)
*The soft factors that create your alpha*

#### 4A. Broker Sophistication (10 pts)
*Shitty broker = massive opportunity signal*

| Broker Type | Points | Why |
|-------------|--------|-----|
| Keller Williams, Coldwell Banker, Century 21, RE/MAX, no-name residential | 10 | Don't know industrial value |
| Regional commercial (not industrial specialist) | 7 | Know commercial, not niche |
| Industrial specialist, regional (HCR, etc) | 4 | Know the space |
| CBRE, JLL, Colliers, Cushman & Wakefield, M&M | 0 | They've maximized price |
| No broker / FSBO | 8 | Direct to seller, your pitch |

#### 4B. Off-Market / Seller Situation (6 pts)

| Situation | Points |
|-----------|--------|
| Off-market + owner-occupied (sale-leaseback play) | 6 |
| Off-market | 4 |
| Owner-occupied, listed | 3 |
| Standard listed deal | 0 |

#### 4C. Seller Motivation Signals (4 pts)

| Signal | Points |
|--------|--------|
| Estate sale, aging owner, 20+ yr hold, tax delinquent | 4 |
| 15+ yr hold, family LLC, retirement signals | 2 |
| No motivation signals | 0 |

---

### PENALTIES (Deductions)

| Risk | Penalty | Rationale |
|------|---------|-----------|
| Flood zone (FEMA Zone AE) | -12 pts | Structural — hard to solve, insurance killer, lender issue |
| Zoning doesn't allow intended use | -15 pts | Structural — may need SUP, can be a deal-killer |
| Zoning concern (may need variance) | -8 pts | Moderate — solvable but adds time/risk |
| Environmental — Phase I RECs flagged | -5 pts | Solvable with money |
| Known contamination, remediation needed | -8 pts | Solvable but expensive, price it in |
| No utilities / limited road access | -5 pts | Infrastructure gap |
| Clear height <16ft | -5 pts (additional) | Near auto-no, stacks with low Tier 2 score |

*Note: IOS zoning penalty (-15) only applies if the deal IS an IOS play. A building deal in M-2 that you'd use as traditional warehouse doesn't get penalized for IOS restrictions.*

---

## GRADE SCALE

| Grade | Score | Action |
|-------|-------|--------|
| A+ | 85–100 | Strong buy — drop everything, make offer |
| A | 75–84 | Pursue aggressively — underwrite deeply |
| B+ | 65–74 | Good deal — worth serious look |
| B | 50–64 | Conditional — needs specific edge or negotiation |
| C | 35–49 | Below threshold — pass unless compelling narrative |
| D | 0–34 | Hard pass |

**Calibration reference:** 14415 Import Rd (your closed deal) scores 83 → A. This feels right per your feedback.

---

## FEEDBACK LOOP

This model improves over time. Here's how:

1. **Every deal you pursue:** I log what score the model gave it vs your actual interest level. If the model says B but you're excited, the model is underweighting something.

2. **Every deal you pass on:** If the model says A but you pass, something is overweighted.

3. **Closed deals:** Your actual YOC on 14415 Import is the best calibration data. If the model would have scored it low but it turned out to be a great deal, the model needs adjustment.

4. **Questions I should ask you:**
   - "This deal scored 72 (A) — does that feel right?"
   - "You passed on Aberdeen but the model scored it 65. What killed it?"
   - "Your 6801 Enterprise underwrite shows 10% YOC. The model estimated 9.2%. Should I adjust Louisville rent assumptions?"

5. **Market benchmarks update:** As you do more deals and more underwriting, the rent/cap rate assumptions per market get refined. Your Louisville data (6801 Enterprise, 14415 Import, Knopp Ave, Ralph Ave) is much better than LoopNet averages.

---

## WHAT THE MODEL STILL CAN'T DO (YET)

- **Auto-pull market rent comps** — needs Crexi/CoStar API integration
- **Auto-detect broker type** — would need to scrape brokerage from listing
- **Auto-check flood zone** — FEMA API exists, could integrate
- **Auto-check zoning** — requires county-specific lookup
- **Auto-estimate MSA growth** — Census Bureau API exists

These are all buildable. Tell me which would be most valuable and I'll wire them in.

---

---

## CALIBRATION LOG

### Deal: 14415 Import Rd, Laredo TX (CLOSED Sep 2025)

**Actual metrics:**
- Purchase: $1,185,250 ($74/SF) — negotiated from $1,387,500 during DD
- Building: 15,990 SF on 1.0 acre
- Clear height: 25ft, 4 docks, 1 drive-in
- Stabilized NOI: $134,316 ($8.40 NNN — conservative; market closer to $9.50-$10)
- YOC: 9.2% at conservative rent, ~11.3% at mid-market
- Exit cap: 7.00%
- YOC-to-Exit spread: 220-430 bps
- Levered IRR: 19.7% gross / 17.3% net
- MOIC: 1.78x gross / 1.67x net
- Deal sourced: Off-market, direct from owner, no broker
- Laredo sale comps: $122-$259/SF (avg $185/SF) — Nate bought at $74

**Score under v2.0:** 72 (A) — Nate said "feels better than that"
**Feedback applied:**
1. Basis discount is THE #1 driver — $74 vs $185 avg = 60% below = massive downside protection
2. Non-IOS deals should NOT be penalized for IOS metrics (lot-to-bldg, coverage ratio)
3. Use mid-market rent ($9.50) not conservative ($8.40) for YOC estimation
4. Market rent trending toward $10/SF NNN — $8.40 was deliberately conservative underwriting
5. Going-in basis vs replacement cost ($125-175/SF) is additional downside protection layer

**Score under v2.1:** 83 (A) — Nate confirmed this feels right

### Key Insight
The basis discount alone carried 25 of 45 economic points. When you're buying at 60% below comp sales AND below replacement cost, the deal almost can't fail. This is Nate's core thesis: buy so cheap that even the downside scenario produces moderate returns.

---

*Model v2.1 — April 2026 — Calibrated from 1,489 deal records, 24 LOIs, 6801 Enterprise underwrite, 14415 Import closed deal, and Nate's brain.*
