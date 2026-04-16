import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, fmt, MARKET_BENCHMARKS } from '../lib/brand'

const n = (u, k) => { const v = String(u[k] || '').replace(/,/g, ''); return parseFloat(v) || 0 }
const fc = (v) => v >= 0 ? '$' + Math.round(v).toLocaleString() : '($' + Math.round(Math.abs(v)).toLocaleString() + ')'
const compactK = (v) => Math.abs(v) >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e3 ? '$' + (v / 1e3).toFixed(0) + 'K' : '$' + Math.round(v)
const pct = (v, d = 1) => v ? v.toFixed(d) + '%' : '—'
function calcIRR(cfs) {
  if (!cfs || cfs.length < 2) return 0
  let r = 0.12
  for (let i = 0; i < 200; i++) {
    let npv = 0, dnpv = 0
    for (let t = 0; t < cfs.length; t++) { const d = Math.pow(1 + r, t); npv += cfs[t] / d; if (t > 0) dnpv -= t * cfs[t] / (d * (1 + r)) }
    if (Math.abs(npv) < 0.01 || dnpv === 0) break
    r -= npv / dnpv; if (r < -0.99) r = -0.5; if (r > 10) r = 5
  }
  return r
}

const IS = { width: '100%', padding: '6px 8px', border: `1px solid ${B.gray20}`, borderRadius: 3, fontSize: 12, color: B.black, background: B.white, outline: 'none', boxSizing: 'border-box', fontFamily: bf, textAlign: 'right' }
const LS = { fontSize: 10, color: B.gray, fontFamily: bf, marginBottom: 1, display: 'block' }
const SH = { fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6, marginTop: 14, letterSpacing: 0.4 }

// Expense line items with NNN toggle
const EXPENSE_LINES = [
  { key: 're_taxes', label: 'RE Taxes', ph: '6796', defaultNNN: true },
  { key: 'insurance', label: 'Insurance', ph: '7500', defaultNNN: true },
  { key: 'utilities', label: 'Utilities', ph: '1000', defaultNNN: true },
  { key: 'landscaping', label: 'Landscaping', ph: '1000', defaultNNN: true },
  { key: 'mgmt', label: 'Management', ph: '0', defaultNNN: false },
  { key: 'other_expenses', label: 'Other', ph: '2500', defaultNNN: false },
]

export default function UnderwriteTab({ deal, onUpdated }) {
  const mkt = MARKET_BENCHMARKS[deal.market] || MARKET_BENCHMARKS._default
  const saved = (() => { try { return JSON.parse(deal.underwrite_data || '{}') } catch(e) { return {} } })()
  const has = (k) => saved.hasOwnProperty(k) && saved[k] !== null && saved[k] !== undefined

  const [u, setU] = useState({
    deal_type: has('deal_type') ? saved.deal_type : 'building',
    scenario: has('scenario') ? saved.scenario : 'in_place',
    bldg_sf: has('bldg_sf') ? saved.bldg_sf : (deal.building_sf || ''),
    lot_acres: has('lot_acres') ? saved.lot_acres : (deal.lot_acres || ''),
    ios_acres: has('ios_acres') ? saved.ios_acres : '',
    purchase_price: has('purchase_price') ? saved.purchase_price : (deal.asking_price || deal.purchase_price || ''),
    closing_pct: has('closing_pct') ? saved.closing_pct : '4.0',
    bldg_rent_psf: has('bldg_rent_psf') ? saved.bldg_rent_psf : mkt.bldg_rent.toFixed(2),
    yard_rent_acre_mo: has('yard_rent_acre_mo') ? saved.yard_rent_acre_mo : ((mkt.yard_rent || 3500) / 12).toFixed(0),
    vacancy_pct: has('vacancy_pct') ? saved.vacancy_pct : '5',
    rent_growth: has('rent_growth') ? saved.rent_growth : '3.0',
    downtime_months: has('downtime_months') ? saved.downtime_months : '6',
    abatement_months: has('abatement_months') ? saved.abatement_months : '2',
    ti_psf: has('ti_psf') ? saved.ti_psf : '2.00',
    lc_pct: has('lc_pct') ? saved.lc_pct : '6',
    // Expenses stored as total annual $
    re_taxes: has('re_taxes') ? saved.re_taxes : '',
    insurance: has('insurance') ? saved.insurance : '',
    utilities: has('utilities') ? saved.utilities : '',
    landscaping: has('landscaping') ? saved.landscaping : '',
    mgmt: has('mgmt') ? saved.mgmt : '',
    other_expenses: has('other_expenses') ? saved.other_expenses : '',
    // NNN toggles per line (true = tenant reimburses)
    nnn_re_taxes: has('nnn_re_taxes') ? saved.nnn_re_taxes : true,
    nnn_insurance: has('nnn_insurance') ? saved.nnn_insurance : true,
    nnn_utilities: has('nnn_utilities') ? saved.nnn_utilities : true,
    nnn_landscaping: has('nnn_landscaping') ? saved.nnn_landscaping : true,
    nnn_mgmt: has('nnn_mgmt') ? saved.nnn_mgmt : false,
    nnn_other_expenses: has('nnn_other_expenses') ? saved.nnn_other_expenses : false,
    capex_psf: has('capex_psf') ? saved.capex_psf : '1.00',
    soft_costs: has('soft_costs') ? saved.soft_costs : '0',
    hard_costs: has('hard_costs') ? saved.hard_costs : '0',
    exit_cap: has('exit_cap') ? saved.exit_cap : (mkt.exit_cap || 8.0).toFixed(1),
    hold_years: has('hold_years') ? saved.hold_years : '4',
    brokerage_pct: has('brokerage_pct') ? saved.brokerage_pct : '3',
    lender: has('lender') ? saved.lender : 'TBD',
    ltv: has('ltv') ? saved.ltv : '65',
    interest_rate: has('interest_rate') ? saved.interest_rate : '7.5',
    rate_type: has('rate_type') ? saved.rate_type : 'Fixed',
    io_months: has('io_months') ? saved.io_months : '12',
    amort_months: has('amort_months') ? saved.amort_months : '240',
    loan_closing_pct: has('loan_closing_pct') ? saved.loan_closing_pct : '3',
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const timerRef = useRef(null)
  const set = (k, val) => { setU(p => ({ ...p, [k]: val })); setDirty(true) }
  const v = (k) => n(u, k)

  const doSave = useCallback(async (data) => {
    if (!deal.id) return
    setSaving(true)
    try {
      await supabase.from('deals').update({ underwrite_data: JSON.stringify(data), updated_at: new Date().toISOString() }).eq('id', deal.id)
      setDirty(false); setLastSaved(new Date())
      if (onUpdated) onUpdated(data)
    } catch (e) { console.error('Underwrite save error:', e) }
    setSaving(false)
  }, [deal.id, onUpdated])

  useEffect(() => {
    if (!dirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSave(u), 1500)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [u, dirty, doSave])

  // ── RENDER HELPERS ──
  const field = (label, key, opts = {}) => (
    <div key={key} style={{ flex: opts.flex || '1 1 100px', minWidth: opts.minW || 80 }}>
      <label style={LS}>{label}</label>
      <div style={{ position: 'relative' }}>
        {opts.pre && <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: B.gray }}>{opts.pre}</span>}
        <input style={{ ...IS, paddingLeft: opts.pre ? 16 : 8, paddingRight: opts.suf ? 24 : 8 }} value={u[key] ?? ''} onChange={e => set(key, e.target.value)} placeholder={opts.ph || ''} />
        {opts.suf && <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: B.gray }}>{opts.suf}</span>}
      </div>
    </div>
  )
  const selectField = (label, key, options, opts = {}) => (
    <div key={key} style={{ flex: opts.flex || '1 1 100px', minWidth: opts.minW || 80 }}>
      <label style={LS}>{label}</label>
      <select style={{ ...IS, cursor: 'pointer', textAlign: 'left' }} value={u[key]} onChange={e => set(key, e.target.value)}>
        {options.map(o => <option key={typeof o === 'string' ? o : o.v} value={typeof o === 'string' ? o : o.v}>{typeof o === 'string' ? o : o.l}</option>)}
      </select>
    </div>
  )
  const row = (label, value, bold, color) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
      <span style={{ color: bold ? B.blue : B.gray }}>{label}</span>
      <span style={{ color: color || B.black, fontWeight: bold ? 700 : 400, fontFamily: bold ? hf : bf }}>{value}</span>
    </div>
  )
  const toggle = (options, key) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: B.gray10, borderRadius: 4, padding: 2, marginRight: 12, marginBottom: 6 }}>
      {options.map(o => (
        <button key={o.v} onClick={() => set(key, o.v)} style={{
          padding: '5px 14px', borderRadius: 3, fontSize: 11, fontWeight: u[key] === o.v ? 700 : 400,
          border: 'none', background: u[key] === o.v ? B.white : 'transparent',
          color: u[key] === o.v ? B.blue : B.gray60, cursor: 'pointer', fontFamily: hf,
          boxShadow: u[key] === o.v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}>{o.l}</button>
      ))}
    </div>
  )

  // ── EXPENSE LINE: dual entry (total + per-foot) with NNN toggle ──
  const bldgSF = v('bldg_sf')
  const expenseLine = (line) => {
    const total = v(line.key)
    const psf = bldgSF > 0 && total > 0 ? (total / bldgSF).toFixed(2) : ''
    const isNNN = u['nnn_' + line.key]
    return (
      <div key={line.key} style={{ display: 'flex', gap: 4, alignItems: 'flex-end', marginBottom: 4 }}>
        <div style={{ flex: '1 1 60px', minWidth: 55 }}>
          {line.key === EXPENSE_LINES[0].key && <label style={{ ...LS, fontSize: 9 }}>Total/yr</label>}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: B.gray }}>$</span>
            <input style={{ ...IS, paddingLeft: 14, fontSize: 11, padding: '5px 6px 5px 14px' }} value={u[line.key] ?? ''} placeholder={line.ph}
              onChange={e => set(line.key, e.target.value)} />
          </div>
        </div>
        <div style={{ flex: '0 0 55px' }}>
          {line.key === EXPENSE_LINES[0].key && <label style={{ ...LS, fontSize: 9 }}>$/SF</label>}
          <input style={{ ...IS, fontSize: 11, padding: '5px 4px', color: B.gray60 }} value={psf} readOnly
            placeholder={bldgSF > 0 && line.ph ? (Number(line.ph) / bldgSF).toFixed(2) : ''} />
        </div>
        <div style={{ flex: '0 0 90px' }}>
          {line.key === EXPENSE_LINES[0].key && <label style={{ ...LS, fontSize: 9 }}>Reimb?</label>}
          <button onClick={() => set('nnn_' + line.key, !isNNN)} style={{
            width: '100%', padding: '5px 4px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            border: `1px solid ${isNNN ? '#10B98140' : B.gray20}`,
            background: isNNN ? '#D1FAE520' : B.gray10,
            color: isNNN ? '#065F46' : B.gray60, cursor: 'pointer', fontFamily: hf,
          }}>{isNNN ? '✓ NNN' : 'Non-reimb'}</button>
        </div>
        <div style={{ flex: '0 0 auto', fontSize: 10, color: B.gray60, fontFamily: bf, alignSelf: 'center', minWidth: 50 }}>
          {line.label}
        </div>
      </div>
    )
  }

  // ── CALCULATIONS ──
  const c = useMemo(() => {
    const hasBldg = u.deal_type === 'building' || u.deal_type === 'both'
    const hasYard = u.deal_type === 'ios' || u.deal_type === 'both'
    const isLeaseUp = u.scenario === 'lease_up'
    const yrs = Math.round(v('hold_years')) || 4
    const sf = v('bldg_sf')

    const bldgRentAnn = hasBldg ? sf * v('bldg_rent_psf') : 0
    const iosAcres = hasYard ? v('ios_acres') : 0
    const yardRentAnn = hasYard ? iosAcres * v('yard_rent_acre_mo') * 12 : 0
    const gpi = bldgRentAnn + yardRentAnn
    const vacAmt = gpi * (v('vacancy_pct') / 100)
    const egi = gpi - vacAmt

    // Expenses — split by NNN vs non-reimbursable
    let reimbursable = 0, nonReimb = 0
    EXPENSE_LINES.forEach(line => {
      const amt = v(line.key)
      if (u['nnn_' + line.key]) reimbursable += amt
      else nonReimb += amt
    })
    const totalExp = nonReimb // NNN expenses net to zero for landlord, only non-reimb reduces NOI
    const noi = egi - totalExp
    const capex = sf * v('capex_psf') // Below NOI

    const pp = v('purchase_price')
    const closingCosts = pp * (v('closing_pct') / 100)
    const totalAcq = pp + closingCosts
    const soft = v('soft_costs'), hard = v('hard_costs')
    const ti = isLeaseUp && hasBldg ? sf * v('ti_psf') : 0
    const lc = isLeaseUp ? gpi * (v('lc_pct') / 100) : 0
    const totalDev = soft + hard + ti + lc
    const loanAmt = pp * (v('ltv') / 100)
    const loanClosing = loanAmt * (v('loan_closing_pct') / 100)
    const totalBasis = totalAcq + totalDev + loanClosing
    const equity = totalBasis - loanAmt

    const monthlyRate = v('interest_rate') / 100 / 12
    const ioMo = Math.round(v('io_months'))
    const amortMo = Math.round(v('amort_months'))
    const annualIO = loanAmt * (v('interest_rate') / 100)
    const monthlyAmort = amortMo > 0 && monthlyRate > 0 ? loanAmt * monthlyRate / (1 - Math.pow(1 + monthlyRate, -amortMo)) : loanAmt * monthlyRate

    const rg = v('rent_growth') / 100
    const ec = v('exit_cap') / 100
    const brkPct = v('brokerage_pct') / 100
    const exitNOI = noi * Math.pow(1 + rg, yrs) * (1 + rg)
    const grossExit = ec > 0 ? exitNOI / ec : 0
    const exitCosts = grossExit * (brkPct + 0.02)
    const netExit = grossExit - exitCosts

    // Annual CF with capex below NOI
    const downtime = isLeaseUp ? Math.round(v('downtime_months')) : 0
    const abatement = isLeaseUp ? Math.round(v('abatement_months')) : 0
    const moRent = bldgRentAnn / 12, moYard = yardRentAnn / 12
    const moNonReimb = nonReimb / 12

    let oLoan = loanAmt
    const rows = []
    for (let yr = 0; yr <= yrs; yr++) {
      if (yr === 0) {
        rows.push({ yr, rev: 0, abate: 0, exp: 0, noi: 0, acq: -totalAcq, dev: -totalDev, loanCl: -loanClosing, capRes: 0, exit: 0, ds: 0, loanDraw: loanAmt, loanRepay: 0, unlevCF: -totalBasis, levCF: -equity, oLoan })
        continue
      }
      const gf = Math.pow(1 + rg, yr)
      let yRev = 0, yAbate = 0, yExp = 0, yDS = 0
      for (let m = (yr - 1) * 12; m < yr * 12; m++) {
        if (m < downtime) { yRev += moYard * gf }
        else if (m < downtime + abatement) { yAbate += moRent * gf; yRev += moYard * gf }
        else { yRev += (moRent + moYard) * gf }
        yExp += moNonReimb * gf // Only non-reimbursable expenses
        if (m < ioMo) { yDS += oLoan * monthlyRate }
        else { yDS += monthlyAmort; oLoan -= (monthlyAmort - oLoan * monthlyRate) }
      }
      const yearCapex = sf * v('capex_psf') * gf
      const yNOI = yRev - yAbate - yExp
      const isExit = yr === yrs
      const exitProc = isExit ? netExit : 0
      const loanRepay = isExit ? -oLoan : 0
      const devCost = yr === 1 ? -totalDev : 0
      rows.push({ yr, rev: yRev, abate: yAbate, exp: yExp, noi: yNOI, acq: 0, dev: devCost, loanCl: 0, capRes: -yearCapex, exit: exitProc, ds: -yDS, loanDraw: 0, loanRepay, unlevCF: yNOI - yearCapex + exitProc + devCost, levCF: yNOI - yearCapex - yDS + exitProc + loanRepay + devCost, oLoan })
    }

    const uCFs = rows.map(r => r.yr === 0 ? -totalBasis : r.unlevCF)
    const lCFs = rows.map(r => r.yr === 0 ? -equity : r.levCF)
    const uIRR = calcIRR(uCFs) * 100, lIRR = calcIRR(lCFs) * 100
    const uMOIC = totalBasis > 0 ? (uCFs.reduce((s, x) => s + x, 0) + totalBasis) / totalBasis : 0
    const lMOIC = equity > 0 ? (lCFs.reduce((s, x) => s + x, 0) + equity) / equity : 0

    return { hasBldg, hasYard, isLeaseUp, yrs, sf, bldgRentAnn, yardRentAnn, gpi, vacAmt, egi, reimbursable, nonReimb, totalExp, noi, capex, pp, closingCosts, totalAcq, totalDev, ti, lc, soft, hard, loanAmt, loanClosing, totalBasis, equity, annualIO, monthlyAmort, exitNOI, grossExit, exitCosts, netExit, rows, uIRR, lIRR, uMOIC, lMOIC, goingInCap: pp > 0 ? noi / pp * 100 : 0, yocBasis: totalBasis > 0 ? noi / totalBasis * 100 : 0, dscr: annualIO > 0 ? noi / annualIO : 0, debtYield: loanAmt > 0 ? noi / loanAmt : 0, psfPurch: sf > 0 ? pp / sf : 0, psfBasis: sf > 0 ? totalBasis / sf : 0, profit: uCFs.reduce((s, x) => s + x, 0), levProfit: lCFs.reduce((s, x) => s + x, 0), rg: v('rent_growth'), ec: v('exit_cap') }
  }, [u]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* TOGGLES + SAVE STATUS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          {toggle([{ v: 'building', l: 'Building' }, { v: 'ios', l: 'IOS Only' }, { v: 'both', l: 'Bldg + Yard' }], 'deal_type')}
          {toggle([{ v: 'in_place', l: 'Lease In Place' }, { v: 'lease_up', l: 'Lease-Up' }], 'scenario')}
        </div>
        <div style={{ fontSize: 10, fontFamily: bf, color: saving ? B.amber : dirty ? B.red : lastSaved ? B.green : B.gray40 }}>
          {saving ? '⟳ Saving...' : dirty ? '● Unsaved' : lastSaved ? '✓ Saved' : ''}
        </div>
      </div>

      {/* KEY METRICS */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {[
          { l: 'NOI', v: fc(c.noi), color: c.noi > 0 ? B.green : B.red },
          { l: 'Going-In Cap', v: pct(c.goingInCap), color: c.goingInCap >= 9 ? B.green : c.goingInCap >= 7 ? B.amber : B.red },
          { l: 'YOC (all-in)', v: pct(c.yocBasis), color: c.yocBasis >= 10 ? B.green : c.yocBasis >= 8 ? B.amber : B.red },
          { l: 'Unlev IRR', v: pct(c.uIRR), color: c.uIRR >= 15 ? B.green : c.uIRR >= 10 ? B.amber : B.red },
          { l: 'Lev IRR', v: pct(c.lIRR), color: c.lIRR >= 20 ? B.green : c.lIRR >= 15 ? B.amber : B.red },
          { l: 'MOIC', v: c.lMOIC > 0 ? c.lMOIC.toFixed(2) + 'x' : '—', color: c.lMOIC >= 2 ? B.green : B.amber },
          { l: 'Profit', v: compactK(c.profit), color: c.profit > 0 ? B.green : B.red },
          { l: 'Equity', v: compactK(c.equity), color: B.blue },
        ].map((m, i) => (
          <div key={i} style={{ flex: '1 1 80px', minWidth: 75, background: B.white, borderRadius: 4, padding: '8px 10px', border: `1px solid ${B.gray20}` }}>
            <div style={{ fontSize: 9, color: B.gray, fontFamily: bf, textTransform: 'uppercase', letterSpacing: 0.3 }}>{m.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: hf }}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, fontSize: 11, fontFamily: bf, color: B.gray }}>
        <span>DSCR: <strong style={{ color: c.dscr >= 1.25 ? B.green : B.red, fontFamily: hf }}>{c.dscr > 0 ? c.dscr.toFixed(2) + 'x' : '—'}</strong></span>
        <span>Debt Yield: <strong style={{ fontFamily: hf }}>{c.debtYield > 0 ? pct(c.debtYield * 100) : '—'}</strong></span>
        <span>$/SF: <strong style={{ fontFamily: hf }}>{c.psfPurch > 0 ? '$' + Math.round(c.psfPurch) : '—'}</strong></span>
        <span>$/SF (all-in): <strong style={{ fontFamily: hf }}>{c.psfBasis > 0 ? '$' + Math.round(c.psfBasis) : '—'}</strong></span>
        <span>Exit: <strong style={{ color: B.green, fontFamily: hf }}>{compactK(c.grossExit)}</strong></span>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* LEFT: INPUTS */}
        <div style={{ flex: '1 1 380px', minWidth: 320 }}>
          <div style={SH}>Acquisition</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Purchase Price', 'purchase_price', { pre: '$', ph: '1600000' })}
            {field('Closing Cost %', 'closing_pct', { suf: '%', ph: '4.0' })}
          </div>
          <div style={SH}>Property</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {c.hasBldg && field('Building SF', 'bldg_sf', { ph: '115700' })}
            {field('Total Lot Acres', 'lot_acres', { suf: 'ac', ph: '16.32' })}
            {c.hasYard && field('Usable IOS Acres', 'ios_acres', { suf: 'ac', ph: '12.5' })}
          </div>
          <div style={SH}>Income</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {c.hasBldg && field('NNN Rent ($/SF/yr)', 'bldg_rent_psf', { pre: '$', ph: '5.00' })}
            {c.hasYard && field('Yard Rent ($/ac/mo)', 'yard_rent_acre_mo', { pre: '$', ph: '292' })}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Vacancy', 'vacancy_pct', { suf: '%', ph: '5' })}
            {field('Rent Growth', 'rent_growth', { suf: '%/yr', ph: '3.0' })}
          </div>
          {c.isLeaseUp && <>
            <div style={SH}>Lease-Up</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {field('Downtime (mo)', 'downtime_months', { ph: '6' })}
              {field('Abatement (mo)', 'abatement_months', { ph: '2' })}
              {c.hasBldg && field('TI ($/SF)', 'ti_psf', { pre: '$', ph: '2.00' })}
              {field('Leasing Comm %', 'lc_pct', { suf: '%', ph: '6' })}
            </div>
          </>}

          <div style={SH}>Operating Expenses (annual)</div>
          <div style={{ background: B.white, borderRadius: 4, padding: '10px 12px', border: `1px solid ${B.gray20}`, marginBottom: 6 }}>
            {EXPENSE_LINES.map(line => expenseLine(line))}
            <div style={{ borderTop: `1px solid ${B.gray20}`, marginTop: 6, paddingTop: 6, fontSize: 10, color: B.gray, fontFamily: bf }}>
              NNN = tenant reimburses (doesn't reduce your NOI). Non-reimb = landlord expense.
            </div>
          </div>

          <div style={SH}>Capital Reserves (below NOI)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Capital Reserve ($/SF/yr)', 'capex_psf', { pre: '$', ph: '1.00' })}
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <label style={LS}>Annual total</label>
              <div style={{ ...IS, background: B.gray10, color: B.gray, cursor: 'default' }}>{bldgSF > 0 ? fc(bldgSF * v('capex_psf')) : '—'}</div>
            </div>
          </div>

          <div style={SH}>Development / Renovation</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Soft Costs', 'soft_costs', { pre: '$', ph: '0' })}
            {field('Hard Costs', 'hard_costs', { pre: '$', ph: '0' })}
          </div>
          <div style={SH}>Exit</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Exit Cap', 'exit_cap', { suf: '%', ph: '8.0' })}
            {field('Hold (yrs)', 'hold_years', { ph: '4' })}
            {field('Brokerage %', 'brokerage_pct', { suf: '%', ph: '3' })}
          </div>
          <div style={SH}>Debt</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Lender', 'lender', { ph: 'TBD' })}
            {selectField('Rate Type', 'rate_type', ['Fixed', 'Adjustable'])}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('LTV', 'ltv', { suf: '%', ph: '65' })}
            {field('Interest Rate', 'interest_rate', { suf: '%', ph: '7.5' })}
            {field('Loan Closing %', 'loan_closing_pct', { suf: '%', ph: '3' })}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('IO Months', 'io_months', { ph: '12' })}
            {field('Amort Months', 'amort_months', { ph: '240' })}
          </div>
        </div>

        {/* RIGHT: OUTPUTS */}
        <div style={{ flex: '1 1 300px', minWidth: 260 }}>
          <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 10 }}>
            <div style={{ ...SH, marginTop: 0 }}>NOI Buildup</div>
            {c.hasBldg && row('Building Income', fc(c.bldgRentAnn))}
            {c.hasYard && row('Yard Income', fc(c.yardRentAnn))}
            {row('Gross Potential Income', fc(c.gpi), true)}
            {row('Less: Vacancy', fc(-c.vacAmt), false, B.red)}
            {row('Effective Gross Income', fc(c.egi))}
            <div style={{ height: 4 }} />
            {c.nonReimb > 0 && row('Non-Reimbursable OpEx', fc(-c.nonReimb), false, B.red)}
            {c.nonReimb === 0 && row('Non-Reimbursable OpEx', '$0 (all NNN)', false, B.gray40)}
            {row('Net Operating Income', fc(c.noi), true, c.noi > 0 ? B.green : B.red)}
            <div style={{ height: 4, borderTop: `1px dashed ${B.gray20}`, marginTop: 4 }} />
            {row('Capital Reserves', fc(-c.capex), false, B.gray)}
            {row('NOI after CapEx', fc(c.noi - c.capex), false, B.gray)}
          </div>
          <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 10 }}>
            <div style={{ ...SH, marginTop: 0 }}>Sources & Uses</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 4 }}>USES</div>
                {row('Purchase Price', fc(c.pp))}
                {row('Closing Costs', fc(c.closingCosts))}
                {c.soft > 0 && row('Soft Costs', fc(c.soft))}
                {c.hard > 0 && row('Hard Costs', fc(c.hard))}
                {c.ti > 0 && row('TI', fc(c.ti))}
                {c.lc > 0 && row('Leasing Comm', fc(c.lc))}
                {c.loanClosing > 0 && row('Loan Closing', fc(c.loanClosing))}
                {row('Total Uses', fc(c.totalBasis), true)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 4 }}>SOURCES</div>
                {row('Equity', fc(c.equity))}
                {row('Debt', fc(c.loanAmt))}
                {row('Total', fc(c.equity + c.loanAmt), true)}
                <div style={{ height: 10 }} />
                {row('Equity %', c.totalBasis > 0 ? pct(c.equity / c.totalBasis * 100) : '—')}
                {row('LTV', pct(v('ltv')))}
              </div>
            </div>
          </div>
          <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 10 }}>
            <div style={{ ...SH, marginTop: 0 }}>Exit (Year {c.yrs})</div>
            {row('Forward NOI', fc(c.exitNOI))}
            {row('Exit Cap Rate', pct(v('exit_cap')))}
            {row('Gross Sale Price', fc(c.grossExit), true)}
            {row('Less: Closing', fc(-c.exitCosts), false, B.red)}
            {row('Net Proceeds', fc(c.netExit), true, B.green)}
          </div>
        </div>
      </div>

      {/* ANNUAL CF */}
      {c.pp > 0 && (() => {
        const rows = c.rows
        const th = { background: '#1a1a2e', color: '#fff', padding: '4px 6px', fontSize: 9, fontFamily: hf, textAlign: 'right', whiteSpace: 'nowrap' }
        const td = (bold, color) => ({ padding: '3px 6px', fontSize: 10, fontFamily: bold ? hf : bf, textAlign: 'right', borderBottom: `1px solid ${B.gray10}`, color: color || B.black, fontWeight: bold ? 700 : 400 })
        const R = (label, getter, bold, color) => (
          <tr key={label} style={bold ? { background: '#f8f9fb' } : {}}>
            <td style={{ padding: '3px 6px', fontSize: 10, fontFamily: bold ? hf : bf, fontWeight: bold ? 700 : 400, borderBottom: `1px solid ${bold ? B.gray20 : B.gray10}`, color: bold ? B.blue : B.gray, whiteSpace: 'nowrap' }}>{label}</td>
            {rows.map(r => { const val = getter(r); return <td key={r.yr} style={td(bold, typeof color === 'function' ? color(val) : color)}>{val ? fc(val) : '—'}</td> })}
            <td style={td(true, typeof color === 'function' ? color(rows.reduce((s, r) => s + getter(r), 0)) : color)}>{fc(rows.reduce((s, r) => s + getter(r), 0))}</td>
          </tr>
        )
        const div = <tr key="d"><td colSpan={rows.length + 2} style={{ padding: 2, borderBottom: `2px solid ${B.gray20}` }}></td></tr>
        return (
          <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 14, overflowX: 'auto' }}>
            <div style={{ ...SH, marginTop: 0 }}>Cash Flow Summary</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}></th>{rows.map(r => <th key={r.yr} style={th}>Yr {r.yr}</th>)}<th style={{ ...th, background: '#2A9D8F' }}>Total</th></tr></thead>
              <tbody>
                {R('Revenue', r => r.rev, false)}
                {c.isLeaseUp && R('Abatements', r => -r.abate, false, x => x < 0 ? B.red : undefined)}
                {c.nonReimb > 0 && R('Non-Reimb Expenses', r => -r.exp, false, x => x < 0 ? B.red : undefined)}
                {R('NOI', r => r.noi, true)}
                {div}
                {R('Acquisition', r => r.acq, false, x => x < 0 ? B.red : undefined)}
                {c.totalDev > 0 && R('Development', r => r.dev, false, x => x < 0 ? B.red : undefined)}
                {R('Cap Reserves', r => r.capRes, false, x => x < 0 ? B.red : undefined)}
                {R('Sale Proceeds', r => r.exit, false, x => x > 0 ? '#065F46' : undefined)}
                {R('Unlevered CF', r => r.unlevCF, true, x => x >= 0 ? '#065F46' : B.red)}
                {div}
                {R('Debt Service', r => r.ds, false, x => x < 0 ? B.red : undefined)}
                {R('Loan Draw/Repay', r => r.loanDraw + r.loanRepay, false, x => x < 0 ? B.red : x > 0 ? '#065F46' : undefined)}
                {R('Levered CF', r => r.levCF, true, x => x >= 0 ? '#065F46' : B.red)}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 16, fontSize: 10, color: B.gray, fontFamily: bf, marginTop: 8, flexWrap: 'wrap' }}>
              <span>Unlev IRR: <strong style={{ color: B.blue, fontFamily: hf }}>{pct(c.uIRR)}</strong></span>
              <span>Lev IRR: <strong style={{ color: B.blue, fontFamily: hf }}>{pct(c.lIRR)}</strong></span>
              <span>Unlev MOIC: <strong style={{ color: B.blue, fontFamily: hf }}>{c.uMOIC > 0 ? c.uMOIC.toFixed(2) + 'x' : '—'}</strong></span>
              <span>Lev MOIC: <strong style={{ color: B.blue, fontFamily: hf }}>{c.lMOIC > 0 ? c.lMOIC.toFixed(2) + 'x' : '—'}</strong></span>
              <span>Deal Profit: <strong style={{ color: c.profit > 0 ? '#065F46' : B.red, fontFamily: hf }}>{compactK(c.profit)}</strong></span>
            </div>
          </div>
        )
      })()}

      {/* SENSITIVITY: Rent vs Exit Cap — ±5% steps rounded to $0.05 */}
      {c.pp > 0 && c.noi !== 0 && (() => {
        const baseRent = v('bldg_rent_psf')
        const baseEC = v('exit_cap')
        const rentSteps = c.hasBldg
          ? [-3, -2, -1, 0, 1, 2, 3].map(d => {
              const raw = baseRent * (1 + d * 0.05)
              return Math.round(raw * 20) / 20 // round to nearest $0.05
            })
          : [0]
        const ecSteps = [1.5, 1, 0.5, 0, -0.5, -1, -1.5].map(d => baseEC + d).filter(x => x > 0)
        return (
          <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 14, overflowX: 'auto' }}>
            <div style={{ ...SH, marginTop: 0 }}>Sensitivity — {c.hasBldg ? 'Rent' : 'NOI'} vs Exit Cap (Profit / IRR / MOIC)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: bf }}>
              <thead><tr>
                <th style={{ background: '#1a1a2e', color: B.white, padding: '5px 6px', fontSize: 9, fontFamily: hf, textAlign: 'left' }}>{c.hasBldg ? 'Rent $/SF' : 'NOI'}</th>
                {ecSteps.map(ec => <th key={ec} style={{ background: '#1a1a2e', color: B.white, padding: '5px 4px', fontSize: 9, fontFamily: hf, textAlign: 'center' }}>{ec.toFixed(1)}%</th>)}
              </tr></thead>
              <tbody>
                {rentSteps.map(rent => {
                  const isBase = Math.abs(rent - baseRent) < 0.03
                  return (
                    <tr key={rent}>
                      <td style={{ background: '#f8f9fb', fontWeight: 700, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf, fontSize: 10 }}>{c.hasBldg ? `$${rent.toFixed(2)}` : fc(c.noi)}</td>
                      {ecSteps.map(ec => {
                        const adjBldg = c.hasBldg ? c.sf * rent : 0
                        const adjGross = adjBldg + c.yardRentAnn
                        const adjEGI = adjGross * (1 - v('vacancy_pct') / 100)
                        const adjNOI = adjEGI - c.nonReimb
                        const adjExitNOI = adjNOI * Math.pow(1 + c.rg / 100, c.yrs) * (1 + c.rg / 100)
                        const adjExitVal = ec > 0 ? adjExitNOI / (ec / 100) : 0
                        const adjNetExit = adjExitVal * (1 - v('brokerage_pct') / 100 - 0.02)
                        const tCF = Array.from({ length: c.yrs }, (_, i) => adjNOI * Math.pow(1 + c.rg / 100, i + 1))
                        const profit = tCF.reduce((s, x) => s + x, 0) + adjNetExit - c.totalBasis
                        const lCF = [-c.equity]
                        for (let y = 1; y <= c.yrs; y++) {
                          const yN = adjNOI * Math.pow(1 + c.rg / 100, y)
                          lCF.push(y === c.yrs ? yN - c.annualIO + adjNetExit - c.loanAmt * 0.95 : yN - c.annualIO)
                        }
                        const lI = calcIRR(lCF) * 100
                        const lM = c.equity > 0 ? (lCF.reduce((s, x) => s + x, 0) + c.equity) / c.equity : 0
                        const isBaseCell = isBase && Math.abs(ec - baseEC) < 0.01
                        const bg = isBaseCell ? '#2A9D8F' : lI >= 25 ? '#D1FAE5' : lI >= 15 ? '#FEF3C7' : lI >= 10 ? '#FFECD2' : '#FEE2E2'
                        const tc = isBaseCell ? '#fff' : lI >= 25 ? '#065F46' : lI >= 15 ? '#92400E' : '#991B1B'
                        return <td key={ec} style={{ padding: '4px 3px', textAlign: 'center', borderBottom: `1px solid ${B.gray20}`, background: bg, color: tc, fontSize: 9, lineHeight: 1.4 }}><div style={{ fontWeight: 700 }}>{compactK(profit)}</div><div>{pct(lI)} / {lM > 0 ? lM.toFixed(2) + 'x' : '—'}</div></td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 9, color: B.gray60, fontFamily: bf, marginTop: 4 }}>Each cell: Deal Profit / Levered IRR / MOIC. ±5% rent steps, rounded to $0.05. Green ≥25% IRR. Yellow ≥15%. Red &lt;10%.</div>
          </div>
        )
      })()}

      {/* YOC SENSITIVITY */}
      {c.pp > 0 && c.noi !== 0 && (() => {
        const noiOffsets = [-30, -20, -10, 0, 10, 20, 30]
        const pricePoints = [-20, -10, 0, 10, 20].map(p => Math.round(c.pp * (1 + p / 100)))
        return (
          <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 14, overflowX: 'auto' }}>
            <div style={{ ...SH, marginTop: 0 }}>YOC — NOI vs Purchase Price</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: bf }}>
              <thead><tr>
                <th style={{ background: '#1a1a2e', color: B.white, padding: '5px 6px', fontSize: 9, fontFamily: hf, textAlign: 'left' }}>NOI \ Price</th>
                {pricePoints.map(pp => <th key={pp} style={{ background: '#1a1a2e', color: B.white, padding: '5px 4px', fontSize: 9, fontFamily: hf, textAlign: 'center' }}>{compactK(pp)}{c.sf > 0 ? <><br /><span style={{ fontSize: 8, color: '#8892a4' }}>${Math.round(pp / c.sf)}/SF</span></> : ''}</th>)}
              </tr></thead>
              <tbody>
                {noiOffsets.map(offset => {
                  const adjNOI = c.noi * (1 + offset / 100), isBase = offset === 0
                  return (
                    <tr key={offset}>
                      <td style={{ background: '#f8f9fb', fontWeight: 700, padding: '4px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf, fontSize: 10, whiteSpace: 'nowrap' }}>{fc(adjNOI)} <span style={{ fontSize: 8, color: B.gray }}>{offset > 0 ? '+' : ''}{offset}%</span></td>
                      {pricePoints.map(pp => {
                        const allIn = pp * (1 + v('closing_pct') / 100), yoc = allIn > 0 ? adjNOI / allIn * 100 : 0
                        const isBC = isBase && pp === c.pp
                        const bg = isBC ? '#2A9D8F' : yoc >= 10 ? '#D1FAE5' : yoc >= 8 ? '#FEF3C7' : '#FEE2E2'
                        const tc = isBC ? '#fff' : yoc >= 10 ? '#065F46' : yoc >= 8 ? '#92400E' : '#991B1B'
                        return <td key={pp} style={{ padding: '4px', textAlign: 'center', borderBottom: `1px solid ${B.gray20}`, background: bg, color: tc, fontWeight: isBC || yoc >= 10 ? 700 : 400, fontSize: 10 }}>{yoc.toFixed(1)}%</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 9, color: B.gray60, fontFamily: bf, marginTop: 4 }}>YOC on all-in basis. Green ≥10%. Yellow 8-10%. Red &lt;8%.</div>
          </div>
        )
      })()}
    </div>
  )
}
