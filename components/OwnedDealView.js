import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, fmt, Badge } from '../lib/brand'
import DealDocuments from './DealDocuments'

export default function OwnedDealView({ deal, onBack }) {
  const [tab, setTab] = useState('overview')
  const [investors, setInvestors] = useState([])
  const [activities, setActivities] = useState([])
  const [transactions, setTransactions] = useState([])
  const [recurring, setRecurring] = useState([])
  const [showAddRecurring, setShowAddRecurring] = useState(false)
  const [newRec, setNewRec] = useState({ name: '', category: 'Debt service', amount: '', frequency: 'monthly', payee: '', notes: '' })
  const [newTx, setNewTx] = useState({ date: new Date().toISOString().slice(0, 10), description: '', amount: '', category: 'Other' })
  const [txFilter, setTxFilter] = useState('all')

  const fetchInvestors = useCallback(async () => {
    if (!deal?.id) return
    const { data } = await supabase.from('investors').select('*').eq('deal_id', deal.id).order('investor_type', { ascending: true }).order('committed', { ascending: false })
    if (data) setInvestors(data)
  }, [deal?.id])

  const fetchActivity = useCallback(async () => {
    if (!deal?.id) return
    const { data } = await supabase.from('deal_activity').select('*').eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(20)
    if (data) setActivities(data)
  }, [deal?.id])

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

  useEffect(() => { fetchInvestors(); fetchActivity(); fetchTransactions(); fetchRecurring() }, [fetchInvestors, fetchActivity, fetchTransactions, fetchRecurring])

  const addRecurring = async () => {
    if (!newRec.name || !newRec.amount) return
    await supabase.from('recurring_expenses').insert({ ...newRec, amount: Number(newRec.amount), deal_id: deal.id })
    setNewRec({ name: '', category: 'Debt service', amount: '', frequency: 'monthly', payee: '', notes: '' })
    setShowAddRecurring(false)
    fetchRecurring()
  }
  const deleteRecurring = async (id) => { await supabase.from('recurring_expenses').delete().eq('id', id); fetchRecurring() }

  const addTransaction = async () => {
    if (!newTx.description || !newTx.amount) return
    const amt = Number(newTx.amount)
    const lastBal = transactions.length > 0 && transactions[0].balance ? Number(transactions[0].balance) : 0
    const newBal = lastBal + amt
    await supabase.from('transactions').insert({
      deal_id: deal.id, date: newTx.date || null, description: newTx.description,
      amount: amt, balance: newBal, category: newTx.category,
      type: amt >= 0 ? 'income' : 'expense', notes: '',
    })
    setNewTx({ date: new Date().toISOString().slice(0, 10), description: '', amount: '', category: 'Other' })
    fetchTransactions()
  }
  const deleteTransaction = async (id) => { await supabase.from('transactions').delete().eq('id', id); fetchTransactions() }

  const filteredTx = txFilter === 'all' ? transactions : transactions.filter(t => t.type === txFilter)

  const monthlyRecurring = recurring.filter(r => r.is_active).reduce((s, r) => {
    if (r.frequency === 'monthly') return s + Number(r.amount)
    if (r.frequency === 'quarterly') return s + Number(r.amount) / 3
    if (r.frequency === 'annual') return s + Number(r.amount) / 12
    return s
  }, 0)

  const gpInvestors = investors.filter(i => i.investor_type === 'GP')
  const lpInvestors = investors.filter(i => i.investor_type === 'LP')
  const totalCommitted = investors.reduce((s, i) => s + Number(i.committed || 0), 0)
  const totalReceived = investors.reduce((s, i) => s + Number(i.received || 0), 0)
  const gpCommitted = gpInvestors.reduce((s, i) => s + Number(i.committed || 0), 0)
  const lpCommitted = lpInvestors.reduce((s, i) => s + Number(i.committed || 0), 0)

  // Bank balance from last transaction with balance
  const lastBalanceTx = transactions.find(t => t.balance !== null && t.balance !== undefined)
  const bankBalance = lastBalanceTx ? Number(lastBalanceTx.balance) : null
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'investors', label: `Investors (${investors.length})` },
    { id: 'bank', label: 'Bank / Ledger' },
    { id: 'recurring', label: `Recurring (${recurring.length})` },
    { id: 'documents', label: 'Documents' },
    { id: 'tenants', label: 'Tenants' },
    { id: 'activity', label: 'Activity' },
  ]

  const box = { background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}`, marginBottom: 12 }
  const secTitle = (t) => <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{t}</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: B.gray, cursor: 'pointer', fontFamily: bf, fontSize: 12, padding: 0, marginBottom: 4 }}>&larr; Back to tracker</button>
          <div style={{ fontSize: 22, fontWeight: 700, color: B.blue, fontFamily: hf }}>{deal.address}</div>
          <div style={{ fontSize: 13, color: B.gray, fontFamily: bf }}>{deal.city}{deal.state ? `, ${deal.state}` : ''} &mdash; {deal.market}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Badge bg="#D1FAE5" color="#065F46" border="#10B981" style={{ fontSize: 14, padding: '6px 14px' }}>OWNED</Badge>
          <div style={{ textAlign: 'right', fontSize: 12, fontFamily: bf }}>
            <div style={{ color: B.gray }}>Closed</div>
            <div style={{ fontWeight: 700, color: B.black, fontFamily: hf }}>{deal.purchase_date || 'Sep 2, 2025'}</div>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          { l: 'Purchase price', v: fmt(deal.purchase_price || deal.asking_price), c: B.blue },
          { l: 'Building SF', v: deal.building_sf ? Number(deal.building_sf).toLocaleString() : '—', c: B.black },
          { l: 'Lot acres', v: deal.lot_acres || '—', c: B.black },
          { l: 'Total equity', v: '$' + totalCommitted.toLocaleString(), c: B.blue },
          { l: 'GP equity', v: '$' + gpCommitted.toLocaleString(), c: B.amber },
          { l: 'LP equity', v: '$' + lpCommitted.toLocaleString(), c: B.green },
          { l: 'Investors', v: investors.length, c: B.black },
          { l: 'Wired', v: '$' + totalReceived.toLocaleString(), c: totalReceived >= totalCommitted ? B.green : B.amber },
          { l: 'Bank balance', v: bankBalance !== null ? '$' + Math.round(bankBalance).toLocaleString() : '—', c: bankBalance > 50000 ? B.green : bankBalance > 0 ? B.amber : B.red },
          { l: 'Monthly burn', v: '$' + Math.round(monthlyRecurring).toLocaleString(), c: B.red },
        ].map((s, i) => (
          <div key={i} style={{ flex: '1 1 100px', background: B.white, borderRadius: 4, padding: '10px 12px', border: `1px solid ${B.gray20}`, minWidth: 90 }}>
            <div style={{ fontSize: 9, color: B.gray, fontFamily: bf, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.c, fontFamily: hf }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 14, borderBottom: `2px solid ${B.gray20}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 16px', fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? B.blue : B.gray, background: 'transparent', border: 'none',
            borderBottom: tab === t.id ? `2px solid ${B.blue}` : '2px solid transparent',
            cursor: 'pointer', marginBottom: -2, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 400px', minWidth: 300 }}>
            <div style={box}>
              {secTitle('Property details')}
              {[
                ['Address', deal.address],
                ['City / State', `${deal.city}, ${deal.state}`],
                ['Market', deal.market],
                ['Property type', deal.property_type],
                ['Building SF', deal.building_sf ? Number(deal.building_sf).toLocaleString() + ' SF' : '—'],
                ['Lot size', deal.lot_acres ? deal.lot_acres + ' acres' : '—'],
                ['Year built', deal.year_built || '—'],
                ['Zoning', deal.zoning || 'Industrial'],
                ['Parcel #', deal.parcel_number || '—'],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
                  <span style={{ color: B.gray }}>{l}</span>
                  <span style={{ color: B.black, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={box}>
              {secTitle('Deal timeline')}
              {[
                ['LOI submitted', 'Oct 17, 2024'],
                ['LOI revised', 'May 28, 2025'],
                ['PSA signed', 'Jun 12, 2025'],
                ['DD start', 'Jun 26, 2025'],
                ['DD end', 'Aug 21, 2025'],
                ['First amendment', 'Jul 29, 2025'],
                ['Closing', 'Sep 2, 2025'],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: B.green, flexShrink: 0 }} />
                  <span style={{ color: B.gray, flex: 1 }}>{l}</span>
                  <span style={{ color: B.black, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 260 }}>
            <div style={box}>
              {secTitle('Capital structure')}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: bf, marginBottom: 4 }}>
                  <span style={{ color: B.gray }}>GP equity</span>
                  <span style={{ fontWeight: 700, color: B.amber }}>${gpCommitted.toLocaleString()}</span>
                </div>
                <div style={{ height: 6, background: B.gray20, borderRadius: 3 }}>
                  <div style={{ width: `${totalCommitted > 0 ? (gpCommitted / totalCommitted * 100) : 0}%`, height: '100%', background: B.amber, borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: bf, marginBottom: 4 }}>
                  <span style={{ color: B.gray }}>LP equity</span>
                  <span style={{ fontWeight: 700, color: B.green }}>${lpCommitted.toLocaleString()}</span>
                </div>
                <div style={{ height: 6, background: B.gray20, borderRadius: 3 }}>
                  <div style={{ width: `${totalCommitted > 0 ? (lpCommitted / totalCommitted * 100) : 0}%`, height: '100%', background: B.green, borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: hf, fontWeight: 700, paddingTop: 6, borderTop: `1px solid ${B.gray20}` }}>
                <span style={{ color: B.gray }}>Total</span>
                <span style={{ color: B.blue }}>${totalCommitted.toLocaleString()}</span>
              </div>
            </div>

            <div style={box}>
              {secTitle('Entity & lending')}
              {[
                ['Entity', 'Duffield Holdings Laredo LLC'],
                ['State', 'Delaware'],
                ['EIN', 'On file'],
                ['Lender', 'Vantage Bank'],
                ['Tenant', 'ISB USA (leaseback)'],
                ['Listing agent', 'Chris Haynes'],
                ['Insurance', 'B&W ($12,876/yr + $839 excess)'],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
                  <span style={{ color: B.gray }}>{l}</span>
                  <span style={{ color: B.black, fontWeight: 500, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>

            {deal.notes && (
              <div style={box}>
                {secTitle('Notes')}
                <div style={{ fontSize: 12, color: B.gray, fontFamily: bf, lineHeight: 1.5 }}>{deal.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Investors tab */}
      {tab === 'investors' && (
        <div>
          {/* GP section */}
          <div style={box}>
            {secTitle(`GP investors (${gpInvestors.length}) — $${gpCommitted.toLocaleString()}`)}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Name', 'Entity', 'Committed', 'Wired', 'Promote', 'Docs', 'Email'].map(h => (
                  <th key={h} style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', padding: '5px 6px', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {gpInvestors.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontSize: 12, fontWeight: 600, color: B.black, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf }}>{inv.name}</td>
                    <td style={{ fontSize: 11, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{inv.entity_name}</td>
                    <td style={{ fontSize: 12, fontWeight: 600, color: B.black, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>${Number(inv.committed).toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: Number(inv.received) >= Number(inv.committed) ? B.green : B.amber, fontWeight: 600, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>${Number(inv.received).toLocaleString()}</td>
                    <td style={{ fontSize: 11, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{inv.paying_promote ? 'Yes' : 'No'}</td>
                    <td style={{ fontSize: 11, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>
                      {inv.docs_signed ? <span style={{ color: B.green }}>Signed</span> : inv.docs_sent ? <span style={{ color: B.amber }}>Sent</span> : <span style={{ color: B.red }}>Pending</span>}
                    </td>
                    <td style={{ fontSize: 11, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>
                      {inv.email && <a href={'mailto:' + inv.email} style={{ color: B.blue, textDecoration: 'none' }}>{inv.email}</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* LP section */}
          <div style={box}>
            {secTitle(`LP investors (${lpInvestors.length}) — $${lpCommitted.toLocaleString()}`)}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Name', 'Entity', 'Committed', 'Wired', 'Promote', 'Docs', 'Email'].map(h => (
                  <th key={h} style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', padding: '5px 6px', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {lpInvestors.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontSize: 12, fontWeight: 600, color: B.black, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf }}>{inv.name}</td>
                    <td style={{ fontSize: 11, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{inv.entity_name}</td>
                    <td style={{ fontSize: 12, fontWeight: 600, color: B.black, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>${Number(inv.committed).toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: Number(inv.received) >= Number(inv.committed) ? B.green : B.amber, fontWeight: 600, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>${Number(inv.received).toLocaleString()}</td>
                    <td style={{ fontSize: 11, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{inv.paying_promote ? 'Yes' : 'No'}</td>
                    <td style={{ fontSize: 11, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>
                      {inv.docs_signed ? <span style={{ color: B.green }}>Signed</span> : inv.docs_sent ? <span style={{ color: B.amber }}>Sent</span> : <span style={{ color: B.red }}>Pending</span>}
                    </td>
                    <td style={{ fontSize: 11, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>
                      {inv.email && <a href={'mailto:' + inv.email} style={{ color: B.blue, textDecoration: 'none' }}>{inv.email}</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Waterfall summary */}
          <div style={box}>
            {secTitle('Equity waterfall')}
            <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${totalCommitted > 0 ? (gpCommitted / totalCommitted * 100) : 0}%`, background: B.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: B.white, fontFamily: hf }}>GP {Math.round(gpCommitted / totalCommitted * 100)}%</div>
              <div style={{ flex: 1, background: B.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: B.white, fontFamily: hf }}>LP {Math.round(lpCommitted / totalCommitted * 100)}%</div>
            </div>
            <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>
              {investors.filter(i => i.paying_promote).length} of {investors.length} investors paying promote
            </div>
          </div>
        </div>
      )}

      {/* Bank / Ledger */}
      {tab === 'bank' && (
        <div>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ flex: '1 1 120px', background: bankBalance > 50000 ? '#D1FAE5' : bankBalance > 0 ? '#FEF3C7' : '#FEE2E2', borderRadius: 4, padding: '12px 14px', border: `1px solid ${B.gray20}` }}>
              <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>Current balance</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: bankBalance > 50000 ? '#065F46' : bankBalance > 0 ? '#92400E' : '#991B1B', fontFamily: hf }}>{bankBalance !== null ? '$' + Math.round(bankBalance).toLocaleString() : '—'}</div>
            </div>
            <div style={{ flex: '1 1 120px', background: B.white, borderRadius: 4, padding: '12px 14px', border: `1px solid ${B.gray20}` }}>
              <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>Total cash in</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: B.green, fontFamily: hf }}>${Math.round(totalIncome).toLocaleString()}</div>
            </div>
            <div style={{ flex: '1 1 120px', background: B.white, borderRadius: 4, padding: '12px 14px', border: `1px solid ${B.gray20}` }}>
              <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>Total cash out</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: B.red, fontFamily: hf }}>${Math.round(totalExpenses).toLocaleString()}</div>
            </div>
            <div style={{ flex: '1 1 120px', background: B.white, borderRadius: 4, padding: '12px 14px', border: `1px solid ${B.gray20}` }}>
              <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>Months of runway</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: monthlyRecurring > 0 && bankBalance ? (bankBalance / monthlyRecurring > 12 ? B.green : bankBalance / monthlyRecurring > 6 ? B.amber : B.red) : B.gray, fontFamily: hf }}>
                {monthlyRecurring > 0 && bankBalance ? Math.round(bankBalance / monthlyRecurring) : '—'}
              </div>
            </div>
          </div>

          {/* Add transaction form */}
          <div style={{ ...box, border: `2px solid ${B.blue20}` }}>
            {secTitle('Add transaction')}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 100px' }}>
                <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, marginBottom: 2 }}>Date</div>
                <input type="date" value={newTx.date} onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', padding: '5px 6px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 11, fontFamily: bf, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '2 1 150px' }}>
                <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, marginBottom: 2 }}>Description</div>
                <input value={newTx.description} onChange={e => setNewTx(p => ({ ...p, description: e.target.value }))} placeholder="AM Fee, Loan Interest, Rent..." style={{ width: '100%', padding: '5px 6px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 11, fontFamily: bf, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '1 1 80px' }}>
                <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, marginBottom: 2 }}>Amount</div>
                <input type="number" value={newTx.amount} onChange={e => setNewTx(p => ({ ...p, amount: e.target.value }))} placeholder="-500 or 5000" style={{ width: '100%', padding: '5px 6px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 11, fontFamily: bf, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, marginBottom: 2 }}>Category</div>
                <select value={newTx.category} onChange={e => setNewTx(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '5px 6px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 11, fontFamily: bf, cursor: 'pointer', boxSizing: 'border-box' }}>
                  {['Capital call', 'Loan', 'Acquisition', 'AM fee', 'Debt service', 'Insurance', 'T&E', 'Bank fee', 'Tax', 'Construction', 'Rent', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={addTransaction} disabled={!newTx.description || !newTx.amount} style={{ padding: '5px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: !newTx.description || !newTx.amount ? 0.4 : 1, height: 28 }}>Add</button>
            </div>
          </div>

          {/* Transaction ledger */}
          <div style={box}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              {secTitle(`Ledger (${transactions.length})`)}
              <div style={{ display: 'flex', gap: 3 }}>
                {['all', 'income', 'expense'].map(f => (
                  <button key={f} onClick={() => setTxFilter(f)} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: txFilter === f ? 700 : 400, border: `1px solid ${txFilter === f ? B.blue : B.gray20}`, background: txFilter === f ? B.blue : 'transparent', color: txFilter === f ? B.white : B.gray, cursor: 'pointer', fontFamily: hf, textTransform: 'capitalize' }}>{f}</button>
                ))}
              </div>
            </div>
            {filteredTx.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: B.gray40, fontSize: 12, fontFamily: bf }}>No transactions</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['Date', 'Description', 'Category', 'Amount', 'Balance', 'Notes', ''].map(h => (
                      <th key={h} style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', padding: '5px 6px', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredTx.map(t => (
                      <tr key={t.id} onMouseEnter={e => e.currentTarget.style.background = B.blue05} onMouseLeave={e => e.currentTarget.style.background = B.white}>
                        <td style={{ fontSize: 11, color: B.gray, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf, whiteSpace: 'nowrap' }}>{t.date ? new Date(t.date + 'T12:00:00').toLocaleDateString() : '—'}</td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: B.black, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf }}>{t.description}</td>
                        <td style={{ fontSize: 10, color: B.gray, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{t.category}</td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: Number(t.amount) >= 0 ? B.green : B.red, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf, whiteSpace: 'nowrap' }}>
                          {Number(t.amount) >= 0 ? '+' : ''}{fmt(t.amount)}
                        </td>
                        <td style={{ fontSize: 11, color: B.black, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf, fontWeight: 500 }}>{t.balance ? '$' + Math.round(Number(t.balance)).toLocaleString() : '—'}</td>
                        <td style={{ fontSize: 10, color: B.gray60, padding: '5px 6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{t.notes || ''}</td>
                        <td style={{ padding: '5px 6px', borderBottom: `1px solid ${B.gray20}` }}>
                          <button onClick={() => deleteTransaction(t.id)} style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 11 }}>x</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recurring expenses */}
      {tab === 'recurring' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: B.gray, fontFamily: bf }}>Monthly burn: <span style={{ fontWeight: 700, color: B.red, fontFamily: hf, fontSize: 14 }}>${Math.round(monthlyRecurring).toLocaleString()}/mo</span></div>
            </div>
            <button onClick={() => setShowAddRecurring(true)} style={{ padding: '6px 12px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>+ Add recurring</button>
          </div>

          {showAddRecurring && (
            <div style={{ ...box, border: `2px solid ${B.blue20}` }}>
              {secTitle('New recurring expense')}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <input style={{ flex: '1 1 150px', padding: '6px 8px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, fontFamily: bf, outline: 'none' }} placeholder="AM fee, debt service, insurance..." value={newRec.name} onChange={e => setNewRec(p => ({ ...p, name: e.target.value }))} />
                <select style={{ padding: '6px 8px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, fontFamily: bf, cursor: 'pointer' }} value={newRec.category} onChange={e => setNewRec(p => ({ ...p, category: e.target.value }))}>
                  {['Debt service', 'AM fee', 'Insurance', 'Property tax', 'Utilities', 'Maintenance', 'Accounting', 'Legal', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <input style={{ flex: '1 1 100px', padding: '6px 8px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, fontFamily: bf, outline: 'none' }} type="number" placeholder="Amount $" value={newRec.amount} onChange={e => setNewRec(p => ({ ...p, amount: e.target.value }))} />
                <select style={{ padding: '6px 8px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, fontFamily: bf, cursor: 'pointer' }} value={newRec.frequency} onChange={e => setNewRec(p => ({ ...p, frequency: e.target.value }))}>
                  {['monthly', 'quarterly', 'annual'].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input style={{ flex: '1 1 120px', padding: '6px 8px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, fontFamily: bf, outline: 'none' }} placeholder="Payee" value={newRec.payee} onChange={e => setNewRec(p => ({ ...p, payee: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={addRecurring} disabled={!newRec.name || !newRec.amount} style={{ padding: '6px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: !newRec.name || !newRec.amount ? 0.4 : 1 }}>Save</button>
                <button onClick={() => setShowAddRecurring(false)} style={{ padding: '6px 14px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, cursor: 'pointer', fontFamily: bf }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={box}>
            {recurring.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: B.gray40, fontSize: 12, fontFamily: bf }}>No recurring expenses set up yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Expense', 'Category', 'Amount', 'Frequency', 'Monthly eq.', 'Payee', ''].map(h => (
                    <th key={h} style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', padding: '5px 6px', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {recurring.map(r => {
                    const monthly = r.frequency === 'monthly' ? Number(r.amount) : r.frequency === 'quarterly' ? Number(r.amount) / 3 : Number(r.amount) / 12
                    return (
                      <tr key={r.id}>
                        <td style={{ fontSize: 12, fontWeight: 600, color: B.black, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf }}>{r.name}</td>
                        <td style={{ fontSize: 11, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{r.category}</td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: B.red, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>${Number(r.amount).toLocaleString()}</td>
                        <td style={{ fontSize: 11, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{r.frequency}</td>
                        <td style={{ fontSize: 11, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>${Math.round(monthly).toLocaleString()}/mo</td>
                        <td style={{ fontSize: 11, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{r.payee || '\u2014'}</td>
                        <td style={{ padding: '6px', borderBottom: `1px solid ${B.gray20}` }}>
                          <button onClick={() => deleteRecurring(r.id)} style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 11 }}>x</button>
                        </td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td colSpan={4} style={{ padding: '8px 6px', fontWeight: 700, fontFamily: hf, fontSize: 12, borderTop: `2px solid ${B.gray20}` }}>Total monthly burn</td>
                    <td colSpan={3} style={{ padding: '8px 6px', fontWeight: 700, color: B.red, fontFamily: hf, fontSize: 14, borderTop: `2px solid ${B.gray20}` }}>${Math.round(monthlyRecurring).toLocaleString()}/mo</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Documents */}
      {tab === 'documents' && <DealDocuments dealId={deal.id} onDealUpdated={() => {}} />}

      {/* Tenants */}
      {tab === 'tenants' && (
        <div>
          <div style={box}>
            {secTitle('Current tenant')}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                {[
                  ['Tenant', 'ISB USA, LLC'],
                  ['Lease type', 'Sale-leaseback (NNN)'],
                  ['Lease signed', 'Aug 21, 2025'],
                  ['Lease start', 'Sep 2, 2025'],
                  ['Term', 'See lease agreement'],
                  ['Status', 'Active'],
                ].map(([l, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
                    <span style={{ color: B.gray }}>{l}</span>
                    <span style={{ color: B.black, fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={box}>
            {secTitle('Prospective tenants / inquiries')}
            <div style={{ fontSize: 12, color: B.gray, fontFamily: bf }}>
              Multiple inquiries tracked via Chris Haynes listing. See inquiry tracker reports in OneDrive (7. Tenants / 7.6 Prospective Tenants). Latest LOI from Mayra Villarreal, Realtor (Jan 30, 2026).
            </div>
          </div>
        </div>
      )}

      {/* Activity */}
      {tab === 'activity' && (
        <div style={box}>
          {secTitle('Deal activity log')}
          {activities.length === 0 ? (
            <div style={{ fontSize: 12, color: B.gray40, fontFamily: bf }}>No activity logged yet.</div>
          ) : (
            activities.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
                <span style={{ color: B.gray60, fontSize: 11, minWidth: 70 }}>{new Date(a.created_at).toLocaleDateString()}</span>
                <Badge bg={B.blue10} color={B.blue} style={{ fontSize: 9 }}>{a.type}</Badge>
                <span style={{ color: B.black, flex: 1 }}>{a.content}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
