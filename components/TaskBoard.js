import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, Badge } from '../lib/brand'

const COLS = [
  { id: 'todo', label: 'To Do', color: B.gray },
  { id: 'in_progress', label: 'In Progress', color: B.amber },
  { id: 'done', label: 'Done', color: B.green },
]
const PRIORITIES = ['high', 'medium', 'low']
const CATEGORIES = ['General', 'Deal', 'Legal', 'Finance', 'Construction', 'Leasing', 'Investor', 'Admin']
const PC = { high: '#EF4444', medium: '#F59E0B', low: '#6B7280' }

export default function TaskBoard({ deals }) {
  const [tasks, setTasks] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', status: 'todo', priority: 'medium', assignee: 'Nate', deal_id: '', due_date: '', category: 'General' })
  const [dragId, setDragId] = useState(null)

  const fetch_ = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('priority').order('created_at', { ascending: false })
    if (data) setTasks(data)
  }, [])
  useEffect(() => { fetch_() }, [fetch_])

  const save = async () => {
    const rec = { ...form, deal_id: form.deal_id || null, due_date: form.due_date || null }
    if (editing) {
      await supabase.from('tasks').update({ ...rec, updated_at: new Date().toISOString() }).eq('id', editing.id)
    } else {
      await supabase.from('tasks').insert(rec)
    }
    setShowAdd(false); setEditing(null)
    setForm({ title: '', description: '', status: 'todo', priority: 'medium', assignee: 'Nate', deal_id: '', due_date: '', category: 'General' })
    fetch_()
  }

  const del = async (id) => { await supabase.from('tasks').delete().eq('id', id); fetch_() }

  const startEdit = (t) => {
    setForm({ title: t.title, description: t.description || '', status: t.status, priority: t.priority, assignee: t.assignee || 'Nate', deal_id: t.deal_id || '', due_date: t.due_date || '', category: t.category || 'General' })
    setEditing(t); setShowAdd(true)
  }

  const onDrop = async (colId) => {
    if (!dragId) return
    await supabase.from('tasks').update({ status: colId, updated_at: new Date().toISOString() }).eq('id', dragId)
    setDragId(null); fetch_()
  }

  const is = { width: '100%', padding: '7px 9px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, fontFamily: bf, color: B.black, outline: 'none', boxSizing: 'border-box', background: B.white }

  const ownedDeals = (deals || []).filter(d => d.status !== 'dead')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: B.gray, fontFamily: bf }}>{tasks.length} tasks &middot; {tasks.filter(t => t.status === 'todo').length} to do &middot; {tasks.filter(t => t.status === 'in_progress').length} in progress</div>
        <button onClick={() => { setEditing(null); setForm({ title: '', description: '', status: 'todo', priority: 'medium', assignee: 'Nate', deal_id: '', due_date: '', category: 'General' }); setShowAdd(true) }} style={{ padding: '7px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>+ Add task</button>
      </div>

      {/* Add/Edit modal */}
      {showAdd && (
        <div style={{ background: B.white, borderRadius: 4, padding: 16, border: `2px solid ${B.blue20}`, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 10 }}>{editing ? 'Edit task' : 'New task'}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ flex: '2 1 200px' }}><input style={is} placeholder="Task title..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div style={{ flex: '1 1 100px' }}>
              <select style={{ ...is, cursor: 'pointer' }} value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <select style={{ ...is, cursor: 'pointer' }} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ flex: '1 1 120px' }}><input style={is} type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
            <div style={{ flex: '1 1 150px' }}>
              <select style={{ ...is, cursor: 'pointer' }} value={form.deal_id} onChange={e => setForm(p => ({ ...p, deal_id: e.target.value }))}>
                <option value="">No deal linked</option>
                {ownedDeals.slice(0, 50).map(d => <option key={d.id} value={d.id}>{d.address} — {d.city}</option>)}
              </select>
            </div>
          </div>
          <textarea style={{ ...is, minHeight: 50, resize: 'vertical', marginBottom: 6 }} placeholder="Description / notes..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={save} disabled={!form.title.trim()} style={{ padding: '7px 16px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: form.title.trim() ? 1 : 0.4 }}>{editing ? 'Update' : 'Add'}</button>
            <button onClick={() => { setShowAdd(false); setEditing(null) }} style={{ padding: '7px 16px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, cursor: 'pointer', fontFamily: bf }}>Cancel</button>
            {editing && <button onClick={() => { del(editing.id); setShowAdd(false); setEditing(null) }} style={{ padding: '7px 16px', background: 'transparent', color: B.red, border: `1px solid ${B.redLight}`, borderRadius: 3, fontSize: 12, cursor: 'pointer', fontFamily: bf, marginLeft: 'auto' }}>Delete</button>}
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div style={{ display: 'flex', gap: 10, minHeight: 400 }}>
        {COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id).sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority))
          return (
            <div key={col.id} style={{ flex: 1, minWidth: 0 }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = B.blue05 }}
              onDragLeave={e => { e.currentTarget.style.background = 'transparent' }}
              onDrop={e => { e.currentTarget.style.background = 'transparent'; onDrop(col.id) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '6px 8px', background: col.color + '12', borderRadius: 4, borderLeft: `3px solid ${col.color}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: col.color, fontFamily: hf, textTransform: 'uppercase' }}>{col.label}</span>
                <span style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>({colTasks.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {colTasks.map(t => {
                  const dealName = t.deal_id ? (deals || []).find(d => d.id === t.deal_id)?.address : null
                  const overdue = t.due_date && new Date(t.due_date + 'T23:59:59') < new Date() && t.status !== 'done'
                  return (
                    <div key={t.id} draggable onDragStart={() => setDragId(t.id)}
                      onClick={() => startEdit(t)}
                      style={{ background: B.white, borderRadius: 4, padding: '10px 12px', border: `1px solid ${overdue ? B.red : B.gray20}`, cursor: 'pointer', borderLeft: `3px solid ${PC[t.priority]}` }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: B.black, fontFamily: hf, marginBottom: 3 }}>{t.title}</div>
                      {t.description && <div style={{ fontSize: 10, color: B.gray60, fontFamily: bf, marginBottom: 4, lineHeight: 1.3 }}>{t.description.slice(0, 80)}{t.description.length > 80 ? '...' : ''}</div>}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Badge bg={PC[t.priority] + '18'} color={PC[t.priority]} style={{ fontSize: 9 }}>{t.priority}</Badge>
                        {t.category && t.category !== 'General' && <Badge bg={B.blue10} color={B.blue} style={{ fontSize: 9 }}>{t.category}</Badge>}
                        {dealName && <span style={{ fontSize: 9, color: B.gray, fontFamily: bf }}>{dealName}</span>}
                      </div>
                      {t.due_date && <div style={{ fontSize: 10, color: overdue ? B.red : B.gray, fontFamily: bf, marginTop: 4 }}>{overdue ? '⚠ Overdue: ' : 'Due: '}{new Date(t.due_date + 'T12:00:00').toLocaleDateString()}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
