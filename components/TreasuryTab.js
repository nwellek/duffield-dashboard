import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, fmt, Badge } from '../lib/brand'

const STATUSES = [
  { id: 'pending', label: 'Pending', color: B.gray },
  { id: 'approved', label: 'Approved', color: B.blue },
  { id: 'check_written', label: 'Check Written', color: B.amber },
  { id: 'wire_sent', label: 'Wire Sent', color: B.amber },
  { id: 'paid', label: 'Paid', color: B.green },
]
const CATEGORIES = ['Acquisition', 'Legal', 'Accounting', 'Insurance', 'Construction', 'Debt service', 'AM fee', 'T&E', 'Tax', 'Marketing', 'Consulting', 'Other']

export default function TreasuryTab() {
  const [accounts, setAccounts] = useState([])
  const [payables, setPayables] = useState([])
  const [showAddAcct, setShowAddAcct] = useState(false)
  const [showAddPay, setShowAddPay] = useState(false)
  const [showAddRec, setShowAddRec] = useState(false)
  const [newAcct, setNewAcct] = useState({ name: '', bank: '', balance: '', entity: 'Duffield Holdings LLC' })
  const [newPay, setNewPay] = useState({ vendor: '', description: '', amount: '', due_date: '', category: 'Other', status: 'pending', notes: '' })
  const [newRec, setNewRec] = useState({ source: '', description: '', amount: '', due_date: '', category: 'Other', status: 'pending', notes: '' })
  const [receivables, setReceivables] = useState([])
  const [apFilter, setApFilter] = useState('all')
  const [editing, setEditing] = useState(null)

  const fetchAccounts = useCallback(async () => {
    const { data } = await supabase.from('bank_accounts').select('*').order('entity').order('name')
    if (data) setAccounts(data)
  }, [])
  const fetchPayables = useCallback(async () => {
    const { data } = await supabase.from('payables').select('*').order('due_date', { ascending: true })
    if (data) setPayables(data)
  }, [])
  const fetchReceivables = useCallback(async () => {
    const { data } = await supabase.from('receivables').select('*').order('due_date', { ascending: true })
    if (data) setReceivables(data)
  }, [])
  useEffect(() => { fetchAccounts(); fetchPayables(); fetchReceivables() }, [fetchAccounts, fetchPayables, fetchReceivables])

  const addAccount = async () => {
    if (!newAcct.name || !newAcct.balance) return
    await supabase.from('bank_accounts').insert({ ...newAcct, balance: Number(newAcct.balance) })
    setNewAcct({ name: '', bank: '', balance: '', entity: 'Duffield Holdings LLC' }); setShowAddAcct(false); fetchAccounts()
  }
  const updateBalance = async (id, balance) => {
    await supabase.from('bank_accounts').update({ balance: Number(balance), updated_at: new Date().toISOString() }).eq('id', id)
    fetchAccounts()
  }
  const deleteAccount = async (id) => { await supabase.from('bank_accounts').delete().eq('id', id); fetchAccounts() }

  const addPayable = async () => {
    if (!newPay.vendor || !newPay.amount) return
    await supabase.from('payables').insert({ ...newPay, amount: Number(newPay.amount), due_date: newPay.due_date || null })
    setNewPay({ vendor: '', description: '', amount: '', due_date: '', category: 'Other', status: 'pending', notes: '' }); setShowAddPay(false); fetchPayables()
  }
  const updatePayableStatus = async (id, status) => {
    const update = { status }
    if (status === 'paid') update.paid_date = new Date().toISOString().slice(0, 10)
    await supabase.from('payables').update(update).eq('id', id); fetchPayables()
  }
  const deletePayable = async (id) => { await supabase.from('payables').delete().eq('id', id); fetchPayables() }

  const addReceivable = async () => {
    if (!newRec.source || !newRec.amount) return
    await supabase.from('receivables').insert({ ...newRec, amount: Number(newRec.amount), due_date: newRec.due_date || null })
    setNewRec({ source: '', description: '', amount: '', due_date: '', category: 'Other', status: 'pending', notes: '' }); setShowAddRec(false); fetchReceivables()
  }
  const updateReceivableStatus = async (id, status) => {
    const update = { status }
    if (status === 'received') update.received_date = new Date().toISOString().slice(0, 10)
    await supabase.from('receivables').update(update).eq('id', id); fetchReceivables()
  }
  const deleteReceivable = async (id) => { await supabase.from('receivables').delete().eq('id', id); fetchReceivables() }

  const saveEdit = async () => {
    if (!editing) return
    await supabase.from('payables').update({ vendor: editing.vendor, description: editing.description, amount: Number(editing.amount), due_date: editing.due_date || null, category: editing.category, notes: editing.notes }).eq('id', editing.id)
    setEditing(null); fetchPayables()
  }

  const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const unpaidPayables = payables.filter(p => p.status !== 'paid')
  const totalAP = unpaidPayables.reduce((s, p) => s + Number(p.amount), 0)
  const overdueAP = unpaidPayables.filter(p => p.due_date && new Date(p.due_date) < new Date())
  const totalOverdue = overdueAP.reduce((s, p) => s + Number(p.amount), 0)
  const committedOut = unpaidPayables.filter(p => p.status === 'check_written' || p.status === 'wire_sent').reduce((s, p) => s + Number(p.amount), 0)
  const netPosition = totalCash - totalAP
  const cashAfterCommitted = totalCash - committedOut

  const unpaidReceivables = receivables.filter(r => r.status !== 'received')
  const totalAR = unpaidReceivables.reduce((s, r) => s + Number(r.amount), 0)

  const filteredPayables = apFilter === 'all' ? unpaidPayables : payables.filter(p => p.status === apFilter)
  const knownVendors = [...new Set(payables.map(p => p.vendor).filter(Boolean))].sort()

  const box = { background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}`, marginBottom: 12 }
  const is = { width: '100%', padding: '7px 9px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, fontFamily: bf, color: B.black, outline: 'none', boxSizing: 'border-box', background: B.white }

  return (
    <div>
      {/* Metric cards */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          { l: 'Total cash', v: fmt(totalCash), c: B.blue, sub: accounts.length + ' accounts' },
          { l: 'Receivable (AR)', v: fmt(totalAR), c: totalAR > 0 ? B.green : B.gray, sub: unpaidReceivables.length + ' pending' },
          { l: 'Payable (AP)', v: fmt(totalAP), c: totalAP > 0 ? B.red : B.green, sub: unpaidPayables.length + ' outstanding' },
          { l: 'Net position', v: fmt(netPosition), c: netPosition >= 0 ? B.green : B.red, sub: 'Cash minus AP' },
          { l: 'After committed', v: fmt(cashAfterCommitted), c: cashAfterCommitted >= 0 ? B.green : B.red, sub: fmt(committedOut) + ' committed' },
        ].map((m, i) => (
          <div key={i} style={{ flex: '1 1 140px', background: B.white, borderRadius: 4, padding: '12px 14px', border: `1px solid ${B.gray20}`, minWidth: 120 }}>
            <div style={{ fontSize: 9, color: B.gray, fontFamily: bf, textTransform: 'uppercase', letterSpacing: 0.3 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, fontFamily: hf }}>{m.v}</div>
            <div style={{ fontSize: 10, color: B.gray60, fontFamily: bf }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => setShowAddAcct(true)} style={{ padding: '7px 14px', background: B.white, color: B.blue, border: `2px solid ${B.blue}`, borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>+ Account</button>
        <button onClick={() => setShowAddRec(true)} style={{ padding: '7px 14px', background: B.green, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>+ Receivable (debit)</button>
        <button onClick={() => setShowAddPay(true)} style={{ padding: '7px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>+ Payable (credit)</button>
      </div>

      {/* Add Account form */}
      {showAddAcct && (
        <div style={{ ...box, border: `2px solid ${B.blue20}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 8 }}>Add bank account</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ flex: '1 1 140px' }}><input style={is} placeholder="Account name (e.g. Operating)" value={newAcct.name} onChange={e => setNewAcct(p => ({ ...p, name: e.target.value }))} /></div>
            <div style={{ flex: '1 1 120px' }}><input style={is} placeholder="Bank name" value={newAcct.bank} onChange={e => setNewAcct(p => ({ ...p, bank: e.target.value }))} /></div>
            <div style={{ flex: '1 1 100px' }}><input style={is} type="number" placeholder="Balance $" value={newAcct.balance} onChange={e => setNewAcct(p => ({ ...p, balance: e.target.value }))} /></div>
            <div style={{ flex: '1 1 140px' }}><input style={is} placeholder="Entity" value={newAcct.entity} onChange={e => setNewAcct(p => ({ ...p, entity: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={addAccount} disabled={!newAcct.name || !newAcct.balance} style={{ padding: '6px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: newAcct.name && newAcct.balance ? 1 : 0.4 }}>Add</button>
            <button onClick={() => setShowAddAcct(false)} style={{ padding: '6px 14px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, cursor: 'pointer', fontFamily: bf }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add Payable form */}
      {showAddPay && (
        <div style={{ ...box, border: `2px solid ${B.blue20}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 8 }}>{editing ? 'Edit payable' : 'New payable'}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ flex: '1 1 150px' }}>
              <input list="vendor-list" style={is} placeholder="Vendor" value={newPay.vendor} onChange={e => setNewPay(p => ({ ...p, vendor: e.target.value }))} />
              <datalist id="vendor-list">{knownVendors.map(v => <option key={v} value={v} />)}</datalist>
            </div>
            <div style={{ flex: '2 1 180px' }}><input style={is} placeholder="Description" value={newPay.description} onChange={e => setNewPay(p => ({ ...p, description: e.target.value }))} /></div>
            <div style={{ flex: '1 1 90px' }}><input style={is} type="number" placeholder="Amount $" value={newPay.amount} onChange={e => setNewPay(p => ({ ...p, amount: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ flex: '1 1 100px' }}><input style={is} type="date" value={newPay.due_date} onChange={e => setNewPay(p => ({ ...p, due_date: e.target.value }))} /></div>
            <div style={{ flex: '1 1 100px' }}>
              <select style={{ ...is, cursor: 'pointer' }} value={newPay.category} onChange={e => setNewPay(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: '2 1 150px' }}><input style={is} placeholder="Notes" value={newPay.notes} onChange={e => setNewPay(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={addPayable} disabled={!newPay.vendor || !newPay.amount} style={{ padding: '6px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: newPay.vendor && newPay.amount ? 1 : 0.4 }}>Add</button>
            <button onClick={() => setShowAddPay(false)} style={{ padding: '6px 14px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, cursor: 'pointer', fontFamily: bf }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bank Accounts */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Bank accounts</div>
        {accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: B.gray40, fontSize: 12, fontFamily: bf }}>No accounts. Click "+ Account" to add your first bank account.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Account', 'Bank', 'Entity', 'Balance', ''].map(h => (
                <th key={h} style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', padding: '5px 6px', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {accounts.map(a => (
                <BalanceRow key={a.id} account={a} onUpdate={updateBalance} onDelete={deleteAccount} />
              ))}
              <tr>
                <td colSpan={3} style={{ padding: '8px 6px', fontWeight: 700, fontFamily: hf, fontSize: 12, borderTop: `2px solid ${B.gray20}` }}>Total</td>
                <td style={{ padding: '8px 6px', fontWeight: 700, color: B.blue, fontFamily: hf, fontSize: 16, borderTop: `2px solid ${B.gray20}` }}>{fmt(totalCash)}</td>
                <td style={{ borderTop: `2px solid ${B.gray20}` }} />
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Accounts Payable */}
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4 }}>Accounts payable</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {['all', ...STATUSES.map(s => s.id)].map(f => {
              const n = f === 'all' ? unpaidPayables.length : payables.filter(p => p.status === f).length
              if (n === 0 && f !== 'all') return null
              const a = apFilter === f
              const sc = STATUSES.find(s => s.id === f)
              return <button key={f} onClick={() => setApFilter(a ? 'all' : f)} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 9, fontWeight: a ? 700 : 400, border: `1px solid ${a ? (sc?.color || B.blue) : B.gray20}`, background: a ? (sc?.color || B.blue) : 'transparent', color: a ? B.white : B.gray, cursor: 'pointer', fontFamily: hf, textTransform: 'uppercase' }}>{f === 'all' ? `All (${n})` : `${sc?.label} (${n})`}</button>
            })}
          </div>
        </div>

        {/* Edit modal */}
        {editing && (
          <div style={{ background: B.blue05, borderRadius: 4, padding: 12, border: `1px solid ${B.blue20}`, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <input style={{ ...is, flex: '1 1 120px' }} value={editing.vendor} onChange={e => setEditing(p => ({ ...p, vendor: e.target.value }))} />
              <input style={{ ...is, flex: '2 1 180px' }} value={editing.description || ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
              <input style={{ ...is, flex: '1 1 80px' }} type="number" value={editing.amount} onChange={e => setEditing(p => ({ ...p, amount: e.target.value }))} />
              <input style={{ ...is, flex: '1 1 100px' }} type="date" value={editing.due_date || ''} onChange={e => setEditing(p => ({ ...p, due_date: e.target.value }))} />
              <select style={{ ...is, flex: '1 1 100px', cursor: 'pointer' }} value={editing.category} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={saveEdit} style={{ padding: '5px 12px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: bf }}>Save</button>
              <button onClick={() => setEditing(null)} style={{ padding: '5px 12px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 11, cursor: 'pointer', fontFamily: bf }}>Cancel</button>
            </div>
          </div>
        )}

        {filteredPayables.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: B.gray40, fontSize: 12, fontFamily: bf }}>No payables</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Vendor', 'Description', 'Amount', 'Due', 'Category', 'Status', ''].map(h => (
                <th key={h} style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', padding: '5px 6px', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filteredPayables.map(p => {
                const st = STATUSES.find(s => s.id === p.status)
                const overdue = p.due_date && new Date(p.due_date) < new Date() && p.status !== 'paid'
                return (
                  <tr key={p.id} style={{ background: overdue ? '#FEF2F2' : B.white }}
                    onMouseEnter={e => e.currentTarget.style.background = overdue ? '#FEE2E2' : B.blue05}
                    onMouseLeave={e => e.currentTarget.style.background = overdue ? '#FEF2F2' : B.white}>
                    <td style={{ fontSize: 12, fontWeight: 600, color: B.black, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf, cursor: 'pointer' }} onClick={() => setEditing({ ...p })}>{p.vendor} <span style={{ fontSize: 10, color: B.gray40 }}>✎</span></td>
                    <td style={{ fontSize: 11, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{p.description || '\u2014'}</td>
                    <td style={{ fontSize: 12, fontWeight: 600, color: B.red, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{fmt(p.amount)}</td>
                    <td style={{ fontSize: 11, color: overdue ? B.red : B.gray, fontWeight: overdue ? 600 : 400, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString() : '\u2014'}{overdue ? ' ⚠' : ''}</td>
                    <td style={{ fontSize: 10, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{p.category}</td>
                    <td style={{ padding: '4px 6px', borderBottom: `1px solid ${B.gray20}` }}>
                      <select value={p.status} onChange={e => updatePayableStatus(p.id, e.target.value)} style={{ padding: '2px 4px', borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: `1px solid ${st?.color || B.gray}20`, background: (st?.color || B.gray) + '18', color: st?.color || B.gray, fontFamily: hf }}>
                        {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px', borderBottom: `1px solid ${B.gray20}` }}>
                      <button onClick={() => deletePayable(p.id)} style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 11 }}>x</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Receivable form */}
      {showAddRec && (
        <div style={{ ...box, border: `2px solid #10B98140` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.green, fontFamily: hf, marginBottom: 8 }}>New receivable (money coming in)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ flex: '1 1 150px' }}><input style={is} placeholder="Source (tenant, investor, etc)" value={newRec.source} onChange={e => setNewRec(p => ({ ...p, source: e.target.value }))} /></div>
            <div style={{ flex: '2 1 180px' }}><input style={is} placeholder="Description" value={newRec.description} onChange={e => setNewRec(p => ({ ...p, description: e.target.value }))} /></div>
            <div style={{ flex: '1 1 90px' }}><input style={is} type="number" placeholder="Amount $" value={newRec.amount} onChange={e => setNewRec(p => ({ ...p, amount: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ flex: '1 1 100px' }}><input style={is} type="date" value={newRec.due_date} onChange={e => setNewRec(p => ({ ...p, due_date: e.target.value }))} /></div>
            <div style={{ flex: '1 1 100px' }}>
              <select style={{ ...is, cursor: 'pointer' }} value={newRec.category} onChange={e => setNewRec(p => ({ ...p, category: e.target.value }))}>
                {['Rent', 'Capital call', 'Loan repayment', 'Reimbursement', 'Insurance', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: '2 1 150px' }}><input style={is} placeholder="Notes" value={newRec.notes} onChange={e => setNewRec(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={addReceivable} disabled={!newRec.source || !newRec.amount} style={{ padding: '6px 14px', background: B.green, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: newRec.source && newRec.amount ? 1 : 0.4 }}>Add</button>
            <button onClick={() => setShowAddRec(false)} style={{ padding: '6px 14px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, cursor: 'pointer', fontFamily: bf }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Accounts Receivable */}
      {unpaidReceivables.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.green, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Accounts receivable</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Source', 'Description', 'Amount', 'Due', 'Category', 'Status', ''].map(h => (
                <th key={h} style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', padding: '5px 6px', borderBottom: `2px solid ${B.green}40`, textAlign: 'left', fontFamily: hf }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {unpaidReceivables.map(r => {
                const overdue = r.due_date && new Date(r.due_date) < new Date() && r.status !== 'received'
                return (
                  <tr key={r.id} onMouseEnter={e => e.currentTarget.style.background = '#D1FAE520'} onMouseLeave={e => e.currentTarget.style.background = B.white}>
                    <td style={{ fontSize: 12, fontWeight: 600, color: B.black, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf }}>{r.source}</td>
                    <td style={{ fontSize: 11, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{r.description || '\u2014'}</td>
                    <td style={{ fontSize: 12, fontWeight: 600, color: B.green, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>+{fmt(r.amount)}</td>
                    <td style={{ fontSize: 11, color: overdue ? B.red : B.gray, fontWeight: overdue ? 600 : 400, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{r.due_date ? new Date(r.due_date + 'T12:00:00').toLocaleDateString() : '\u2014'}{overdue ? ' ⚠' : ''}</td>
                    <td style={{ fontSize: 10, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{r.category}</td>
                    <td style={{ padding: '4px 6px', borderBottom: `1px solid ${B.gray20}` }}>
                      <select value={r.status} onChange={e => updateReceivableStatus(r.id, e.target.value)} style={{ padding: '2px 4px', borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: `1px solid ${r.status === 'received' ? B.green : B.gray}20`, background: r.status === 'received' ? B.green + '18' : B.gray + '18', color: r.status === 'received' ? B.green : B.gray, fontFamily: hf }}>
                        <option value="pending">Pending</option>
                        <option value="invoiced">Invoiced</option>
                        <option value="received">Received</option>
                      </select>
                    </td>
                    <td style={{ padding: '6px', borderBottom: `1px solid ${B.gray20}` }}>
                      <button onClick={() => deleteReceivable(r.id)} style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 11 }}>x</button>
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td colSpan={2} style={{ padding: '8px 6px', fontWeight: 700, fontFamily: hf, fontSize: 12, borderTop: `2px solid ${B.gray20}` }}>Total AR</td>
                <td style={{ padding: '8px 6px', fontWeight: 700, color: B.green, fontFamily: hf, fontSize: 14, borderTop: `2px solid ${B.gray20}` }}>+{fmt(totalAR)}</td>
                <td colSpan={4} style={{ borderTop: `2px solid ${B.gray20}` }} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* TRANSACTION HISTORY */}
      <TransactionHistory />

      {/* ANNUAL BUDGET */}
      <AnnualBudget />
    </div>
  )
}

// ─── TRANSACTION HISTORY ───
const TX_CATS = ['Rent collected', 'AM fee', 'Consulting', 'Distribution', 'Debt service', 'Insurance', 'Tax', 'Legal', 'T&E', 'Credit card', 'Transfer', 'Holding costs', 'Other']

function cleanBankDesc(raw) {
  if (!raw) return ''
  const s = raw.toUpperCase()
  if (s.includes('DEPOSIT')) return 'Deposit'
  if (s.includes('CHASE CREDIT CRD')) return 'Chase Credit Card Payment'
  if (s.includes('HARLAND CLARKE')) return 'Check Order — Harland Clarke'
  if (s.includes('FUNDS TRANSFER')) return 'Funds Transfer In'
  if (s.startsWith('CHECK')) return 'Check Written'
  return raw.split('(')[0].trim().slice(0, 50)
}

function TransactionHistory() {
  const [txns, setTxns] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const fetchTxns = useCallback(async () => {
    const { data } = await supabase.from('transactions').select('*').is('deal_id', null).order('date', { ascending: false }).limit(200)
    if (data) setTxns(data)
    setLoading(false)
  }, [])
  useEffect(() => { fetchTxns() }, [fetchTxns])

  const saveTxn = async (id, updates) => {
    await supabase.from('transactions').update(updates).eq('id', id)
    setEditing(null); fetchTxns()
  }
  const deleteTxn = async (id) => {
    await supabase.from('transactions').delete().eq('id', id)
    fetchTxns()
  }

  const filtered = filter === 'all' ? txns : txns.filter(t => t.type === filter)
  const totalIn = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const is = { padding: '3px 6px', border: `1px solid ${B.blue}`, borderRadius: 2, fontSize: 11, fontFamily: bf, outline: 'none', background: '#FFFBEB' }

  return (
    <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}`, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase' }}>Transaction history</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'income', 'expense'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, fontFamily: hf, border: `1px solid ${filter === f ? B.blue : B.gray20}`, background: filter === f ? B.blue : 'transparent', color: filter === f ? B.white : B.gray, cursor: 'pointer', textTransform: 'capitalize' }}>{f}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11, fontFamily: bf }}>
        <span style={{ color: '#065F46' }}>In: ${totalIn.toLocaleString()}</span>
        <span style={{ color: B.red }}>Out: ${totalOut.toLocaleString()}</span>
        <span style={{ color: B.blue, fontWeight: 700 }}>Net: ${(totalIn - totalOut).toLocaleString()}</span>
        <span style={{ color: B.gray40, marginLeft: 'auto', fontSize: 10 }}>Click row to edit</span>
      </div>
      {loading ? <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>Loading...</div> : (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Date', 'Description', 'Category', 'Type', 'Amount', ''].map(h => (
                <th key={h} style={{ background: B.blue05, padding: '4px 8px', fontSize: 10, fontFamily: hf, textAlign: h === 'Amount' ? 'right' : 'left', borderBottom: `1px solid ${B.gray20}`, color: B.blue, position: 'sticky', top: 0 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 12, textAlign: 'center', color: B.gray40, fontSize: 11, fontFamily: bf }}>No transactions</td></tr>}
              {filtered.map(t => {
                const isEd = editing?.id === t.id
                const display = cleanBankDesc(t.description) || t.description || '—'
                return isEd ? (
                  <tr key={t.id} style={{ background: '#FFFBEB' }}>
                    <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}>
                      <input style={{ ...is, width: 90 }} type="date" value={editing.date || ''} onChange={e => setEditing(p => ({ ...p, date: e.target.value }))} />
                    </td>
                    <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}>
                      <input style={{ ...is, width: '100%' }} value={editing.description || ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
                    </td>
                    <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}>
                      <select style={{ ...is }} value={editing.category || 'Other'} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}>
                        {TX_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}` }}>
                      <select style={{ ...is }} value={editing.type || 'expense'} onChange={e => setEditing(p => ({ ...p, type: e.target.value }))}>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                      </select>
                    </td>
                    <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}`, textAlign: 'right' }}>
                      <input style={{ ...is, width: 80, textAlign: 'right' }} type="number" value={editing.amount || ''} onChange={e => setEditing(p => ({ ...p, amount: e.target.value }))} />
                    </td>
                    <td style={{ padding: '3px 4px', borderBottom: `1px solid ${B.gray10}`, whiteSpace: 'nowrap' }}>
                      <button onClick={() => saveTxn(t.id, { description: editing.description, category: editing.category, type: editing.type, amount: Number(editing.amount), date: editing.date })} style={{ fontSize: 10, color: B.blue, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: hf }}>Save</button>
                      <button onClick={() => setEditing(null)} style={{ fontSize: 10, color: B.gray, background: 'none', border: 'none', cursor: 'pointer', fontFamily: bf, marginLeft: 4 }}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id} onClick={() => setEditing({ ...t })} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = B.blue05} onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '4px 8px', fontSize: 11, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, color: B.gray, whiteSpace: 'nowrap' }}>{t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '4px 8px', fontSize: 11, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, maxWidth: 250 }}>{display}</td>
                    <td style={{ padding: '4px 8px', fontSize: 10, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, color: B.gray }}>{t.category || '—'}</td>
                    <td style={{ padding: '4px 8px', fontSize: 10, fontFamily: bf, borderBottom: `1px solid ${B.gray10}`, color: t.type === 'income' ? '#065F46' : B.red }}>{t.type}</td>
                    <td style={{ padding: '4px 8px', fontSize: 11, fontFamily: hf, fontWeight: 600, borderBottom: `1px solid ${B.gray10}`, textAlign: 'right', color: t.type === 'income' ? '#065F46' : B.red }}>
                      {t.type === 'income' ? '+' : '-'}${Number(t.amount).toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 4px', borderBottom: `1px solid ${B.gray10}` }}>
                      <button onClick={e => { e.stopPropagation(); deleteTxn(t.id) }} style={{ fontSize: 10, color: B.gray40, background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── ANNUAL BUDGET ───
function AnnualBudget() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const year = new Date().getFullYear()
  const [txns, setTxns] = useState([])
  
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('transactions').select('*').is('deal_id', null).gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
      if (data) setTxns(data)
    })()
  }, [year])

  // Budget items (monthly recurring)
  const budgetItems = [
    { name: '14415 Import AM Fee', amount: 500, type: 'income' },
    { name: 'Candyroot Consulting', amount: 12000, type: 'income' },
    { name: 'Rent (personal office)', amount: 500, type: 'income' },
  ]

  // Build monthly data
  const monthData = months.map((m, mi) => {
    const monthNum = String(mi + 1).padStart(2, '0')
    const monthTxns = txns.filter(t => t.date && t.date.startsWith(`${year}-${monthNum}`))
    const actualIn = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const actualOut = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const isPast = mi < new Date().getMonth() || (mi === new Date().getMonth() && new Date().getDate() > 15)
    const budgetIn = budgetItems.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)
    const budgetOut = budgetItems.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
    return { month: m, actualIn, actualOut, budgetIn, budgetOut, isPast, hasTxns: monthTxns.length > 0 }
  })

  const totalBudgetIn = budgetItems.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0) * 12
  const totalBudgetOut = budgetItems.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0) * 12
  const totalActualIn = monthData.reduce((s, m) => s + m.actualIn, 0)
  const totalActualOut = monthData.reduce((s, m) => s + m.actualOut, 0)

  const th = { background: '#1a1a2e', color: '#fff', padding: '4px 6px', fontSize: 9, fontFamily: hf, textAlign: 'right', whiteSpace: 'nowrap' }
  const td = (color, bold) => ({ padding: '3px 6px', fontSize: 10, fontFamily: bold ? hf : bf, textAlign: 'right', borderBottom: `1px solid ${B.gray10}`, color: color || B.black, fontWeight: bold ? 700 : 400 })
  const fc = (v) => v > 0 ? '$' + Math.round(v).toLocaleString() : v < 0 ? '-$' + Math.round(Math.abs(v)).toLocaleString() : '—'

  return (
    <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `1px solid ${B.gray20}`, marginBottom: 12, overflowX: 'auto' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 4 }}>{year} Annual budget</div>
      <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 10 }}>
        Recurring income: {budgetItems.filter(b => b.type === 'income').map(b => `${b.name} $${b.amount.toLocaleString()}/mo`).join(' · ')}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={{ ...th, textAlign: 'left' }}></th>
          {months.map(m => <th key={m} style={th}>{m}</th>)}
          <th style={{ ...th, background: '#2A9D8F' }}>Total</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style={{ ...td(B.gray), textAlign: 'left', fontSize: 9 }}>Budget In</td>
            {monthData.map((m, i) => <td key={i} style={td('#8892a4')}>{fc(m.budgetIn)}</td>)}
            <td style={td('#8892a4', true)}>{fc(totalBudgetIn)}</td>
          </tr>
          <tr>
            <td style={{ ...td(B.gray), textAlign: 'left', fontSize: 9 }}>Actual In</td>
            {monthData.map((m, i) => <td key={i} style={td(m.hasTxns ? '#065F46' : B.gray40)}>{m.hasTxns ? fc(m.actualIn) : '—'}</td>)}
            <td style={td('#065F46', true)}>{fc(totalActualIn)}</td>
          </tr>
          <tr>
            <td style={{ ...td(B.gray), textAlign: 'left', fontSize: 9 }}>Actual Out</td>
            {monthData.map((m, i) => <td key={i} style={td(m.hasTxns ? B.red : B.gray40)}>{m.hasTxns ? fc(-m.actualOut) : '—'}</td>)}
            <td style={td(B.red, true)}>{fc(-totalActualOut)}</td>
          </tr>
          <tr style={{ background: '#f8f9fb' }}>
            <td style={{ ...td(B.blue, true), textAlign: 'left', fontSize: 9 }}>Net</td>
            {monthData.map((m, i) => {
              const net = m.hasTxns ? m.actualIn - m.actualOut : m.budgetIn - m.budgetOut
              return <td key={i} style={td(net >= 0 ? '#065F46' : B.red, true)}>{m.hasTxns ? fc(net) : <span style={{ color: B.gray40 }}>{fc(net)}</span>}</td>
            })}
            <td style={td((totalActualIn - totalActualOut) >= 0 ? '#065F46' : B.red, true)}>{fc(totalActualIn - totalActualOut)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ fontSize: 9, color: B.gray60, fontFamily: bf, marginTop: 4 }}>
        Past months show actuals. Future months show budget. Net = income minus expenses.
      </div>
    </div>
  )
}

// Inline editable balance row
function BalanceRow({ account, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(account.balance)
  const save = () => { onUpdate(account.id, val); setEditing(false) }

  return (
    <tr>
      <td style={{ fontSize: 12, fontWeight: 600, color: B.black, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf }}>{account.name}</td>
      <td style={{ fontSize: 11, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{account.bank || '\u2014'}</td>
      <td style={{ fontSize: 11, color: B.gray, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }}>{account.entity || '\u2014'}</td>
      <td style={{ fontSize: 13, fontWeight: 700, color: B.blue, padding: '6px', borderBottom: `1px solid ${B.gray20}`, fontFamily: hf }}>
        {editing ? (
          <input autoFocus type="number" value={val} onChange={e => setVal(e.target.value)}
            onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            style={{ width: 100, padding: '2px 4px', border: `1px solid ${B.blue}`, borderRadius: 2, fontSize: 12, fontFamily: bf, outline: 'none' }} />
        ) : (
          <span onClick={() => setEditing(true)} style={{ cursor: 'text' }}>{fmt(account.balance)}</span>
        )}
      </td>
      <td style={{ padding: '6px', borderBottom: `1px solid ${B.gray20}` }}>
        <button onClick={() => onDelete(account.id)} style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 11 }}>x</button>
      </td>
    </tr>
  )
}
