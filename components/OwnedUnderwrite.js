import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, fmt } from '../lib/brand'

export default function OwnedUnderwrite({ deal }) {
  const [transactions, setTransactions] = useState([])
  const [recurring, setRecurring] = useState([])
  const saved = (() => { try { return JSON.parse(deal.owned_underwrite_data || '{}') } catch { return {} } })()

  const [mode, setMode] = useState(saved.mode || 'sell') // sell | lease_then_sell
  const [dirty, setDirty] = useState(false)
  const [u, setU] = useState({
    // Acquisition (auto-filled from deal but editable)
    purchase_price: saved.purchase_price || deal.purchase_price || deal.asking_price || '',
    closing_costs: saved.closing_costs || '',
    capex_to_date: saved.capex_to_date || '',
    other_costs: saved.other_costs || '',
    close_date: saved.close_date || deal.purchase_date || '2025-09-02',
    // Debt
    loan_balance: saved.loan_balance || '',
    interest_rate: saved.interest_rate || '6.5',
    io_months: saved.io_months || '12',
    amort_months: saved.amort_months || '300',
    annual_debt_service: saved.annual_debt_service || '',
    // Sell scenario
    sale_price: saved.sale_price || '',
    sale_cost_pct: saved.sale_cost_pct || '5',
    projected_sale_date: saved.projected_sale_date || '',
    // Lease scenario
    bldg_sf: saved.bldg_sf || deal.building_sf || '',
    bldg_rent: saved.bldg_rent || '',
    ios_acres: saved.ios_acres || '',
    yard_rent: saved.yard_rent || '',
    vacancy_pct: saved.vacancy_pct || '5',
    mgmt_pct: saved.mgmt_pct || '4',
    capex_per_sf: saved.capex_per_sf || '0.20',
    taxes: saved.taxes || '',
    insurance: saved.insurance || '',
    other_expenses: saved.other_expenses || '',
    rent_growth: saved.rent_growth || '3',
    exit_cap: saved.exit_cap || '8.0',
    hold_years: saved.hold_years || '3',
    lease_up_months: saved.lease_up_months || '6',
    ti_per_sf: saved.ti_per_sf || '5',
    lc_pct: saved.lc_pct || '4',
    // Monthly holding costs override (if not using recurring table)
    monthly_hold_cost: saved.monthly_hold_cost || '',
  })

  const set = (k, v) => { setU(p => ({ ...p, [k]: v })); setDirty(true) }
  const n = (k) => { const v = String(u[k] || '').replace(/,/g, ''); return parseFloat(v) || 0 }

  const fetchTransactions = useCallback(async () => {
    if (!deal?.id) return
    const { data } = await supabase.from('transactions').select('*').eq('deal_id', deal.id).order('date', { ascending: false })
    if (data) setTransactions(data)
  }, [deal?.id])

  const fetchRecurring = useCallback(async () => {
    if (!deal?.id) return
    const { data } = await supabase.from('recurring_expenses').select('*').eq('deal_id', deal.id).order('name')
    if (data) setRecurring(data)
  }, [deal?.id])

  useEffect(() => { fetchTransactions(); fetchRecurring() }, [fetchTransactions, fetchRecurring])

  const saveUnderwrite = async () => {
    const payload = { ...u, mode }
    await supabase.from('deals').update({ owned_underwrite_data: JSON.stringify(payload) }).eq('id', deal.id)
    setDirty(false)
  }

  // ── COMPUTED: actual costs to date ──
  const purchasePrice = n('purchase_price')
  const closingCosts = n('closing_costs')
  const capexToDate = n('capex_to_date')
  const otherCosts = n('other_costs')
  const totalBasis = purchasePrice + closingCosts + capexToDate + otherCosts

  // Actual expenses from transactions
  const actualExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const actualIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)

  // Monthly hold from recurring or override
  const monthlyRecurring = recurring.filter(r => r.is_active !== false).reduce((s, r) => {
    if (r.frequency === 'monthly') return s + Number(r.amount)
    if (r.frequency === 'quarterly') return s + Number(r.amount) / 3
    if (r.frequency === 'annual') return s + Number(r.amount) / 12
    return s
  }, 0)
  const monthlyHold = n('monthly_hold_cost') > 0 ? n('monthly_hold_cost') : monthlyRecurring

  // Hold period from close date
  const closeDate = new Date(u.close_date || '2025-09-02')
  const today = new Date()
  const monthsHeld = Math.max(1, Math.round((today - closeDate) / (1000 * 60 * 60 * 24 * 30.44)))
  const holdCostToDate = monthlyHold * monthsHeld

  // Debt
  const loanBal = n('loan_balance')
  const annualDS = n('annual_debt_service') > 0 ? n('annual_debt_service') : loanBal * (n('interest_rate') / 100)

  // ── SELL SCENARIO ──
  const salePrice = n('sale_price')
  const saleCosts = salePrice * (n('sale_cost_pct') / 100)
  const netSaleProceeds = salePrice - saleCosts
  const netAfterDebt = netSaleProceeds - loanBal

  // Total equity invested = basis - loan
  const equityInvested = totalBasis - loanBal + holdCostToDate
  const equityInvestedUnlev = totalBasis + holdCostToDate

  // Profit
  const grossProfit = netSaleProceeds - totalBasis - holdCostToDate + actualIncome
  const grossProfitAfterDebt = netAfterDebt - (totalBasis - loanBal) - holdCostToDate + actualIncome - (annualDS * monthsHeld / 12)

  // MOIC
  const unlevMOIC = equityInvestedUnlev > 0 ? (netSaleProceeds + actualIncome) / equityInvestedUnlev : 0
  const levMOIC = equityInvested > 0 ? (netAfterDebt + actualIncome - (annualDS * monthsHeld / 12)) / (totalBasis - loanBal) : 0

  // IRR (Newton's method)
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

  // Build sell IRR cash flows (quarterly periods for precision, annualized)
  const holdYearsActual = monthsHeld / 12
  const holdYearsRounded = Math.max(1, Math.ceil(holdYearsActual))

  // Unlevered sell IRR: year 0 = -totalBasis, interim years = -holdCosts + income, final year = net sale proceeds - hold costs + income
  const sellUnlevCFs = [-totalBasis]
  const sellLevCFs = [-(totalBasis - loanBal)]
  for (let y = 1; y <= holdYearsRounded; y++) {
    const holdCost = monthlyHold * 12
    const income = actualIncome / holdYearsRounded // spread evenly
    if (y === holdYearsRounded) {
      sellUnlevCFs.push(-holdCost + income + netSaleProceeds)
      sellLevCFs.push(-holdCost - annualDS + income + netAfterDebt)
    } else {
      sellUnlevCFs.push(-holdCost + income)
      sellLevCFs.push(-holdCost - annualDS + income)
    }
  }
  const sellUnlevIRR = salePrice > 0 ? calcIRR(sellUnlevCFs) * 100 : 0
  const sellLevIRR = salePrice > 0 && loanBal > 0 ? calcIRR(sellLevCFs) * 100 : 0

  // ── LEASE THEN SELL SCENARIO ──
  const bldgIncome = n('bldg_sf') * n('bldg_rent')
  const yardIncome = n('ios_acres') * n('yard_rent') * 12
  const grossIncome = bldgIncome + yardIncome
  const vacancy = grossIncome * (n('vacancy_pct') / 100)
  const egi = grossIncome - vacancy
  const mgmt = egi * (n('mgmt_pct') / 100)
  const capexRes = n('bldg_sf') * n('capex_per_sf')
  const totalOpex = mgmt + capexRes + n('taxes') + n('insurance') + n('other_expenses')
  const noi = egi - totalOpex

  const tiCost = n('bldg_sf') * n('ti_per_sf')
  const lcCost = bldgIncome * (n('lc_pct') / 100) * 5 // 5yr lease
  const leaseUpCost = tiCost + lcCost
  const leaseUpMonths = n('lease_up_months')

  const exitCap = n('exit_cap') / 100
  const holdYrs = Math.round(n('hold_years')) || 3
  const rentGrowth = n('rent_growth') / 100
  const exitNOI = noi * Math.pow(1 + rentGrowth, holdYrs)
  const exitValue = exitCap > 0 ? exitNOI / exitCap : 0
  const exitNet = exitValue * 0.95

  // Lease scenario cash flows
  const leaseUnlevCFs = [-totalBasis - leaseUpCost]
  const leaseLevCFs = [-(totalBasis - loanBal) - leaseUpCost]
  for (let y = 1; y <= holdYrs; y++) {
    const yrNOI = y === 1 ? noi * (1 - leaseUpMonths / 12) : noi * Math.pow(1 + rentGrowth, y - 1)
    const holdCost = y <= Math.ceil(monthsHeld / 12) ? 0 : 0 // future hold costs captured in opex
    if (y === holdYrs) {
      leaseUnlevCFs.push(yrNOI + exitNet)
      leaseLevCFs.push(yrNOI - annualDS + exitNet - loanBal)
    } else {
      leaseUnlevCFs.push(yrNOI)
      leaseLevCFs.push(yrNOI - annualDS)
    }
  }
  const leaseUnlevIRR = noi > 0 ? calcIRR(leaseUnlevCFs) * 100 : 0
  const leaseLevIRR = noi > 0 && loanBal > 0 ? calcIRR(leaseLevCFs) * 100 : 0
  const leaseUnlevMOIC = (totalBasis + leaseUpCost) > 0 ? leaseUnlevCFs.reduce((s, v) => s + v, 0 + totalBasis + leaseUpCost) / (totalBasis + leaseUpCost) : 0
  const leaseLevMOIC = (totalBasis - loanBal + leaseUpCost) > 0 ? leaseLevCFs.reduce((s, v) => s + v, 0 + totalBasis - loanBal + leaseUpCost) / (totalBasis - loanBal + leaseUpCost) : 0

  // YOC
  const yocOnBasis = totalBasis > 0 ? (noi / totalBasis) * 100 : 0
  const yocSpread = yocOnBasis - n('exit_cap')

  // ── SENSITIVITY: Sale Price sensitivity ──
  const salePriceOffsets = [-20, -10, -5, 0, 5, 10, 20]

  const fc = (v) => v >= 0 ? '$' + Math.round(v).toLocaleString() : '-$' + Math.round(Math.abs(v)).toLocaleString()
  const pct = (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '%'
  const xfmt = (v) => v.toFixed(2) + 'x'

  const is = { width: '100%', padding: '6px 8px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, color: B.black, background: B.white, outline: 'none', boxSizing: 'border-box', fontFamily: bf, textAlign: 'right' }
  const ls = { fontSize: 10, color: B.gray, fontFamily: bf, marginBottom: 1, display: 'block' }
  const F = ({ l, k, pre, suf, disabled }) => (
    <div style={{ flex: '1 1 100px', minWidth: 80 }}>
      <label style={ls}>{l}</label>
      <div style={{ position: 'relative' }}>
        {pre && <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: B.gray }}>{pre}</span>}
        <input style={{ ...is, paddingLeft: pre ? 16 : 8, paddingRight: suf ? 20 : 8, background: disabled ? '#f5f5f5' : B.white }} value={u[k]} onChange={e => set(k, e.target.value)} disabled={disabled} />
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
  const box = { background: B.white, borderRadius: 4, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 10 }
  const secTitle = (t) => <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>{t}</div>

  return (
    <div>
      {/* Mode toggle + Save */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', background: B.gray10, borderRadius: 4, overflow: 'hidden' }}>
          {[{ id: 'sell', label: 'Sell Now' }, { id: 'lease_then_sell', label: 'Lease → Stabilize → Sell' }].map(m => (
            <button key={m.id} onClick={() => { setMode(m.id); setDirty(true) }} style={{
              padding: '8px 18px', fontSize: 12, fontWeight: mode === m.id ? 700 : 400, fontFamily: hf,
              color: mode === m.id ? B.white : B.gray, background: mode === m.id ? B.blue : 'transparent',
              border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.4,
            }}>{m.label}</button>
          ))}
        </div>
        {dirty && <button onClick={saveUnderwrite} style={{ padding: '6px 16px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: hf }}>Save underwrite</button>}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* LEFT: Inputs */}
        <div style={{ flex: '1 1 340px', minWidth: 300 }}>
          {/* Basis */}
          <div style={box}>
            {secTitle('Total basis (actual)')}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <F l="Purchase price" k="purchase_price" pre="$" />
              <F l="Closing costs" k="closing_costs" pre="$" />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <F l="CapEx to date" k="capex_to_date" pre="$" />
              <F l="Other costs" k="other_costs" pre="$" />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <F l="Close date" k="close_date" />
              <F l="Monthly hold cost" k="monthly_hold_cost" pre="$" />
            </div>
            <div style={{ marginTop: 8, padding: '6px 10px', background: '#EFF6FF', borderRadius: 3, fontSize: 11, fontFamily: bf }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: B.gray }}>All-in basis</span>
                <span style={{ fontWeight: 700, color: B.blue, fontFamily: hf }}>{fc(totalBasis)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: B.gray }}>Hold costs ({monthsHeld} mo)</span>
                <span style={{ fontWeight: 600, color: B.red }}>{fc(holdCostToDate)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${B.gray20}`, marginTop: 4, paddingTop: 4 }}>
                <span style={{ color: B.gray }}>Total cost to date</span>
                <span style={{ fontWeight: 700, color: B.blue, fontFamily: hf }}>{fc(totalBasis + holdCostToDate)}</span>
              </div>
              {n('bldg_sf') > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ color: B.gray }}>All-in $/SF</span>
                <span style={{ fontWeight: 600, color: B.black }}>${(totalBasis / n('bldg_sf')).toFixed(0)}</span>
              </div>}
            </div>
          </div>

          {/* Debt */}
          <div style={box}>
            {secTitle('Debt')}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <F l="Current loan balance" k="loan_balance" pre="$" />
              <F l="Interest rate" k="interest_rate" suf="%" />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <F l="Annual debt service" k="annual_debt_service" pre="$" />
              <F l="IO months" k="io_months" />
              <F l="Amort months" k="amort_months" />
            </div>
            {loanBal > 0 && <div style={{ marginTop: 6, fontSize: 11, fontFamily: bf, color: B.gray }}>
              LTV at purchase: <strong style={{ color: B.black }}>{purchasePrice > 0 ? ((loanBal / purchasePrice) * 100).toFixed(0) + '%' : '—'}</strong>
              &nbsp;&middot;&nbsp; Equity: <strong style={{ color: B.black }}>{fc(totalBasis - loanBal)}</strong>
            </div>}
          </div>

          {/* Sell inputs */}
          {mode === 'sell' && (
            <div style={box}>
              {secTitle('Sale assumptions')}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <F l="Projected sale price" k="sale_price" pre="$" />
                <F l="Sale cost %" k="sale_cost_pct" suf="%" />
              </div>
            </div>
          )}

          {/* Lease inputs */}
          {mode === 'lease_then_sell' && (
            <>
              <div style={box}>
                {secTitle('Lease assumptions')}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <F l="Building SF" k="bldg_sf" />
                  <F l="Bldg rent ($/SF/yr NNN)" k="bldg_rent" pre="$" />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <F l="IOS acres (usable)" k="ios_acres" suf="ac" />
                  <F l="Yard rent ($/ac/mo)" k="yard_rent" pre="$" />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <F l="Vacancy" k="vacancy_pct" suf="%" />
                  <F l="Mgmt fee" k="mgmt_pct" suf="%" />
                  <F l="CapEx/SF/yr" k="capex_per_sf" pre="$" />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <F l="RE Taxes (annual)" k="taxes" pre="$" />
                  <F l="Insurance (annual)" k="insurance" pre="$" />
                  <F l="Other (annual)" k="other_expenses" pre="$" />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <F l="Lease-up months" k="lease_up_months" />
                  <F l="TI ($/SF)" k="ti_per_sf" pre="$" />
                  <F l="LC (% of rent × 5yr)" k="lc_pct" suf="%" />
                </div>
              </div>
              <div style={box}>
                {secTitle('Exit assumptions')}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <F l="Exit cap" k="exit_cap" suf="%" />
                  <F l="Rent growth" k="rent_growth" suf="%" />
                  <F l="Hold (years from today)" k="hold_years" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Output */}
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          {/* Status snapshot */}
          <div style={{ ...box, background: '#FFFBEB', borderColor: '#F59E0B' }}>
            {secTitle('Current position')}
            {row('Purchase price', fc(purchasePrice))}
            {row('All-in basis', fc(totalBasis), true)}
            {row('Hold costs to date (' + monthsHeld + ' mo)', fc(holdCostToDate), false, B.red)}
            {row('Total cost to date', fc(totalBasis + holdCostToDate), true, B.blue)}
            {actualIncome > 0 && row('Income received', fc(actualIncome), false, '#065F46')}
            {loanBal > 0 && row('Loan outstanding', fc(loanBal))}
            {loanBal > 0 && row('Equity at risk', fc(totalBasis - loanBal + holdCostToDate), true)}
            {n('bldg_sf') > 0 && row('All-in $/SF', '$' + (totalBasis / n('bldg_sf')).toFixed(0))}
            {n('bldg_sf') > 0 && row('Total cost $/SF', '$' + ((totalBasis + holdCostToDate) / n('bldg_sf')).toFixed(0), true)}
          </div>

          {/* Sell output */}
          {mode === 'sell' && salePrice > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #2a3f5f)', borderRadius: 4, padding: 14, color: B.white, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: hf, textTransform: 'uppercase', marginBottom: 10, opacity: 0.7 }}>Sell scenario</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {[
                  { l: 'Gross sale price', v: fc(salePrice), c: '#fff' },
                  { l: 'Net proceeds', v: fc(netSaleProceeds), c: '#fff' },
                  { l: 'Gross profit', v: fc(grossProfit), c: grossProfit >= 0 ? '#2A9D8F' : '#EF4444' },
                  { l: 'Net after debt', v: loanBal > 0 ? fc(netAfterDebt) : 'No debt', c: netAfterDebt >= 0 ? '#2A9D8F' : '#EF4444' },
                ].map((item, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 9, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.l}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: item.c, fontFamily: hf }}>{item.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                {[
                  { l: 'Unlev. IRR', v: sellUnlevIRR !== 0 ? pct(sellUnlevIRR) : '—', c: sellUnlevIRR >= 15 ? '#2A9D8F' : sellUnlevIRR >= 0 ? '#F59E0B' : '#EF4444' },
                  { l: 'Lev. IRR', v: sellLevIRR !== 0 ? pct(sellLevIRR) : '—', c: sellLevIRR >= 20 ? '#2A9D8F' : sellLevIRR >= 0 ? '#F59E0B' : '#EF4444' },
                  { l: 'Unlev. MOIC', v: unlevMOIC > 0 ? xfmt(unlevMOIC) : '—', c: unlevMOIC >= 1.5 ? '#2A9D8F' : '#F59E0B' },
                  { l: 'Lev. MOIC', v: levMOIC > 0 ? xfmt(levMOIC) : '—', c: levMOIC >= 2 ? '#2A9D8F' : '#F59E0B' },
                ].map((item, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 9, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.l}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: item.c, fontFamily: hf }}>{item.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: '#8892a4', fontFamily: bf }}>
                Hold period: {monthsHeld} months &middot; Sale costs: {n('sale_cost_pct')}% ({fc(saleCosts)})
              </div>
            </div>
          )}

          {/* Sell sensitivity */}
          {mode === 'sell' && salePrice > 0 && (
            <div style={{ ...box, overflowX: 'auto' }}>
              {secTitle('Sale price sensitivity')}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: bf }}>
                <thead>
                  <tr>
                    <th style={{ background: '#1a1a2e', color: '#fff', padding: '5px 6px', fontSize: 9, fontFamily: hf, textAlign: 'left' }}>Sale Price</th>
                    <th style={{ background: '#1a1a2e', color: '#fff', padding: '5px 6px', fontSize: 9, fontFamily: hf, textAlign: 'right' }}>Net</th>
                    <th style={{ background: '#1a1a2e', color: '#fff', padding: '5px 6px', fontSize: 9, fontFamily: hf, textAlign: 'right' }}>Profit</th>
                    <th style={{ background: '#1a1a2e', color: '#fff', padding: '5px 6px', fontSize: 9, fontFamily: hf, textAlign: 'right' }}>Unlev IRR</th>
                    <th style={{ background: '#1a1a2e', color: '#fff', padding: '5px 6px', fontSize: 9, fontFamily: hf, textAlign: 'right' }}>Lev IRR</th>
                    <th style={{ background: '#1a1a2e', color: '#fff', padding: '5px 6px', fontSize: 9, fontFamily: hf, textAlign: 'right' }}>MOIC</th>
                  </tr>
                </thead>
                <tbody>
                  {salePriceOffsets.map(offset => {
                    const sp = Math.round(salePrice * (1 + offset / 100))
                    const sc = sp * (n('sale_cost_pct') / 100)
                    const np = sp - sc
                    const profit = np - totalBasis - holdCostToDate + actualIncome
                    const isBase = offset === 0
                    // Quick IRR for this sale price
                    const cfs = [-totalBasis]
                    for (let y = 1; y <= holdYearsRounded; y++) {
                      if (y === holdYearsRounded) cfs.push(-monthlyHold * 12 + np)
                      else cfs.push(-monthlyHold * 12)
                    }
                    const irr = calcIRR(cfs) * 100
                    const moic = equityInvestedUnlev > 0 ? (np + actualIncome) / equityInvestedUnlev : 0
                    const bg = isBase ? '#EFF6FF' : undefined
                    return (
                      <tr key={offset} style={{ background: bg }}>
                        <td style={{ padding: '4px 6px', borderBottom: `1px solid ${B.gray20}`, fontWeight: isBase ? 700 : 400 }}>
                          {fc(sp)} <span style={{ fontSize: 8, color: B.gray }}>{offset > 0 ? '+' : ''}{offset}%</span>
                        </td>
                        <td style={{ padding: '4px 6px', borderBottom: `1px solid ${B.gray20}`, textAlign: 'right' }}>{fc(np)}</td>
                        <td style={{ padding: '4px 6px', borderBottom: `1px solid ${B.gray20}`, textAlign: 'right', color: profit >= 0 ? '#065F46' : B.red, fontWeight: 600 }}>{fc(profit)}</td>
                        <td style={{ padding: '4px 6px', borderBottom: `1px solid ${B.gray20}`, textAlign: 'right', color: irr >= 15 ? '#065F46' : irr >= 0 ? '#92400E' : B.red }}>{irr !== 0 ? pct(irr) : '—'}</td>
                        <td style={{ padding: '4px 6px', borderBottom: `1px solid ${B.gray20}`, textAlign: 'right' }}>—</td>
                        <td style={{ padding: '4px 6px', borderBottom: `1px solid ${B.gray20}`, textAlign: 'right', color: moic >= 1.5 ? '#065F46' : '#92400E' }}>{moic > 0 ? xfmt(moic) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Lease output */}
          {mode === 'lease_then_sell' && (
            <>
              <div style={box}>
                {secTitle('NOI buildup')}
                {row('Building income', fc(bldgIncome))}
                {yardIncome > 0 && row('IOS yard income', fc(yardIncome))}
                {row('Gross income', fc(grossIncome), true)}
                {row('Vacancy', '-' + fc(vacancy), false, B.red)}
                {row('EGI', fc(egi))}
                {row('Management', '-' + fc(mgmt), false, B.red)}
                {row('CapEx reserve', '-' + fc(capexRes), false, B.red)}
                {n('taxes') > 0 && row('RE Taxes', '-' + fc(n('taxes')), false, B.red)}
                {n('insurance') > 0 && row('Insurance', '-' + fc(n('insurance')), false, B.red)}
                {row('NOI', fc(noi), true, noi > 0 ? '#065F46' : B.red)}
              </div>

              <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #2a3f5f)', borderRadius: 4, padding: 14, color: B.white, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: hf, textTransform: 'uppercase', marginBottom: 10, opacity: 0.7 }}>Lease → sell returns</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {[
                    { l: 'Stabilized NOI', v: fc(noi), c: noi > 0 ? '#2A9D8F' : '#EF4444' },
                    { l: 'YOC on basis', v: yocOnBasis > 0 ? yocOnBasis.toFixed(1) + '%' : '—', c: yocOnBasis >= 10 ? '#2A9D8F' : yocOnBasis >= 8 ? '#F59E0B' : '#EF4444' },
                    { l: 'Exit value (yr ' + holdYrs + ')', v: exitValue > 0 ? fc(exitValue) : '—', c: '#fff' },
                    { l: 'YOC − Cap spread', v: yocOnBasis > 0 ? (yocSpread > 0 ? '+' : '') + (yocSpread * 100).toFixed(0) + ' bps' : '—', c: yocSpread >= 2 ? '#2A9D8F' : yocSpread >= 1 ? '#F59E0B' : '#EF4444' },
                    { l: 'Lease-up cost', v: fc(leaseUpCost), c: '#8892a4' },
                    { l: 'Total basis + TI/LC', v: fc(totalBasis + leaseUpCost), c: '#fff' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 9, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.l}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: item.c, fontFamily: hf }}>{item.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { l: 'Unlev. IRR', v: leaseUnlevIRR !== 0 ? pct(leaseUnlevIRR) : '—', c: leaseUnlevIRR >= 15 ? '#2A9D8F' : leaseUnlevIRR >= 0 ? '#F59E0B' : '#EF4444' },
                    { l: 'Lev. IRR', v: leaseLevIRR !== 0 ? pct(leaseLevIRR) : '—', c: leaseLevIRR >= 20 ? '#2A9D8F' : leaseLevIRR >= 0 ? '#F59E0B' : '#EF4444' },
                    { l: 'Unlev. MOIC', v: leaseUnlevMOIC > 0 ? xfmt(leaseUnlevMOIC) : '—', c: leaseUnlevMOIC >= 1.5 ? '#2A9D8F' : '#F59E0B' },
                    { l: 'Lev. MOIC', v: leaseLevMOIC > 0 ? xfmt(leaseLevMOIC) : '—', c: leaseLevMOIC >= 2 ? '#2A9D8F' : '#F59E0B' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 9, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.l}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: item.c, fontFamily: hf }}>{item.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lease scenario yearly cash flow */}
              {noi > 0 && (
                <div style={{ ...box, overflowX: 'auto' }}>
                  {secTitle('Cash flow projection')}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th style={{ background: '#1a1a2e', color: '#fff', padding: '4px 6px', fontSize: 9, fontFamily: hf, textAlign: 'left' }}></th>
                      {leaseUnlevCFs.map((_, i) => <th key={i} style={{ background: '#1a1a2e', color: '#fff', padding: '4px 6px', fontSize: 9, fontFamily: hf, textAlign: 'right' }}>{i === 0 ? 'Yr 0' : `Yr ${i}`}</th>)}
                      <th style={{ background: '#2A9D8F', color: '#fff', padding: '4px 6px', fontSize: 9, fontFamily: hf, textAlign: 'right' }}>Total</th>
                    </tr></thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '3px 6px', fontSize: 10, fontFamily: hf, fontWeight: 700, color: B.blue, borderBottom: `1px solid ${B.gray20}` }}>Unlevered CF</td>
                        {leaseUnlevCFs.map((v, i) => <td key={i} style={{ padding: '3px 6px', fontSize: 10, fontFamily: bf, textAlign: 'right', borderBottom: `1px solid ${B.gray20}`, color: v >= 0 ? '#065F46' : B.red }}>{fc(v)}</td>)}
                        <td style={{ padding: '3px 6px', fontSize: 10, fontFamily: hf, fontWeight: 700, textAlign: 'right', borderBottom: `1px solid ${B.gray20}`, color: B.blue }}>{fc(leaseUnlevCFs.reduce((s, v) => s + v, 0))}</td>
                      </tr>
                      {loanBal > 0 && <tr>
                        <td style={{ padding: '3px 6px', fontSize: 10, fontFamily: hf, fontWeight: 700, color: B.blue, borderBottom: `1px solid ${B.gray20}` }}>Levered CF</td>
                        {leaseLevCFs.map((v, i) => <td key={i} style={{ padding: '3px 6px', fontSize: 10, fontFamily: bf, textAlign: 'right', borderBottom: `1px solid ${B.gray20}`, color: v >= 0 ? '#065F46' : B.red }}>{fc(v)}</td>)}
                        <td style={{ padding: '3px 6px', fontSize: 10, fontFamily: hf, fontWeight: 700, textAlign: 'right', borderBottom: `1px solid ${B.gray20}`, color: B.blue }}>{fc(leaseLevCFs.reduce((s, v) => s + v, 0))}</td>
                      </tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* YOC sensitivity for lease */}
              {noi > 0 && (
                <div style={{ ...box, overflowX: 'auto' }}>
                  {secTitle('YOC sensitivity — NOI vs exit cap')}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: bf }}>
                    <thead><tr>
                      <th style={{ background: '#1a1a2e', color: '#fff', padding: '5px 6px', fontSize: 9, fontFamily: hf, textAlign: 'left' }}>NOI \ Exit Cap</th>
                      {[6.0, 7.0, 7.5, 8.0, 8.5, 9.0, 10.0].map(cap => (
                        <th key={cap} style={{ background: '#1a1a2e', color: '#fff', padding: '5px 4px', fontSize: 9, fontFamily: hf, textAlign: 'center' }}>{cap.toFixed(1)}%</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {[-20, -10, 0, 10, 20].map(offset => {
                        const adjNOI = noi * (1 + offset / 100)
                        const isBase = offset === 0
                        return (
                          <tr key={offset} style={{ background: isBase ? '#EFF6FF' : undefined }}>
                            <td style={{ padding: '4px 6px', fontWeight: 700, fontFamily: hf, borderBottom: `1px solid ${B.gray20}`, whiteSpace: 'nowrap' }}>
                              {fc(adjNOI)} <span style={{ fontSize: 8, color: B.gray }}>{offset > 0 ? '+' : ''}{offset}%</span>
                            </td>
                            {[6.0, 7.0, 7.5, 8.0, 8.5, 9.0, 10.0].map(cap => {
                              const ev = adjNOI / (cap / 100)
                              const isBaseCell = isBase && Math.abs(cap - n('exit_cap')) < 0.1
                              const profit = ev * 0.95 - totalBasis - holdCostToDate
                              const bg2 = isBaseCell ? '#2A9D8F' : profit > 0 ? '#D1FAE5' : '#FEE2E2'
                              const tc = isBaseCell ? '#fff' : profit > 0 ? '#065F46' : '#991B1B'
                              return (
                                <td key={cap} style={{ padding: '4px 4px', textAlign: 'center', borderBottom: `1px solid ${B.gray20}`, background: bg2, color: tc, fontWeight: isBaseCell ? 700 : 400, fontSize: 10 }}>
                                  ${Math.round(ev / 1000).toLocaleString()}K
                                  <span style={{ fontSize: 8, display: 'block', opacity: 0.7 }}>{fc(profit)}</span>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 9, color: B.gray, fontFamily: bf, marginTop: 4 }}>
                    Top = exit value. Bottom = profit after basis + hold costs. Green = positive. Red = loss.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
