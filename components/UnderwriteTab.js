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
    for (let t = 0; t < cfs.length; t++) {
      const d = Math.pow(1 + r, t)
      npv += cfs[t] / d
      if (t > 0) dnpv -= t * cfs[t] / (d * (1 + r))
    }
    if (Math.abs(npv) < 0.01) break
    if (dnpv === 0) break
    r -= npv / dnpv
    if (r < -0.99) r = -0.5
    if (r > 10) r = 5
  }
  return r
}

const IS = { width: '100%', padding: '6px 8px', border: `1px solid ${B.gray20}`, borderRadius: 3, fontSize: 12, color: B.black, background: B.white, outline: 'none', boxSizing: 'border-box', fontFamily: bf, textAlign: 'right' }
const LS = { fontSize: 10, color: B.gray, fontFamily: bf, marginBottom: 1, display: 'block' }
const SH = { fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6, marginTop: 14, letterSpacing: 0.4 }

export default function UnderwriteTab({ deal }) {
  const mkt = MARKET_BENCHMARKS[deal.market] || MARKET_BENCHMARKS._default
  const saved = (() => { try { return JSON.parse(deal.underwrite_data || '{}') } catch(e) { return {} } })()

  const [u, setU] = useState({
    deal_type: saved.deal_type || 'building',
    scenario: saved.scenario || 'in_place',
    bldg_sf: saved.bldg_sf || deal.building_sf || '',
    lot_acres: saved.lot_acres || deal.lot_acres || '',
    ios_acres: saved.ios_acres || '',
    purchase_price: saved.purchase_price || deal.asking_price || deal.purchase_price || '',
    closing_pct: saved.closing_pct || '4.0',
    bldg_rent_psf: saved.bldg_rent_psf || mkt.bldg_rent.toFixed(2),
    yard_rent_acre_mo: saved.yard_rent_acre_mo || ((mkt.yard_rent || 3500) / 12).toFixed(0),
    vacancy_pct: saved.vacancy_pct || '5',
    rent_growth: saved.rent_growth || '3.0',
    downtime_months: saved.downtime_months || '6',
    abatement_months: saved.abatement_months || '2',
    ti_psf: saved.ti_psf || '2.00',
    lc_pct: saved.lc_pct || '6',
    re_taxes: saved.re_taxes || '',
    insurance: saved.insurance || '',
    utilities: saved.utilities || '',
    landscaping: saved.landscaping || '',
    mgmt_pct: saved.mgmt_pct || '0',
    other_expenses: saved.other_expenses || '',
    capex_psf: saved.capex_psf || '1.00',
    soft_costs: saved.soft_costs || '0',
    hard_costs: saved.hard_costs || '0',
    exit_cap: saved.exit_cap || (mkt.exit_cap || 8.0).toFixed(1),
    hold_years: saved.hold_years || '4',
    brokerage_pct: saved.brokerage_pct || '3',
    lender: saved.lender || 'TBD',
    ltv: saved.ltv || '65',
    interest_rate: saved.interest_rate || '7.5',
    rate_type: saved.rate_type || 'Fixed',
    io_months: saved.io_months || '12',
    amort_months: saved.amort_months || '240',
    loan_closing_pct: saved.loan_closing_pct || '3',
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const timerRef = useRef(null)

  const set = (k, val) => { setU(p => ({ ...p, [k]: val })); setDirty(true) }
  const v = (k) => n(u, k)

  // Auto-save: debounce 1.5s after last change, save directly to Supabase
  const doSave = useCallback(async (data) => {
    if (!deal.id) return
    setSaving(true)
    try {
      await supabase.from('deals').update({ underwrite_data: JSON.stringify(data), updated_at: new Date().toISOString() }).eq('id', deal.id)
      setDirty(false)
      setLastSaved(new Date())
    } catch (e) { console.error('Underwrite save error:', e) }
    setSaving(false)
  }, [deal.id])

  useEffect(() => {
    if (!dirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSave(u), 1500)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [u, dirty, doSave])

  const field = (label, key, opts = {}) => (
    <div key={key} style={{ flex: opts.flex || '1 1 100px', minWidth: opts.minW || 80 }}>
      <label style={LS}>{label}</label>
      <div style={{ position: 'relative' }}>
        {opts.pre && <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: B.gray }}>{opts.pre}</span>}
        <input style={{ ...IS, paddingLeft: opts.pre ? 16 : 8, paddingRight: opts.suf ? 24 : 8 }} value={u[key] ?? ''} onChange={e => set(key, e.target.value)} />
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
  const toggle = (label, options, key) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: B.gray10, borderRadius: 4, padding: 2, marginRight: 12, marginBottom: 6 }}>
      {options.map(o => (
        <button key={o.v} onClick={() => set(key, o.v)} style={{
          padding: '5px 14px', borderRadius: 3, fontSize: 11, fontWeight: u[key] === o.v ? 700 : 400,
          border: 'none', background: u[key] === o.v ? B.white : 'transparent',
          color: u[key] === o.v ? B.blue : B.gray60,
          cursor: 'pointer', fontFamily: hf,
          boxShadow: u[key] === o.v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.15s',
        }}>{o.l}</button>
      ))}
    </div>
  )

  const c = useMemo(() => {
    const hasBldg = u.deal_type === 'building' || u.deal_type === 'both'
    const hasYard = u.deal_type === 'ios' || u.deal_type === 'both'
    const isLeaseUp = u.scenario === 'lease_up'
    const yrs = Math.round(v('hold_years')) || 4

    const bldgSF = v('bldg_sf')
    const bldgRentAnn = hasBldg ? bldgSF * v('bldg_rent_psf') : 0
    const iosAcres = hasYard ? v('ios_acres') : 0
    const yardRentAnn = hasYard ? iosAcres * v('yard_rent_acre_mo') * 12 : 0
    const gpi = bldgRentAnn + yardRentAnn
    const vacAmt = gpi * (v('vacancy_pct') / 100)
    const egi = gpi - vacAmt

    const mgmt = egi * (v('mgmt_pct') / 100)
    const capex = bldgSF * v('capex_psf')
    const reTaxes = v('re_taxes'), ins = v('insurance'), util = v('utilities'), land = v('landscaping'), other = v('other_expenses')
    const reimbursable = reTaxes + ins + util + land + capex
    const nonReimb = mgmt + other
    const totalExp = reimbursable + nonReimb
    const noi = egi - totalExp

    const pp = v('purchase_price')
    const closingCosts = pp * (v('closing_pct') / 100)
    const totalAcq = pp + closingCosts

    const soft = v('soft_costs'), hard = v('hard_costs')
    const ti = isLeaseUp && hasBldg ? bldgSF * v('ti_psf') : 0
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

    const downtime = isLeaseUp ? Math.round(v('downtime_months')) : 0
    const abatement = isLeaseUp ? Math.round(v('abatement_months')) : 0
    const moRent = bldgRentAnn / 12, moYard = yardRentAnn / 12
    const moReimb = reimbursable / 12, moNonReimb = nonReimb / 12

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
        yExp += (moReimb + moNonReimb) * gf
        if (m < ioMo) { yDS += oLoan * monthlyRate }
        else { yDS += monthlyAmort; oLoan -= (monthlyAmort - oLoan * monthlyRate) }
      }
      const capRes = bldgSF * v('capex_psf')
      const yNOI = yRev - yAbate - yExp
      const isExit = yr === yrs
      const exitProc = isExit ? netExit : 0
      const loanRepay = isExit ? -oLoan : 0
      const devCost = yr === 1 ? -totalDev : 0
      rows.push({ yr, rev: yRev, abate: yAbate, exp: yExp, noi: yNOI, acq: 0, dev: devCost, loanCl: 0, capRes: -capRes, exit: exitProc, ds: -yDS, loanDraw: 0, loanRepay, unlevCF: yNOI - capRes + exitProc + devCost, levCF: yNOI - capRes - yDS + exitProc + loanRepay + devCost, oLoan })
    }

    const uCFs = rows.map(r => r.yr === 0 ? -totalBasis : r.unlevCF)
    const lCFs = rows.map(r => r.yr === 0 ? -equity : r.levCF)
    const uIRR = calcIRR(uCFs) * 100, lIRR = calcIRR(lCFs) * 100
    const uMOIC = totalBasis > 0 ? (uCFs.reduce((s, x) => s + x, 0) + totalBasis) / totalBasis : 0
    const lMOIC = equity > 0 ? (lCFs.reduce((s, x) => s + x, 0) + equity) / equity : 0

    return { hasBldg, hasYard, isLeaseUp, yrs, bldgSF, bldgRentAnn, yardRentAnn, gpi, vacAmt, egi, reimbursable, nonReimb, totalExp, noi, pp, closingCosts, totalAcq, totalDev, ti, lc, soft, hard, loanAmt, loanClosing, totalBasis, equity, annualIO, monthlyAmort, exitNOI, grossExit, exitCosts, netExit, rows, uIRR, lIRR, uMOIC, lMOIC, goingInCap: pp > 0 ? noi / pp * 100 : 0, yocBasis: totalBasis > 0 ? noi / totalBasis * 100 : 0, dscr: annualIO > 0 ? noi / annualIO : 0, debtYield: loanAmt > 0 ? noi / loanAmt : 0, psfPurch: bldgSF > 0 ? pp / bldgSF : 0, psfBasis: bldgSF > 0 ? totalBasis / bldgSF : 0, profit: uCFs.reduce((s, x) => s + x, 0), levProfit: lCFs.reduce((s, x) => s + x, 0), rg: v('rent_growth'), ec: v('exit_cap') }
  }, [u]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          {toggle('', [{ v: 'building', l: 'Building' }, { v: 'ios', l: 'IOS Only' }, { v: 'both', l: 'Bldg + Yard' }], 'deal_type')}
          {toggle('', [{ v: 'in_place', l: 'Lease In Place' }, { v: 'lease_up', l: 'Lease-Up' }], 'scenario')}
        </div>
        <div style={{ fontSize: 10, fontFamily: bf, color: B.gray40 }}>
          {saving ? '⟳ Saving...' : dirty ? '● Unsaved' : lastSaved ? '✓ Saved' : ''}
        </div>
      </div>

      {/* HERO METRICS */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #2a3f5f)', borderRadius: 6, padding: 16, color: B.white, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12 }}>
          {[
            { l: 'NOI', v: fc(c.noi), c: c.noi > 0 ? '#2A9D8F' : '#EF4444' },
            { l: 'Going-In Cap', v: pct(c.goingInCap), c: c.goingInCap >= 9 ? '#2A9D8F' : c.goingInCap >= 7 ? '#F59E0B' : '#EF4444' },
            { l: 'YOC (all-in)', v: pct(c.yocBasis), c: c.yocBasis >= 10 ? '#2A9D8F' : c.yocBasis >= 8 ? '#F59E0B' : '#EF4444' },
            { l: 'Unlev IRR', v: pct(c.uIRR), c: c.uIRR >= 15 ? '#2A9D8F' : c.uIRR >= 10 ? '#F59E0B' : '#EF4444' },
            { l: 'Lev IRR', v: pct(c.lIRR), c: c.lIRR >= 20 ? '#2A9D8F' : c.lIRR >= 15 ? '#F59E0B' : '#EF4444' },
            { l: 'Lev MOIC', v: c.lMOIC > 0 ? c.lMOIC.toFixed(2) + 'x' : '—', c: c.lMOIC >= 2 ? '#2A9D8F' : '#F59E0B' },
            { l: 'Deal Profit', v: compactK(c.profit), c: c.profit > 0 ? '#2A9D8F' : '#EF4444' },
            { l: 'Equity', v: compactK(c.equity), c: '#fff' },
          ].map((item, i) => (
            <div key={i}><div style={{ fontSize: 8, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.l}</div><div style={{ fontSize: 18, fontWeight: 900, color: item.c, fontFamily: hf }}>{item.v}</div></div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 10, paddingTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10, color: '#8892a4' }}>
          <span>DSCR: <strong style={{ color: c.dscr >= 1.25 ? '#2A9D8F' : '#EF4444' }}>{c.dscr > 0 ? c.dscr.toFixed(2) + 'x' : '—'}</strong></span>
          <span>Debt Yield: <strong>{c.debtYield > 0 ? pct(c.debtYield * 100) : '—'}</strong></span>
          <span>$/SF (purchase): <strong style={{ color: '#fff' }}>{c.psfPurch > 0 ? '$' + Math.round(c.psfPurch) : '—'}</strong></span>
          <span>$/SF (all-in): <strong style={{ color: '#fff' }}>{c.psfBasis > 0 ? '$' + Math.round(c.psfBasis) : '—'}</strong></span>
          <span>Exit Value: <strong style={{ color: '#2A9D8F' }}>{compactK(c.grossExit)}</strong></span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* LEFT: INPUTS */}
        <div style={{ flex: '1 1 340px', minWidth: 300 }}>
          <div style={SH}>Acquisition</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Purchase Price', 'purchase_price', { pre: '$' })}
            {field('Closing Cost %', 'closing_pct', { suf: '%' })}
          </div>
          <div style={SH}>Property</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {c.hasBldg && field('Building SF', 'bldg_sf')}
            {field('Total Lot Acres', 'lot_acres', { suf: 'ac' })}
            {c.hasYard && field('Usable IOS Acres', 'ios_acres', { suf: 'ac' })}
          </div>
          <div style={SH}>Income</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {c.hasBldg && field('NNN Rent ($/SF/yr)', 'bldg_rent_psf', { pre: '$' })}
            {c.hasYard && field('Yard Rent ($/ac/mo)', 'yard_rent_acre_mo', { pre: '$' })}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Vacancy', 'vacancy_pct', { suf: '%' })}
            {field('Rent Growth', 'rent_growth', { suf: '%/yr' })}
          </div>
          {c.isLeaseUp && <>
            <div style={SH}>Lease-Up</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {field('Downtime (mo)', 'downtime_months')}
              {field('Abatement (mo)', 'abatement_months')}
              {c.hasBldg && field('TI ($/SF)', 'ti_psf', { pre: '$' })}
              {field('Leasing Comm %', 'lc_pct', { suf: '%' })}
            </div>
          </>}
          <div style={SH}>Expenses (annual)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('RE Taxes', 're_taxes', { pre: '$' })}
            {field('Insurance', 'insurance', { pre: '$' })}
            {field('Utilities', 'utilities', { pre: '$' })}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Landscaping', 'landscaping', { pre: '$' })}
            {field('Mgmt Fee %', 'mgmt_pct', { suf: '%' })}
            {field('Other', 'other_expenses', { pre: '$' })}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Capital Reserve ($/SF/yr)', 'capex_psf', { pre: '$' })}
          </div>
          <div style={SH}>Development / Renovation</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Soft Costs', 'soft_costs', { pre: '$' })}
            {field('Hard Costs', 'hard_costs', { pre: '$' })}
          </div>
          <div style={SH}>Exit</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Exit Cap', 'exit_cap', { suf: '%' })}
            {field('Hold (yrs)', 'hold_years')}
            {field('Brokerage %', 'brokerage_pct', { suf: '%' })}
          </div>
          <div style={SH}>Debt</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('Lender', 'lender')}
            {selectField('Rate Type', 'rate_type', ['Fixed', 'Adjustable'])}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('LTV', 'ltv', { suf: '%' })}
            {field('Interest Rate', 'interest_rate', { suf: '%' })}
            {field('Loan Closing %', 'loan_closing_pct', { suf: '%' })}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {field('IO Months', 'io_months')}
            {field('Amort Months', 'amort_months')}
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
            {row('Reimbursable Expenses', fc(-c.reimbursable), false, B.red)}
            {row('Non-Reimbursable', fc(-c.nonReimb), false, B.red)}
            {row('Net Operating Income', fc(c.noi), true, c.noi > 0 ? B.green : B.red)}
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
                {R('Expenses', r => -r.exp, false, x => x < 0 ? B.red : undefined)}
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

      {/* SENSITIVITY: Rent vs Exit Cap */}
      {c.pp > 0 && c.noi !== 0 && (() => {
        const baseRent = v('bldg_rent_psf'), baseEC = v('exit_cap')
        const rentSteps = c.hasBldg ? [-2, -1, 0, 1, 2, 3].map(d => Math.round((baseRent + d) * 100) / 100) : [0]
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
                  const isBase = Math.abs(rent - baseRent) < 0.01
                  return (
                    <tr key={rent}>
                      <td style={{ background: '#f8f9fb', fontWeight: 700, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf, fontSize: 10 }}>{c.hasBldg ? `$${rent.toFixed(2)}` : fc(c.noi)}</td>
                      {ecSteps.map(ec => {
                        const adjBldg = c.hasBldg ? v('bldg_sf') * rent : 0
                        const adjGross = adjBldg + c.yardRentAnn
                        const adjEGI = adjGross * (1 - v('vacancy_pct') / 100)
                        const adjNOI = adjEGI - c.totalExp
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
            <div style={{ fontSize: 9, color: B.gray60, fontFamily: bf, marginTop: 4 }}>Each cell: Deal Profit / Levered IRR / MOIC. Green ≥25% IRR. Yellow ≥15%. Red &lt;10%.</div>
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
                {pricePoints.map(pp => <th key={pp} style={{ background: '#1a1a2e', color: B.white, padding: '5px 4px', fontSize: 9, fontFamily: hf, textAlign: 'center' }}>{compactK(pp)}{c.bldgSF > 0 ? <><br /><span style={{ fontSize: 8, color: '#8892a4' }}>${Math.round(pp / c.bldgSF)}/SF</span></> : ''}</th>)}
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
