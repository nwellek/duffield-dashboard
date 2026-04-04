import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, Badge } from '../lib/brand'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CAT_COLORS = { task: '#F59E0B', recurring: '#EF4444', deal: '#1C4587', meeting: '#8B5CF6', deadline: '#EF4444', general: '#6B7280', investor: '#10B981' }

export default function CalendarTab({ deals }) {
  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [recurring, setRecurring] = useState([])
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [form, setForm] = useState({ title: '', date: '', time: '', category: 'general', description: '', deal_id: '' })

  const fetchEvents = useCallback(async () => {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endM = month === 11 ? `${year + 1}-01-31` : `${year}-${String(month + 2).padStart(2, '0')}-28`
    const { data } = await supabase.from('calendar_events').select('*').gte('date', start).lte('date', endM).order('date')
    if (data) setEvents(data)
  }, [month, year])

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').not('due_date', 'is', null).neq('status', 'done')
    if (data) setTasks(data)
  }, [])

  const fetchRecurring = useCallback(async () => {
    const { data } = await supabase.from('recurring_expenses').select('*, deals(address)').eq('is_active', true)
    if (data) setRecurring(data)
  }, [])

  useEffect(() => { fetchEvents(); fetchTasks(); fetchRecurring() }, [fetchEvents, fetchTasks, fetchRecurring])

  const addEvent = async () => {
    if (!form.title || !form.date) return
    await supabase.from('calendar_events').insert({ ...form, deal_id: form.deal_id || null })
    setForm({ title: '', date: '', time: '', category: 'general', description: '', deal_id: '' })
    setShowAdd(false); fetchEvents()
  }
  const deleteEvent = async (id) => { await supabase.from('calendar_events').delete().eq('id', id); fetchEvents() }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  // Collect all events for a given day
  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const items = []

    // Manual events
    events.filter(e => e.date === dateStr).forEach(e => items.push({ id: e.id, title: e.title, cat: e.category, color: CAT_COLORS[e.category] || B.gray, source: 'event', time: e.time }))

    // Task due dates
    tasks.filter(t => t.due_date === dateStr).forEach(t => items.push({ id: 'task_' + t.id, title: t.title, cat: 'task', color: CAT_COLORS.task, source: 'task' }))

    // Recurring expenses (1st of month for monthly, 1st of quarter for quarterly)
    if (day === 1) {
      recurring.filter(r => r.frequency === 'monthly').forEach(r => items.push({ id: 'rec_' + r.id, title: `${r.name} — $${Number(r.amount).toLocaleString()}`, cat: 'recurring', color: CAT_COLORS.recurring, source: 'recurring' }))
    }
    if (day === 1 && [0, 3, 6, 9].includes(month)) {
      recurring.filter(r => r.frequency === 'quarterly').forEach(r => items.push({ id: 'recq_' + r.id, title: `${r.name} — $${Number(r.amount).toLocaleString()}`, cat: 'recurring', color: CAT_COLORS.recurring, source: 'recurring' }))
    }
    if (day === 1 && month === 0) {
      recurring.filter(r => r.frequency === 'annual').forEach(r => items.push({ id: 'reca_' + r.id, title: `${r.name} — $${Number(r.amount).toLocaleString()}`, cat: 'recurring', color: CAT_COLORS.recurring, source: 'recurring' }))
    }

    return items
  }

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const is = { width: '100%', padding: '6px 8px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, fontFamily: bf, color: B.black, outline: 'none', boxSizing: 'border-box', background: B.white }

  const selDayEvents = selectedDate ? getEventsForDay(selectedDate) : []

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: `1px solid ${B.gray20}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer', fontSize: 14, color: B.gray }}>&larr;</button>
          <div style={{ fontSize: 18, fontWeight: 700, color: B.blue, fontFamily: hf }}>{MONTHS[month]} {year}</div>
          <button onClick={nextMonth} style={{ background: 'none', border: `1px solid ${B.gray20}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer', fontSize: 14, color: B.gray }}>&rarr;</button>
          <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()) }} style={{ background: B.blue05, border: `1px solid ${B.blue20}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: B.blue, fontFamily: hf, fontWeight: 600 }}>Today</button>
        </div>
        <button onClick={() => { setForm({ title: '', date: selectedDate ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}` : '', time: '', category: 'general', description: '', deal_id: '' }); setShowAdd(true) }} style={{ padding: '7px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>+ Add event</button>
      </div>

      {/* Add event form */}
      {showAdd && (
        <div style={{ background: B.white, borderRadius: 4, padding: 14, border: `2px solid ${B.blue20}`, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ flex: '2 1 180px' }}><input style={is} placeholder="Event title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div style={{ flex: '1 1 110px' }}><input style={is} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div style={{ flex: '1 1 80px' }}><input style={is} type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} /></div>
            <div style={{ flex: '1 1 100px' }}>
              <select style={{ ...is, cursor: 'pointer' }} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {['general', 'meeting', 'deadline', 'investor', 'deal'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={addEvent} disabled={!form.title || !form.date} style={{ padding: '6px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: form.title && form.date ? 1 : 0.4 }}>Save</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '6px 14px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 12, cursor: 'pointer', fontFamily: bf }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* Calendar grid */}
        <div style={{ flex: '3 1 400px', minWidth: 300 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: B.gray20, borderRadius: 4, overflow: 'hidden' }}>
            {DAYS.map(d => <div key={d} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: B.gray, fontFamily: hf, background: B.white, textTransform: 'uppercase' }}>{d}</div>)}
            {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} style={{ background: B.gray10, minHeight: 119, padding: 4 }} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayEvents = getEventsForDay(day)
              const isSel = selectedDate === day
              return (
                <div key={day} onClick={() => setSelectedDate(isSel ? null : day)} style={{
                  background: isSel ? B.blue05 : B.white, minHeight: 119, padding: 4, cursor: 'pointer',
                  border: isToday(day) ? `2px solid ${B.blue}` : isSel ? `2px solid ${B.blue20}` : '2px solid transparent',
                }}>
                  <div style={{ fontSize: 11, fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? B.blue : B.black, fontFamily: hf, marginBottom: 2 }}>{day}</div>
                  {dayEvents.slice(0, 3).map(ev => (
                    <div key={ev.id} style={{ fontSize: 9, padding: '1px 3px', marginBottom: 1, borderRadius: 2, background: ev.color + '18', color: ev.color, fontFamily: bf, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `2px solid ${ev.color}` }}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <div style={{ fontSize: 9, color: B.gray, fontFamily: bf }}>+{dayEvents.length - 3} more</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <div style={{ flex: '1 1 220px', minWidth: 200 }}>
          <div style={{ background: B.white, borderRadius: 4, padding: 14, border: `1px solid ${B.gray20}`, position: 'sticky', top: 16 }}>
            {selectedDate ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 8 }}>
                  {MONTHS[month]} {selectedDate}, {year}
                </div>
                {selDayEvents.length === 0 ? (
                  <div style={{ fontSize: 12, color: B.gray40, fontFamily: bf }}>No events</div>
                ) : (
                  selDayEvents.map(ev => (
                    <div key={ev.id} style={{ padding: '8px 10px', borderRadius: 4, marginBottom: 6, background: ev.color + '08', borderLeft: `3px solid ${ev.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: B.black, fontFamily: hf }}>{ev.title}</div>
                        {ev.source === 'event' && <button onClick={() => deleteEvent(ev.id)} style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>x</button>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                        <Badge bg={ev.color + '18'} color={ev.color} style={{ fontSize: 9 }}>{ev.cat}</Badge>
                        {ev.time && <span style={{ fontSize: 10, color: B.gray, fontFamily: bf }}>{ev.time}</span>}
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 8 }}>Upcoming</div>
                {[...events.filter(e => e.date >= today.toISOString().slice(0, 10)).slice(0, 5),
                  ...tasks.filter(t => t.due_date >= today.toISOString().slice(0, 10)).slice(0, 5).map(t => ({ ...t, date: t.due_date, category: 'task' }))
                ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8).map(ev => (
                  <div key={ev.id} style={{ padding: '5px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 11, fontFamily: bf }}>
                    <span style={{ color: B.gray, marginRight: 6 }}>{new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span style={{ color: B.black, fontWeight: 500 }}>{ev.title}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
