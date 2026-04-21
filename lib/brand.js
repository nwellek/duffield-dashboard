// ─── BRAND COLORS (from Duffield Capital Brand Book) ───
export const B = {
  blue: '#1C4587', blue80: '#496AA0', blue60: '#7790B8', blue40: '#A4B5D0',
  blue20: '#D2DAE8', blue10: '#E8EDF3', blue05: '#F4F6F9',
  gray: '#7A7A7A', gray80: '#959595', gray60: '#AFAFAF', gray40: '#CACACA',
  gray20: '#E4E4E4', gray10: '#F2F2F2',
  black: '#000000', white: '#FFFFFF',
  green: '#1B7A3D', greenLight: '#E6F4EB', greenDark: '#0D4A23',
  amber: '#B8860B', amberLight: '#FDF3DC', amberDark: '#6B4E08',
  red: '#C0392B', redLight: '#FAEAE8', redDark: '#7A241B',
  teal: '#1A7A6D', tealLight: '#E5F5F3',
  violet: '#5B3F8F', violetLight: '#EEEBF5',
}

// ─── FONTS ───
export const hf = "'Fira Sans Condensed', 'Arial Narrow', sans-serif"
export const bf = "'Fira Sans', -apple-system, sans-serif"

// ─── DEAL STATUS ───
export const COLUMNS = [
  { id: 'owned', label: 'Owned', color: B.green },
  { id: 'under_contract', label: 'Under contract', color: B.teal },
  { id: 'loi_sent', label: 'LOI sent', color: B.violet },
  { id: 'under_review', label: 'Under review', color: B.blue },
  { id: 'cold_loi', label: 'Cold LOI', color: '#E67E22' },
  { id: 'dead', label: 'Dead', color: B.red },
]

// ─── TARGET MARKETS ───
export const MARKETS = [
  'Laredo TX','McAllen TX','Brownsville TX','El Paso TX','Nogales AZ','Phoenix AZ',
  'Louisville KY','Lumberton NC','Aberdeen NC','Moore County NC','Wilmington NC',
  'Spokane WA','Milwaukee WI','Conway SC','Myrtle Beach SC','Greenville SC','Lynchburg VA',
  'Gainesville FL','Evansville IN','Ann Arbor MI','Other',
]

// ─── PROPERTY TYPES ───
export const PTYPES = [
  'Small bay industrial','IOS (outdoor storage)','Warehouse/distribution',
  'Flex/light industrial','Truck terminal','Laydown yard',
]

// ─── MARKET BENCHMARKS (mid-market) ───
export const MARKET_BENCHMARKS = {
  'Louisville KY': { bldg_rent: 7.00, yard_rent: 4000, target_psf: 55, comp_psf: 70, exit_cap: 8.0, vacancy: 5 },
  'Greater Louisville': { bldg_rent: 7.00, yard_rent: 4000, target_psf: 55, comp_psf: 70, exit_cap: 8.0, vacancy: 5 },
  'Laredo TX': { bldg_rent: 9.50, yard_rent: 3500, target_psf: 42, comp_psf: 185, exit_cap: 8.5, vacancy: 3 },
  'Brownsville TX': { bldg_rent: 6.35, yard_rent: 3000, target_psf: 50, comp_psf: 120, exit_cap: 8.5, vacancy: 5 },
  'McAllen TX': { bldg_rent: 5.50, yard_rent: 3000, target_psf: 35, comp_psf: 50, exit_cap: 9.0, vacancy: 6 },
  'El Paso TX': { bldg_rent: 6.00, yard_rent: 3500, target_psf: 45, comp_psf: 65, exit_cap: 8.0, vacancy: 5 },
  'Evansville IN': { bldg_rent: 5.00, yard_rent: 3000, target_psf: 37, comp_psf: 50, exit_cap: 9.0, vacancy: 7 },
  'Lumberton NC': { bldg_rent: 5.00, yard_rent: 2500, target_psf: 32, comp_psf: 45, exit_cap: 9.5, vacancy: 7 },
  'Nogales AZ': { bldg_rent: 5.50, yard_rent: 3500, target_psf: 42, comp_psf: 55, exit_cap: 8.5, vacancy: 5 },
  'Milwaukee WI': { bldg_rent: 7.00, yard_rent: 4000, target_psf: 55, comp_psf: 70, exit_cap: 8.0, vacancy: 5 },
  'Greater Milwaukee': { bldg_rent: 7.00, yard_rent: 4000, target_psf: 55, comp_psf: 70, exit_cap: 8.0, vacancy: 5 },
  'Greenville SC': { bldg_rent: 8.00, yard_rent: 3000, target_psf: 50, comp_psf: 80, exit_cap: 7.0, vacancy: 4 },
  'Myrtle Beach SC': { bldg_rent: 8.50, yard_rent: 1500, target_psf: 60, comp_psf: 110, exit_cap: 8.0, vacancy: 5 },
  'Conway SC': { bldg_rent: 8.50, yard_rent: 1500, target_psf: 60, comp_psf: 110, exit_cap: 8.0, vacancy: 5 },
  '_default': { bldg_rent: 6.00, yard_rent: 3500, target_psf: 45, comp_psf: 65, exit_cap: 8.5, vacancy: 6 },
}

// ─── BROKER SCORING ───
const BROKER_SCORES = {
  'keller williams': 10, 'kw': 10, 'coldwell banker': 10, 'century 21': 10, 'remax': 10, 're/max': 10,
  'berkshire hathaway': 8, 'exp realty': 8, 'compass': 7,
  'hcr': 4, 'lee & associates': 4, 'lee associates': 4, 'nai': 4, 'svn': 5,
  'cbre': 0, 'jll': 0, 'colliers': 0, 'cushman': 0, 'cushman & wakefield': 0, 'marcus & millichap': 0, 'marcus millichap': 0, 'newmark': 1,
}

function getBrokerScore(deal) {
  const broker = ((deal.contact_name || '') + ' ' + (deal.contact_method || '') + ' ' + (deal.source || '')).toLowerCase()
  if (!broker.trim()) return 5 // unknown = moderate
  for (const [key, score] of Object.entries(BROKER_SCORES)) {
    if (broker.includes(key)) return score
  }
  return 6 // regional/unknown commercial = decent
}

// ─── SCORING v2.1 ───
export const MAX_SCORE = 100

export function scoreDeal(deal) {
  if (!deal) return { total: 0, grade: 'D', scores: {}, penalties: 0, estYOC: 0, isIOS: false, market: MARKET_BENCHMARKS._default }
  const d = { ...deal }
  const mkt = MARKET_BENCHMARKS[d.market] || MARKET_BENCHMARKS._default
  // Clean all numeric values — strip $, commas, etc
  const cn = (v) => { if (!v && v !== 0) return 0; const n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n }
  const sf = cn(d.building_sf)
  const acres = cn(d.lot_acres)
  const price = cn(d.asking_price) || cn(d.purchase_price)
  const lotSF = acres * 43560
  const coverage = sf > 0 && lotSF > 0 ? sf / lotSF : 0
  const isIOS = coverage < 0.25 && acres > 1.5
  const psf = sf > 0 && price > 0 ? price / sf : 0
  const pac = acres > 0 && price > 0 ? price / acres : 0

  const scores = {}
  let total = 0

  // ── TIER 1: ECONOMICS (45 pts) ──

  // 1A. Basis discount to market (25 pts) — THE KING METRIC
  const comp = isIOS ? (mkt.comp_psf * (sf || 1)) : mkt.comp_psf // for IOS use $/acre comparison
  const dealPSF = isIOS ? (acres > 0 ? price / acres / 1000 : 0) : psf
  const compPSF = isIOS ? (mkt.target_psf * 43560 / 1000) : mkt.comp_psf
  let basisDiscount = 0
  if (psf > 0 && mkt.comp_psf > 0) {
    const discount = 1 - (psf / mkt.comp_psf)
    if (discount >= 0.4) basisDiscount = 25
    else if (discount >= 0.3) basisDiscount = 20
    else if (discount >= 0.2) basisDiscount = 15
    else if (discount >= 0.1) basisDiscount = 10
    else if (discount >= -0.1) basisDiscount = 5
    else basisDiscount = 0
  }
  scores.basis_discount = basisDiscount
  total += basisDiscount

  // 1B. Estimated YOC (20 pts) — using mid-market rent
  let estNOI = 0
  if (sf > 0) estNOI += sf * mkt.bldg_rent
  if (isIOS && acres > 0) {
    const usableYard = Math.max(0, acres - (sf / 43560 * 1.5))
    estNOI += usableYard * mkt.yard_rent * 12
  }
  const expenses = estNOI * 0.04 + (sf * 0.20) // 4% mgmt + capex reserve
  estNOI -= expenses
  const totalBasis = price > 0 ? price * 1.05 : 0 // 5% for closing costs
  const estYOC = totalBasis > 0 ? (estNOI / totalBasis) * 100 : 0
  let yocScore = 0
  if (estYOC >= 12) yocScore = 20
  else if (estYOC >= 10) yocScore = 16
  else if (estYOC >= 8) yocScore = 12
  else if (estYOC >= 7) yocScore = 8
  else if (estYOC >= 6) yocScore = 4
  scores.est_yoc = yocScore
  scores._yoc_pct = Math.round(estYOC * 10) / 10
  total += yocScore

  // ── TIER 2: PHYSICAL (15 pts) ──

  // 2A. Clear height (6 pts) — baseline 3 if unknown
  const ch = cn(d.clear_height)
  let chScore = ch > 0 ? (ch >= 22 ? 6 : ch >= 18 ? 5 : ch >= 16 ? 3 : ch >= 14 ? 1 : 0) : 3 // default 3 if unknown
  scores.clear_height = chScore
  total += chScore

  // 2B. Access - drive-ins & docks (5 pts) — baseline 3 if unknown
  const docks = cn(d.dock_doors)
  let accessScore = docks > 0 ? (docks >= 3 ? 5 : docks >= 2 ? 4 : docks >= 1 ? 3 : 0) : 3 // default 3 if unknown
  scores.access = accessScore
  total += accessScore

  // 2C. Building size / lot (4 pts)
  let sizeScore = 0
  if (isIOS) {
    // IOS: score on lot-to-building ratio
    const ltb = sf > 0 ? lotSF / sf : 0
    sizeScore = ltb >= 6 ? 4 : ltb >= 4 ? 3 : ltb >= 3 ? 2 : ltb >= 2 ? 1 : 0
  } else {
    // Building deal: score on building SF fit (5K-25K sweet spot)
    sizeScore = (sf >= 5000 && sf <= 25000) ? 4 : (sf >= 2000 && sf <= 40000) ? 2 : 0
  }
  scores.size_fit = sizeScore
  total += sizeScore

  // ── TIER 3: MARKET & LOCATION (15 pts) ──

  // 3A. MSA / market quality (6 pts) — placeholder until we add growth data
  let marketScore = 4 // default moderate for secondary markets
  const pop = cn(d.msa_pop)
  if (pop > 0) marketScore = (pop >= 300000 && pop <= 1500000) ? 6 : pop > 1500000 ? 3 : 2
  scores.market = marketScore
  total += marketScore

  // 3B. Interstate proximity (5 pts)
  const dist = cn(d.distance_interstate)
  let distScore = dist > 0 ? (dist <= 1 ? 5 : dist <= 3 ? 4 : dist <= 5 ? 2 : 0) : 3 // default 3 if unknown
  scores.interstate = distScore
  total += distScore

  // 3C. Vacancy / demand (4 pts)
  const td = cn(d.tenant_demand)
  let demandScore = td >= 4 ? 4 : td >= 3 ? 3 : td >= 2 ? 2 : td >= 1 ? 1 : 2 // default 2
  scores.demand = demandScore
  total += demandScore

  // ── TIER 4: DEAL EDGE (20 pts) ──

  // 4A. Broker sophistication (10 pts)
  const brokerScore = getBrokerScore(d)
  scores.broker = brokerScore
  total += brokerScore

  // 4B. Off-market / seller situation (6 pts)
  const src = (d.source || '').toLowerCase()
  const notes = (d.notes || '').toLowerCase()
  let offMarketScore = 0
  if (src.includes('off-market') || src.includes('direct') || notes.includes('off-market') || notes.includes('off market')) offMarketScore = 4
  if (notes.includes('owner-occupied') || notes.includes('sale-leaseback') || notes.includes('owner occupied')) offMarketScore = Math.min(6, offMarketScore + 3)
  scores.off_market = offMarketScore
  total += offMarketScore

  // 4C. Seller motivation (4 pts)
  let sellerScore = 0
  if (notes.includes('estate') || notes.includes('aging') || notes.includes('retire') || notes.includes('delinquent')) sellerScore = 4
  else if (notes.includes('family') || notes.includes('long hold') || notes.includes('motivated')) sellerScore = 2
  scores.seller = sellerScore
  total += sellerScore

  // ── PENALTIES ──
  let penalties = 0
  if (notes.includes('flood zone') || notes.includes('fema')) penalties -= 12
  if (notes.includes('zoning') && (notes.includes('not allowed') || notes.includes('cannot') || notes.includes('restricted'))) penalties -= 15
  else if (notes.includes('zoning') && notes.includes('concern')) penalties -= 8
  if (notes.includes('environmental') || notes.includes('contamination') || notes.includes('phase ii')) penalties -= 5
  if (ch > 0 && ch < 16) penalties -= 5

  total += penalties
  total = Math.max(0, Math.min(100, total))

  // Per-line-item overrides
  let overrides = {}
  try { overrides = JSON.parse(d.score_overrides || '{}') } catch(e) {}
  const ov = (key, autoVal) => {
    const k = key.toLowerCase().replace(/[^a-z]/g, '_')
    return overrides[k] !== undefined && overrides[k] !== '' ? Number(overrides[k]) : autoVal
  }

  // Recalc total with overrides applied
  total = ov('basis_vs_market', scores.basis_discount) + ov('estimated_yoc', scores.est_yoc) +
    ov('clear_height', scores.clear_height) + ov('doors', scores.access) +
    ov('lot_building_ratio', scores.size_fit) + ov('size_fit', scores.size_fit) +
    ov('market_quality', scores.market) + ov('interstate', scores.interstate) +
    ov('tenant_demand', scores.demand) + ov('broker', scores.broker) +
    ov('off_market', scores.off_market) + ov('seller_motivation', scores.seller) + penalties
  // Avoid double-counting size_fit — use whichever key matches
  total = ov('basis_vs_market', scores.basis_discount) + ov('estimated_yoc', scores.est_yoc) +
    ov('clear_height', scores.clear_height) + ov('doors', scores.access) +
    (isIOS ? ov('lot_building_ratio', scores.size_fit) : ov('size_fit', scores.size_fit)) +
    ov('market_quality', scores.market) + ov('interstate', scores.interstate) +
    ov('tenant_demand', scores.demand) + ov('broker', scores.broker) +
    ov('off_market', scores.off_market) + ov('seller_motivation', scores.seller) + penalties

  total = Math.max(0, Math.min(100, total))

  // Grade
  const grade = total >= 85 ? 'A+' : total >= 75 ? 'A' : total >= 65 ? 'B+' : total >= 50 ? 'B' : total >= 35 ? 'C' : 'D'

  return { total, grade, scores, penalties, estYOC: scores._yoc_pct, isIOS, market: mkt }
}

export function gradeColor(g) {
  if (g === 'A+') return { bg: '#D1FAE5', tx: '#065F46', bd: '#10B981' }
  if (g === 'A') return { bg: '#D1FAE5', tx: '#065F46', bd: '#10B981' }
  if (g === 'B+') return { bg: B.amberLight, tx: B.amberDark, bd: B.amber }
  if (g === 'B') return { bg: B.amberLight, tx: B.amberDark, bd: B.amber }
  if (g === 'C') return { bg: B.blue10, tx: B.blue, bd: B.blue60 }
  return { bg: B.redLight, tx: B.redDark, bd: B.red }
}

// Legacy compatibility
export const SCORING_PARAMS = [
  { key: 'basis_discount', label: 'Basis vs Market', weight: 25, unit: '' },
  { key: 'est_yoc', label: 'Est. YOC', weight: 20, unit: '%' },
  { key: 'clear_height', label: 'Clear Height', weight: 6, unit: 'ft' },
  { key: 'access', label: 'Access (Docks/DI)', weight: 5, unit: '' },
  { key: 'size_fit', label: 'Size Fit', weight: 4, unit: '' },
  { key: 'market', label: 'Market Quality', weight: 6, unit: '' },
  { key: 'interstate', label: 'Interstate', weight: 5, unit: '' },
  { key: 'demand', label: 'Tenant Demand', weight: 4, unit: '' },
  { key: 'broker', label: 'Broker Edge', weight: 10, unit: '' },
  { key: 'off_market', label: 'Off-Market', weight: 6, unit: '' },
  { key: 'seller', label: 'Seller Motivation', weight: 4, unit: '' },
]

// ─── TRANSACTION CATEGORIES ───
export const TX_CATEGORIES = [
  'Acquisition cost','Closing costs','Capital improvements','Holding costs',
  'Property taxes','Insurance','Management fees','Rent collected',
  'Disposition proceeds','Loan payment','Other',
]

// ─── HELPERS ───
export const fmt = n => n ? '$' + Math.round(Number(n)).toLocaleString() : '\u2014'

export const emptyDeal = () => ({
  address: '', city: '', state: '', market: MARKETS[0], status: 'under_review',
  property_type: PTYPES[0], asking_price: null, building_sf: null, lot_acres: null,
  price_per_sf: null, clear_height: null, dock_doors: null, distance_interstate: null,
  cap_rate: null, year_built: null, notes: '', source: 'manual',
})

// ─── SHARED COMPONENTS ───
export function Badge({ children, bg, color, border, style }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 3, fontSize: 11, fontWeight: 600, fontFamily: bf, background: bg, color, border: border ? `1px solid ${border}` : 'none', ...style }}>{children}</span>
}

export function LogoSVG({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={`M3.5 3.5 L3.5 8.5 M3.5 3.5 L8.5 3.5`} stroke={B.gray} strokeWidth="2.2" strokeLinecap="square" fill="none" />
      <path d={`M${size-3.5} ${size-3.5} L${size-3.5} ${size-8.5} M${size-3.5} ${size-3.5} L${size-8.5} ${size-3.5}`} stroke={B.gray} strokeWidth="2.2" strokeLinecap="square" fill="none" />
      <text x={size/2} y={size*0.62} textAnchor="middle" fontFamily={hf} fontWeight="700" fontSize={size*0.41} fill={B.blue}>DH</text>
    </svg>
  )
}

// ─── NAV ITEMS ───
export const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'brief', label: 'Daily Brief', icon: '◈' },
  { id: 'tracker', label: 'Deal Tracker', icon: '⊞' },
  { id: 'tasks', label: 'Tasks', icon: '☑' },
  { id: 'calendar', label: 'Calendar', icon: '◪' },
  { id: 'crm', label: 'CRM', icon: '⊕' },
  { id: 'comps', label: 'Comps', icon: '⊟' },
  { id: 'treasury', label: 'Treasury', icon: '◆' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

// Market coordinates for map
export const MARKET_COORDS = {
  'Laredo TX': [27.5,-99.5], 'McAllen TX': [26.2,-98.2], 'Brownsville TX': [25.9,-97.5],
  'El Paso TX': [31.8,-106.4], 'Nogales AZ': [31.34,-110.94], 'Phoenix AZ': [33.45,-112.07],
  'Louisville KY': [38.25,-85.76], 'Lumberton NC': [34.62,-79.0],
  'Aberdeen NC': [35.13,-79.43], 'Moore County NC': [35.3,-79.5], 'Wilmington NC': [34.24,-77.95],
  'Spokane WA': [47.66,-117.43], 'Milwaukee WI': [43.04,-87.91], 'Conway SC': [33.84,-79.05],
  'Myrtle Beach SC': [33.69,-78.89], 'Greenville SC': [34.85,-82.39],
  'Lynchburg VA': [37.41,-79.14], 'Gainesville FL': [29.65,-82.32], 'Evansville IN': [37.97,-87.56],
  'Ann Arbor MI': [42.28,-83.74], 'Chicago IL': [41.88,-87.63],
  'Pensacola FL': [30.44,-87.22], 'Gulfport MS': [30.37,-89.09],
  'Baltimore MD': [39.29,-76.61], 'Kansas City KS': [39.11,-94.63],
  'Columbus OH': [39.96,-82.99], 'Hammond LA': [30.50,-90.46],
  'Kalispell MT': [48.20,-114.31], 'Pell City AL': [33.59,-86.29],
  'Tucson AZ': [32.22,-110.97], 'Toledo OH': [41.66,-83.56],
  'Youngstown OH': [41.10,-80.65], 'Winston-Salem NC': [36.10,-80.24],
}
