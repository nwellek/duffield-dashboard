import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, TX_CATEGORIES, fmt, Badge } from '../lib/brand'

export default function AccountingTab({ deals }) {
  const [txns, setTxns] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [filterDeal, setFilterDeal] = useState('all')
  const [newTx, setNewTx] = useState({ deal_id: '', date: new Date().toISOString().slice(0, 10), category: TX_CATEGORIES[0], description: '', amount: '', type: 'expense' })

  const fetchTxns = useCallback(async () => {
    const { data } = await supabase.from('transactions').select('*').order('date', { ascending: false })
    if (data) setTxns(data)
  }, [])
  useEffect(() => { fetchTxns() }, [fetchTxns])

  const saveTx = async () => {
    if (!newTx.amount || !newTx.deal_id) return
    await supabase.from('transactions').insert({ ...newTx, amount: Number(newTx.amount) })
    setNewTx({ deal_id: '', date: new Date().toISOString().slice(0, 10), category: TX_CATEGORIES[0], description: '', amount: '', type: 'expense' })
    setShowAdd(false)
    fetchTxns()
  }

  const deleteTx = async (id) => {
    await supabase.from('transactions').delete().eq('id', id)
    fetchTxns()
  }

  const filtered = filterDeal === 'all' ? txns : txns.filter(t => t.deal_id === filterDeal)
  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const net = totalIncome - totalExpense

  const is = { width: '100%', padding: '7px 10px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 13, color: B.black, background: B.white, outline: 'none', boxSizing: 'border-box', fontFamily: bf }
  const ls = { fontSize: 11, fontWeight: 500, color: B.gray, marginBottom: 2, display: 'block', fontFamily: bf }

  // Group by category for summary
  const byCat = {}
  filtered.forEach(t => {
    if (!byCat[t.category]) byCat[t.category] = { income: 0, expense: 0 }
    byCat[t.category][t.type] += Number(t.amount)
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '1 1 120px', background: B.white, borderRadius: 3, padding: '8px 10px', border: `1px solid ${B.gray20}` }}>
          <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>Income</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: B.green, fontFamily: hf }}>{fmt(totalIncome)}</div>
        </div>
        <div style={{ flex: '1 1 120px', background: B.white, borderRadius: 3, padding: '8px 10px', border: `1px solid ${B.gray20}` }}>
          <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>Expenses</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: B.red, fontFamily: hf }}>{fmt(totalExpense)}</div>
        </div>
        <div style={{ flex: '1 1 120px', background: B.white, borderRadius: 3, padding: '8px 10px', border: `1px solid ${B.gray20}` }}>
          <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>Net</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: net >= 0 ? B.green : B.red, fontFamily: hf }}>{net >= 0 ? '+' : '-'}{fmt(Math.abs(net))}</div>
        </div>
        <div style={{ flex: '1 1 120px', background: B.white, borderRadius: 3, padding: '8px 10px', border: `1px solid ${B.gray20}` }}>
          <div style={{ fontSize: 10, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>Transactions</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: B.blue, fontFamily: hf }}>{filtered.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>Filter:</label>
          <select style={{ ...is, width: 'auto', minWidth: 160 }} value={filterDeal} onChange={e => setFilterDeal(e.target.value)}>
            <option value="all">All deals</option>
            {deals.map(d => <option key={d.id} value={d.id}>{d.address} ({d.city})</option>)}
          </select>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '7px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>+ Add transaction</button>
      </div>

      {showAdd && (
        <div style={{ background: B.white, borderRadius: 4, padding: 14, border: `1px solid ${B.blue20}`, marginBottom: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: '1 1 180px' }}><label style={ls}>Deal</label>
              <select style={is} value={newTx.deal_id} onChange={e => setNewTx(p => ({ ...p, deal_id: e.target.value }))}>
                <option value="">Select deal...</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.address} ({d.city})</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 120px' }}><label style={ls}>Date</label>
              <input style={is} type="date" value={newTx.date} onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div style={{ flex: '1 1 100px' }}><label style={ls}>Type</label>
              <select style={is} value={newTx.type} onChange={e => setNewTx(p => ({ ...p, type: e.target.value }))}>
                <option value="expense">Expense</option><option value="income">Income</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: '1 1 150px' }}><label style={ls}>Category</label>
              <select style={is} value={newTx.category} onChange={e => setNewTx(p => ({ ...p, category: e.target.value }))}>
                {TX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 100px' }}><label style={ls}>Amount ($)</label>
              <input style={is} type="number" placeholder="25000" value={newTx.amount} onChange={e => setNewTx(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div style={{ flex: '1 1 200px' }}><label style={ls}>Description</label>
              <input style={is} placeholder="Phase I environmental" value={newTx.description} onChange={e => setNewTx(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={saveTx} style={{ padding: '7px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: bf }}>Save</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '7px 14px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, cursor: 'pointer', fontFamily: bf }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {Object.keys(byCat).length > 0 && (
        <div style={{ background: B.white, borderRadius: 3, padding: 12, border: `1px solid ${B.gray20}`, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>By category</div>
          {Object.entries(byCat).sort((a,b) => (b[1].expense + b[1].income) - (a[1].expense + a[1].income)).map(([cat, v]) => (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 12, fontFamily: bf }}>
              <span style={{ color: B.gray }}>{cat}</span>
              <div style={{ display: 'flex', gap: 12 }}>
                {v.income > 0 && <span style={{ color: B.green, fontWeight: 600, fontFamily: hf }}>+{fmt(v.income)}</span>}
                {v.expense > 0 && <span style={{ color: B.red, fontWeight: 600, fontFamily: hf }}>-{fmt(v.expense)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: 3, border: `1px solid ${B.gray20}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: B.white }}>
          <thead><tr>
            {['Date', 'Deal', 'Category', 'Description', 'Type', 'Amount', ''].map(h => (
              <th key={h} style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', letterSpacing: 0.3, padding: '6px 7px', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: B.gray40, fontSize: 12, fontFamily: bf }}>No transactions yet. Click "+ Add transaction" to start tracking.</td></tr>}
            {filtered.map(t => {
              const deal = deals.find(d => d.id === t.deal_id)
              return (
                <tr key={t.id}>
                  <td style={{ fontSize: 12, color: B.black, padding: '6px 7px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf, whiteSpace: 'nowrap' }}>{t.date}</td>
                  <td style={{ fontSize: 12, color: B.black, padding: '6px 7px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf, fontWeight: 600 }}>{deal?.address || '\u2014'}</td>
                  <td style={{ fontSize: 12, color: B.gray, padding: '6px 7px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{t.category}</td>
                  <td style={{ fontSize: 12, color: B.gray80, padding: '6px 7px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{t.description || '\u2014'}</td>
                  <td style={{ fontSize: 12, padding: '6px 7px', borderBottom: `1px solid ${B.gray20}` }}><Badge bg={t.type === 'income' ? B.greenLight : B.redLight} color={t.type === 'income' ? B.greenDark : B.redDark}>{t.type}</Badge></td>
                  <td style={{ fontSize: 12, fontWeight: 600, color: t.type === 'income' ? B.green : B.red, padding: '6px 7px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf }}>{t.type === 'income' ? '+' : '-'}{fmt(t.amount)}</td>
                  <td style={{ padding: '6px 7px', borderBottom: `1px solid ${B.gray20}` }}>
                    <button onClick={() => deleteTx(t.id)} style={{ background: 'none', border: 'none', color: B.red, cursor: 'pointer', fontSize: 11, fontFamily: bf }}>x</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
