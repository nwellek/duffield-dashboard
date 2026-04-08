import { useState } from 'react'
import { B, hf, bf, fmt, MARKET_BENCHMARKS } from '../lib/brand'

export default function UnderwriteTab({ deal, onSave }) {
  const mkt = MARKET_BENCHMARKS[deal.market] || MARKET_BENCHMARKS._default
  const saved = (() => { try { return JSON.parse(deal.underwrite_data || '{}') } catch(e) { return {} } })()
  const [u, setU] = useState({
    bldg_sf: saved.bldg_sf || deal.building_sf || '',
    bldg_rent: saved.bldg_rent || deal.nnn_rent || mkt.bldg_rent.toFixed(2),
    ios_acres: saved.ios_acres || (deal.lot_acres ? Math.max(0, Number(deal.lot_acres) - (deal.building_sf ? Number(deal.building_sf) / 43560 * 1.5 : 0)).toFixed(1) : ''),
    yard_rent: saved.yard_rent || (mkt.yard_rent || 3500).toString(),
    vacancy_pct: saved.vacancy_pct || '5', mgmt_pct: saved.mgmt_pct || '4', capex_per_sf: saved.capex_per_sf || '0.20',
    taxes: saved.taxes || '', insurance: saved.insurance || '', other_expenses: saved.other_expenses || '',
    purchase_price: saved.purchase_price || deal.asking_price || deal.purchase_price || '',
    closing_pct: saved.closing_pct || '5',
    ltv: saved.ltv || '65', interest_rate: saved.interest_rate || '6.5', io_months: saved.io_months || '12', amort_months: saved.amort_months || '300',
    exit_cap: saved.exit_cap || (mkt.exit_cap || 8.0).toFixed(1),
    rent_growth: saved.rent_growth || '3.0', hold_years: saved.hold_years || '4',
  })
  const [flags, setFlags] = useState([])
  const [newFlag, setNewFlag] = useState({ type: 'GREEN', text: '' })
  const [dirty, setDirty] = useState(false)

  const set = (k, v) => { setU(p => ({ ...p, [k]: v })); setDirty(true) }
  const n = (k) => { const v = String(u[k] || '').replace(/,/g, ''); return parseFloat(v) || 0 }

  const saveUnderwrite = async () => {
    if (deal.id && onSave) {
      await onSave({ ...deal, underwrite_data: JSON.stringify(u) })
      setDirty(false)
    }
  }

  // ── NOI CALCULATION ──
  const bldgIncome = n('bldg_sf') * n('bldg_rent')
  const yardIncome = n('ios_acres') * n('yard_rent') * 12
  const grossIncome = bldgIncome + yardIncome
  const vacancy = grossIncome * (n('vacancy_pct') / 100)
  const egi = grossIncome - vacancy
  const mgmt = egi * (n('mgmt_pct') / 100)
  const capex = n('bldg_sf') * n('capex_per_sf')
  const totalExpenses = mgmt + capex + n('taxes') + n('insurance') + n('other_expenses')
  const noi = egi - totalExpenses

  // ── PRICING ──
  const purchasePrice = n('purchase_price')
  const closingCosts = purchasePrice * (n('closing_pct') / 100)
  const allInBasis = purchasePrice + closingCosts
  const psf = n('bldg_sf') > 0 && purchasePrice > 0 ? purchasePrice / n('bldg_sf') : 0
  const basisPSF = n('bldg_sf') > 0 && allInBasis > 0 ? allInBasis / n('bldg_sf') : 0

  // ── YOC ── THE DRIVER
  const yocOnPurchase = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
  const yocOnBasis = allInBasis > 0 ? (noi / allInBasis) * 100 : 0

  // ── EXIT ──
  const exitNOI = noi * Math.pow(1 + n('rent_growth') / 100, n('hold_years'))
  const exitValue = n('exit_cap') > 0 ? exitNOI / (n('exit_cap') / 100) : 0
  const yocSpread = yocOnBasis - n('exit_cap')
  const totalCF = Array.from({ length: Math.round(n('hold_years')) }, (_, i) =>
    noi * Math.pow(1 + n('rent_growth') / 100, i + 1)).reduce((s, v) => s + v, 0)
  const moic = allInBasis > 0 ? (totalCF + exitValue) / allInBasis : 0

  // ── LEVERAGE ──
  const loanAmt = purchasePrice * (n('ltv') / 100)
  const equity = allInBasis - loanAmt
  const monthlyRate = n('interest_rate') / 100 / 12
  const ioMonths = Math.round(n('io_months'))
  const amortMonths = Math.round(n('amort_months'))
  // Annual debt service (simplified — IO then amortizing)
  const annualIO = loanAmt * (n('interest_rate') / 100)
  const annualAmort = amortMonths > 0 && monthlyRate > 0 ? (loanAmt * monthlyRate / (1 - Math.pow(1 + monthlyRate, -amortMonths))) * 12 : annualIO
  const leveredNOI = noi - annualIO // simplified first-year levered CF

  // ── IRR (Newton's method approximation) ──
  function calcIRR(cashflows) {
    if (!cashflows || cashflows.length < 2) return 0
    let guess = 0.15
    for (let i = 0; i < 100; i++) {
      let npv = 0, dnpv = 0
      for (let t = 0; t < cashflows.length; t++) {
        const pv = cashflows[t] / Math.pow(1 + guess, t)
        npv += pv
        if (t > 0) dnpv -= t * cashflows[t] / Math.pow(1 + guess, t + 1)
      }
      if (Math.abs(npv) < 0.01) break
      if (dnpv === 0) break
      guess = guess - npv / dnpv
      if (guess < -0.99) guess = -0.5
      if (guess > 10) guess = 5
    }
    return guess
  }

  // Build levered cash flows for IRR
  const yrs = Math.round(n('hold_years')) || 4
  const rg = n('rent_growth') / 100
  const ec = n('exit_cap') / 100
  const unlevCFs = [-allInBasis]
  const levCFs = [-equity]
  let outstandingLoan = loanAmt
  for (let y = 1; y <= yrs; y++) {
    const yearNOI = noi * Math.pow(1 + rg, y)
    unlevCFs.push(yearNOI)
    const ds = y * 12 <= ioMonths ? annualIO : annualAmort
    const levCF = yearNOI - ds
    if (y === yrs) {
      const exitVal = ec > 0 ? (yearNOI * (1 + rg)) / ec : 0
      const netExit = exitVal * 0.95 - outstandingLoan
      unlevCFs[y] += exitVal * 0.95
      levCFs.push(levCF + netExit)
    } else {
      levCFs.push(levCF)
    }
  }
  const unlevIRR = calcIRR(unlevCFs) * 100
  const levIRR = calcIRR(levCFs) * 100
  const levMOIC = equity > 0 ? levCFs.reduce((s, v) => s + v, 0 + equity) / equity : 0

  // ── SENSITIVITY: NOI rows vs Purchase columns → shows YOC ──
  const noiOffsets = [-30, -20, -10, 0, 10, 20, 30]
  const pricePoints = purchasePrice > 0
    ? [-20, -10, 0, 10, 20].map(p => Math.round(purchasePrice * (1 + p / 100)))
    : [500000, 750000, 1000000, 1500000, 2000000]

  const fc = (v) => v >= 0 ? '$' + Math.round(v).toLocaleString() : '-$' + Math.round(Math.abs(v)).toLocaleString()
  const compactK = (v) => Math.abs(v) >= 1000000 ? '$' + (v / 1000000).toFixed(1) + 'M' : '$' + Math.round(v / 1000).toLocaleString() + 'K'

  const is = { width: '100%', padding: '6px 8px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, color: B.black, background: B.white, outline: 'none', boxSizing: 'border-box', fontFamily: bf, textAlign: 'right' }
  const ls = { fontSize: 10, color: B.gray, fontFamily: bf, marginBottom: 1, display: 'block' }
  const F = ({ l, k, pre, suf }) => (
    <div style={{ flex: '1 1 100px', minWidth: 80 }}>
      <label style={ls}>{l}</label>
      <div style={{ position: 'relative' }}>
        {pre && <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: B.gray }}>{pre}</span>}
        <input style={{ ...is, paddingLeft: pre ? 16 : 8, paddingRight: suf ? 20 : 8 }} value={u[k]} onChange={e => set(k, e.target.value)} />
        {suf && <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: B.gray }}>{suf}</span>}
      </div>
    </div>
  )
  const row = (label, value, bold, color) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
      <span style={{ color: B.gray }}>{label}</span>
      <span style={{ color: color || B.black, fontWeight: bold ? 700 : 400, fontFamily: bold ? hf : bf }}>{value}</span>
    </div>
  )

  return (
    <div>
      {dirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={saveUnderwrite} style={{ padding: '6px 16px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: hf }}>Save underwrite</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* Left: Inputs */}
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>Income assumptions</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <F l="Building SF" k="bldg_sf" />
            <F l="Bldg rent ($/SF/yr NNN)" k="bldg_rent" pre="$" />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <F l="IOS acres (usable)" k="ios_acres" suf="ac" />
            <F l="Yard rent ($/ac/mo)" k="yard_rent" pre="$" />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <F l="Vacancy" k="vacancy_pct" suf="%" />
            <F l="Mgmt fee" k="mgmt_pct" suf="%" />
            <F l="CapEx/SF/yr" k="capex_per_sf" pre="$" />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>Expenses (annual)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <F l="RE Taxes" k="taxes" pre="$" />
            <F l="Insurance" k="insurance" pre="$" />
            <F l="Other" k="other_expenses" pre="$" />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>Pricing</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <F l="Purchase price" k="purchase_price" pre="$" />
            <F l="Closing cost %" k="closing_pct" suf="%" />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <F l="Exit cap" k="exit_cap" suf="%" />
            <F l="Rent growth" k="rent_growth" suf="%" />
            <F l="Hold (yrs)" k="hold_years" />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>Leverage</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <F l="LTV" k="ltv" suf="%" />
            <F l="Interest rate" k="interest_rate" suf="%" />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <F l="IO months" k="io_months" />
            <F l="Amort months" k="amort_months" />
          </div>
        </div>

        {/* Right: Output */}
        <div style={{ flex: '1 1 280px', minWidth: 240 }}>
          <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>NOI buildup</div>
            {row('Building income', fc(bldgIncome))}
            {yardIncome > 0 && row('IOS yard income', fc(yardIncome))}
            {row('Gross income', fc(grossIncome), true)}
            {row('Vacancy', '-' + fc(vacancy), false, B.red)}
            {row('EGI', fc(egi))}
            {row('Management', '-' + fc(mgmt), false, B.red)}
            {row('CapEx reserve', '-' + fc(capex), false, B.red)}
            {n('taxes') > 0 && row('RE Taxes', '-' + fc(n('taxes')), false, B.red)}
            {n('insurance') > 0 && row('Insurance', '-' + fc(n('insurance')), false, B.red)}
            {row('NOI', fc(noi), true, noi > 0 ? B.green : B.red)}
          </div>

          <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #2a3f5f)', borderRadius: 4, padding: 14, color: B.white, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: hf, textTransform: 'uppercase', marginBottom: 10, opacity: 0.7 }}>Yield on cost</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { l: 'NOI', v: fc(noi), c: noi > 0 ? '#2A9D8F' : '#EF4444' },
                { l: 'YOC (on purchase)', v: yocOnPurchase > 0 ? yocOnPurchase.toFixed(1) + '%' : '—', c: yocOnPurchase >= 10 ? '#2A9D8F' : yocOnPurchase >= 8 ? '#F59E0B' : '#EF4444' },
                { l: 'YOC (all-in basis)', v: yocOnBasis > 0 ? yocOnBasis.toFixed(1) + '%' : '—', c: yocOnBasis >= 10 ? '#2A9D8F' : yocOnBasis >= 8 ? '#F59E0B' : '#EF4444' },
                { l: 'YOC − Exit Cap spread', v: purchasePrice > 0 ? (yocSpread > 0 ? '+' : '') + (yocSpread * 100).toFixed(0) + ' bps' : '—', c: yocSpread >= 2 ? '#2A9D8F' : yocSpread >= 1 ? '#F59E0B' : '#EF4444' },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 9, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: item.c, fontFamily: hf }}>{item.v}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 10, paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { l: 'Unlev. IRR', v: unlevIRR > 0 ? unlevIRR.toFixed(1) + '%' : '—', c: unlevIRR >= 15 ? '#2A9D8F' : '#F59E0B' },
                { l: 'Lev. IRR', v: levIRR > 0 ? levIRR.toFixed(1) + '%' : '—', c: levIRR >= 20 ? '#2A9D8F' : levIRR >= 15 ? '#F59E0B' : '#EF4444' },
                { l: 'Lev. MOIC', v: levMOIC > 0 ? levMOIC.toFixed(2) + 'x' : '—', c: levMOIC >= 2 ? '#2A9D8F' : '#F59E0B' },
                { l: 'Loan', v: loanAmt > 0 ? fc(loanAmt) : '—', c: '#8892a4' },
                { l: 'Equity', v: equity > 0 ? fc(equity) : '—', c: '#fff' },
                { l: 'Debt Service (yr1)', v: annualIO > 0 ? fc(annualIO) : '—', c: '#8892a4' },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 9, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: item.c, fontFamily: hf }}>{item.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* YEARLY CASH FLOW */}
      {purchasePrice > 0 && noi !== 0 && (() => {
        const yrs2 = Math.round(n('hold_years')) || 4
        const rg2 = n('rent_growth') / 100
        const ec2 = n('exit_cap') / 100
        const rows = []
        let oloan = loanAmt
        for (let y = 0; y <= yrs2; y++) {
          const yearNOI = y === 0 ? 0 : noi * Math.pow(1 + rg2, y)
          const acqCost = y === 0 ? -allInBasis : 0
          const exitProc = y === yrs2 && ec2 > 0 ? (noi * Math.pow(1 + rg2, yrs2) * (1 + rg2)) / ec2 * 0.95 : 0
          const ds = y === 0 ? 0 : annualIO
          const loanDraw = y === 0 ? loanAmt : 0
          const loanRepay = y === yrs2 ? -oloan : 0
          const unlevCF = yearNOI + acqCost + exitProc
          const levCF = yearNOI + (y === 0 ? (-equity) : 0) - ds + (y === yrs2 ? exitProc + loanRepay : 0)
          rows.push({ y, noi: yearNOI, acq: acqCost, exit: exitProc, ds, loanDraw, loanRepay, unlevCF, levCF })
        }
        const totNOI = rows.reduce((s, r) => s + r.noi, 0)
        const totUnlev = rows.reduce((s, r) => s + r.unlevCF, 0)
        const totLev = rows.reduce((s, r) => s + r.levCF, 0)
        const th2 = { background: '#1a1a2e', color: '#fff', padding: '4px 6px', fontSize: 9, fontFamily: hf, textAlign: 'right', whiteSpace: 'nowrap' }
        const td2 = (bold, color) => ({ padding: '3px 6px', fontSize: 10, fontFamily: bold ? hf : bf, textAlign: 'right', borderBottom: `1px solid ${B.gray10}`, color: color || B.black, fontWeight: bold ? 700 : 400 })
        const R = (label, getter, bold, color) => (
          <tr style={bold ? { background: '#f8f9fb' } : {}}>
            <td style={{ padding: '3px 6px', fontSize: 10, fontFamily: bold ? hf : bf, fontWeight: bold ? 700 : 400, borderBottom: `1px solid ${bold ? B.gray20 : B.gray10}`, color: bold ? B.blue : B.gray, whiteSpace: 'nowrap' }}>{label}</td>
            {rows.map(r => { const v = getter(r); return <td key={r.y} style={td2(bold, typeof color === 'function' ? color(v) : color)}>{v ? fc(v) : '—'}</td> })}
            <td style={td2(true, typeof color === 'function' ? color(rows.reduce((s, r) => s + getter(r), 0)) : color)}>{fc(rows.reduce((s, r) => s + getter(r), 0))}</td>
          </tr>
        )
        return (
          <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 10, overflowX: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>Cash flow summary</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ ...th2, textAlign: 'left' }}></th>
                {rows.map(r => <th key={r.y} style={th2}>{r.y === 0 ? 'Yr 0' : `Yr ${r.y}`}</th>)}
                <th style={{ ...th2, background: '#2A9D8F' }}>Total</th>
              </tr></thead>
              <tbody>
                {R('NOI', r => r.noi, false)}
                {R('Acquisition', r => r.acq, false, v => v < 0 ? B.red : undefined)}
                {R('Sale Proceeds', r => r.exit, false, v => v > 0 ? '#065F46' : undefined)}
                {R('Unlevered CF', r => r.unlevCF, true, v => v >= 0 ? '#065F46' : B.red)}
                <tr><td colSpan={rows.length + 2} style={{ padding: 2, borderBottom: `2px solid ${B.gray20}` }}></td></tr>
                {R('Debt Service', r => r.ds ? -r.ds : 0, false, v => v < 0 ? B.red : undefined)}
                {R('Loan Draw / Repay', r => r.loanDraw + r.loanRepay, false, v => v < 0 ? B.red : v > 0 ? '#065F46' : undefined)}
                {R('Levered CF', r => r.levCF, true, v => v >= 0 ? '#065F46' : B.red)}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 16, fontSize: 10, color: B.gray, fontFamily: bf, marginTop: 6, flexWrap: 'wrap' }}>
              <span>Unlev IRR: <strong style={{ color: B.blue, fontFamily: hf }}>{unlevIRR > 0 ? unlevIRR.toFixed(1) + '%' : '—'}</strong></span>
              <span>Lev IRR: <strong style={{ color: B.blue, fontFamily: hf }}>{levIRR > 0 ? levIRR.toFixed(1) + '%' : '—'}</strong></span>
              <span>Lev MOIC: <strong style={{ color: B.blue, fontFamily: hf }}>{levMOIC > 0 ? levMOIC.toFixed(2) + 'x' : '—'}</strong></span>
              <span>Unlev MOIC: <strong style={{ color: B.gray, fontFamily: hf }}>{allInBasis > 0 ? ((totUnlev + allInBasis) / allInBasis).toFixed(2) + 'x' : '—'}</strong></span>
            </div>
          </div>
        )
      })()}

      {/* SENSITIVITY: YOC by NOI vs Purchase Price */}
      <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 10, overflowX: 'auto' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>
          YOC sensitivity — NOI vs purchase price
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: bf }}>
          <thead>
            <tr>
              <th style={{ background: '#1a1a2e', color: B.white, padding: '5px 6px', fontSize: 9, fontFamily: hf, textAlign: 'left' }}>NOI \ Purchase</th>
              {pricePoints.map(pp => {
                const bPSF = n('bldg_sf') > 0 ? pp / n('bldg_sf') : 0
                const allIn = pp * (1 + n('closing_pct') / 100)
                const aBPSF = n('bldg_sf') > 0 ? allIn / n('bldg_sf') : 0
                return (
                  <th key={pp} style={{ background: '#1a1a2e', color: B.white, padding: '5px 4px', fontSize: 9, fontFamily: hf, textAlign: 'center' }}>
                    {compactK(pp)}<br />
                    <span style={{ fontSize: 8, color: '#8892a4' }}>${bPSF.toFixed(0)}/SF [${aBPSF.toFixed(0)}]</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {noiOffsets.map(offset => {
              const adjNOI = noi * (1 + offset / 100)
              const isBase = offset === 0
              return (
                <tr key={offset}>
                  <td style={{ background: '#f8f9fb', fontWeight: 700, padding: '4px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf, fontSize: 10, whiteSpace: 'nowrap' }}>
                    {fc(adjNOI)} <span style={{ fontSize: 8, color: B.gray }}>{offset > 0 ? '+' : ''}{offset}%</span>
                  </td>
                  {pricePoints.map(pp => {
                    const allIn = pp * (1 + n('closing_pct') / 100)
                    const yoc = allIn > 0 ? (adjNOI / allIn) * 100 : 0
                    const yocPurch = pp > 0 ? (adjNOI / pp) * 100 : 0
                    const isBaseCell = isBase && pp === purchasePrice
                    const bg = isBaseCell ? '#2A9D8F' : yoc >= 10 ? '#D1FAE5' : yoc >= 8 ? '#FEF3C7' : yoc >= 6 ? '#FEE2E2' : '#FCA5A5'
                    const tc = isBaseCell ? '#fff' : yoc >= 10 ? '#065F46' : yoc >= 8 ? '#92400E' : '#991B1B'
                    return (
                      <td key={pp} style={{ padding: '4px 4px', textAlign: 'center', borderBottom: `1px solid ${B.gray20}`, background: bg, color: tc, fontWeight: isBaseCell || yoc >= 10 ? 700 : 400, fontSize: 10 }}>
                        {yoc.toFixed(1)}%
                        <span style={{ fontSize: 8, display: 'block', opacity: 0.7 }}>({yocPurch.toFixed(1)}%)</span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 9, color: B.gray60, fontFamily: bf, marginTop: 4 }}>
          Top = YOC on all-in basis. (Bottom) = YOC on purchase price. Column headers show $/SF [all-in $/SF]. Green 10%+. Yellow 8-10%. Red below 8%.
        </div>
      </div>

      {/* Flags */}
      <div style={{ background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>Key flags & due diligence</div>
        {flags.map(f => (
          <div key={f.id} style={{
            padding: '6px 10px', borderRadius: 4, marginBottom: 4, fontSize: 11, fontFamily: bf, lineHeight: 1.5,
            background: f.type === 'GREEN' ? '#D1FAE5' : f.type === 'YELLOW' ? '#FEF3C7' : '#FEE2E2',
            borderLeft: `3px solid ${f.type === 'GREEN' ? '#10B981' : f.type === 'YELLOW' ? '#F59E0B' : '#EF4444'}`,
            color: f.type === 'GREEN' ? '#065F46' : f.type === 'YELLOW' ? '#92400E' : '#991B1B',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}>
            <span>{f.type === 'GREEN' ? '✅' : f.type === 'YELLOW' ? '⚠️' : '🚫'} {f.text}</span>
            <button onClick={() => setFlags(p => p.filter(x => x.id !== f.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, padding: '0 4px', flexShrink: 0 }}>x</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <select value={newFlag.type} onChange={e => setNewFlag(p => ({ ...p, type: e.target.value }))} style={{ padding: '4px 6px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 11, fontFamily: bf }}>
            <option value="GREEN">✅ Green</option>
            <option value="YELLOW">⚠️ Yellow</option>
            <option value="RED">🚫 Red</option>
          </select>
          <input style={{ flex: 1, padding: '4px 8px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 11, fontFamily: bf, outline: 'none' }} placeholder="Add a flag..." value={newFlag.text} onChange={e => setNewFlag(p => ({ ...p, text: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && newFlag.text.trim()) { setFlags(p => [...p, { ...newFlag, id: Date.now() }]); setNewFlag({ type: 'GREEN', text: '' }) } }} />
          <button onClick={() => { if (newFlag.text.trim()) { setFlags(p => [...p, { ...newFlag, id: Date.now() }]); setNewFlag({ type: 'GREEN', text: '' }) } }} disabled={!newFlag.text.trim()} style={{ padding: '4px 10px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: newFlag.text.trim() ? 1 : 0.4 }}>Add</button>
        </div>
      </div>
    </div>
  )
}
