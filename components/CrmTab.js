import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, Badge } from '../lib/brand'

const CATEGORIES = ['All', 'Investor', 'Broker', 'Lender', 'Seller', 'Partner', 'Mentor', 'Contact', 'Golf', 'Other']
const CC = { Investor: '#10B981', Broker: '#1C4587', Lender: '#F59E0B', Seller: '#14B8A6', Partner: '#8B5CF6', Mentor: '#6366F1', Contact: '#6B7280', Golf: '#059669', Other: '#9CA3AF' }

export default function CrmTab() {
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [sk, setSk] = useState('name')
  const [sd, setSd] = useState(1)

  const fetch_ = useCallback(async () => {
    let all = [], offset = 0, pageSize = 1000, hasMore = true
    while (hasMore) {
      const { data } = await supabase.from('contacts').select('*').order('name').range(offset, offset + pageSize - 1)
      if (!data || data.length === 0) { hasMore = false; break }
      all = all.concat(data)
      if (data.length < pageSize) hasMore = false
      else offset += pageSize
    }
    setContacts(all)
    // contacts already set in pagination loop above
  }, [])
  useEffect(() => { fetch_() }, [fetch_])

  const save = async (c) => {
    const cl = { ...c, updated_at: new Date().toISOString() }
    if (c.id) await supabase.from('contacts').update(cl).eq('id', c.id)
    else { delete cl.id; await supabase.from('contacts').insert(cl) }
    setEditing(null); setShowForm(false); fetch_()
  }
  const del = async (id) => { await supabase.from('contacts').delete().eq('id', id); setEditing(null); fetch_() }

  let fd = contacts
  if (catFilter !== 'All') fd = fd.filter(c => c.category && c.category.includes(catFilter))
  if (search.trim().length >= 2) {
    const q = search.toLowerCase()
    fd = fd.filter(c => (c.name && c.name.toLowerCase().includes(q)) || (c.company && c.company.toLowerCase().includes(q)) || (c.notes && c.notes.toLowerCase().includes(q)))
  }

  const sorted = [...fd].sort((a, b) => {
    let av = a[sk], bv = b[sk]
    if (typeof av === 'string') return sd * (av || '').localeCompare(bv || '')
    return sd * ((Number(av) || 0) - (Number(bv) || 0))
  })
  const tg = k => { if (sk === k) setSd(d => d * -1); else { setSk(k); setSd(1) } }

  const catCounts = {}
  contacts.forEach(c => { (c.category || 'Other').split(', ').forEach(cat => { catCounts[cat] = (catCounts[cat] || 0) + 1 }) })

  if (editing || showForm) {
    return <ContactForm contact={editing || { name: '', category: 'Contact', company: '', title: '', phone: '', email: '', city: '', notes: '' }} onSave={save} onCancel={() => { setEditing(null); setShowForm(false) }} onDelete={editing ? del : null} />
  }

  const th = { fontSize: 10, fontWeight: 700, color: B.gray, textTransform: 'uppercase', letterSpacing: 0.3, padding: '6px 8px', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `2px solid ${B.blue20}`, textAlign: 'left', fontFamily: hf }
  const td = { fontSize: 12, color: B.black, padding: '6px 8px', borderBottom: `1px solid ${B.gray20}`, fontFamily: bf }

  return (
    <div>
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={fetch_} />}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {['Investor', 'Broker', 'Lender', 'Seller', 'Partner', 'Mentor'].map(cat => (
          <div key={cat} style={{ flex: '1 1 80px', background: B.white, borderRadius: 4, padding: '8px 10px', border: `1px solid ${B.gray20}`, minWidth: 70, cursor: 'pointer' }} onClick={() => setCatFilter(catFilter === cat ? 'All' : cat)}>
            <div style={{ fontSize: 9, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>{cat}s</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: CC[cat], fontFamily: hf }}>{catCounts[cat] || 0}</div>
          </div>
        ))}
        <div style={{ flex: '1 1 80px', background: B.white, borderRadius: 4, padding: '8px 10px', border: `1px solid ${B.gray20}`, minWidth: 70 }}>
          <div style={{ fontSize: 9, color: B.gray, fontFamily: bf, textTransform: 'uppercase' }}>Total</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: B.blue, fontFamily: hf }}>{contacts.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ padding: '6px 10px', border: `1px solid ${B.gray20}`, borderRadius: 3, fontSize: 12, fontFamily: bf, color: B.black, width: 220, outline: 'none' }} placeholder="Search name, company, notes..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => {
            const n = cat === 'All' ? contacts.length : (catCounts[cat] || 0)
            if (n === 0 && cat !== 'All') return null
            const a = catFilter === cat
            return <button key={cat} onClick={() => setCatFilter(a ? 'All' : cat)} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: a ? 700 : 400, border: `1px solid ${a ? (CC[cat] || B.blue) : B.gray20}`, background: a ? (CC[cat] || B.blue) : 'transparent', color: a ? B.white : B.gray, cursor: 'pointer', fontFamily: hf, textTransform: 'uppercase' }}>{cat}</button>
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{sorted.length}</span>
          <button onClick={() => setShowImport(true)} style={{ padding: '7px 14px', background: B.white, color: B.blue, border: `2px solid ${B.blue}`, borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>Import</button>
          <button onClick={() => setShowForm(true)} style={{ padding: '7px 14px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>+ Add</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 3, border: `1px solid ${B.gray20}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: B.white }}>
          <thead><tr>
            <th style={th} onClick={() => tg('name')}>Name {sk === 'name' ? (sd > 0 ? '\u2191' : '\u2193') : ''}</th>
            <th style={th} onClick={() => tg('category')}>Type</th>
            <th style={th} onClick={() => tg('company')}>Company</th>
            <th style={th}>Phone</th>
            <th style={th}>Email</th>
            <th style={th} onClick={() => tg('city')}>City</th>
            <th style={{ ...th, minWidth: 200 }}>Notes</th>
          </tr></thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: B.gray40, fontSize: 12, fontFamily: bf }}>No contacts match</td></tr>}
            {sorted.map(c => {
              const cats = (c.category || 'Other').split(', ')
              return (
                <tr key={c.id} onClick={() => setEditing(c)} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = B.blue05} onMouseLeave={e => e.currentTarget.style.background = B.white}>
                  <td style={{ ...td, fontWeight: 600, fontFamily: hf, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: CC[cats[0]] || B.gray, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: B.white, fontFamily: hf, flexShrink: 0 }}>
                        {c.name ? c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
                      </div>
                      {c.name}
                    </div>
                  </td>
                  <td style={td}><div style={{ display: 'flex', gap: 3 }}>{cats.map(cat => <Badge key={cat} bg={(CC[cat] || B.gray) + '18'} color={CC[cat] || B.gray} style={{ fontSize: 9 }}>{cat}</Badge>)}</div></td>
                  <td style={{ ...td, fontSize: 11, color: B.gray }}>{c.company || '\u2014'}</td>
                  <td style={{ ...td, fontSize: 11 }}>{c.phone ? <a href={'tel:' + c.phone} style={{ color: B.blue, textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{c.phone}</a> : '\u2014'}</td>
                  <td style={{ ...td, fontSize: 11 }}>{c.email ? <a href={'mailto:' + c.email} style={{ color: B.blue, textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{c.email}</a> : '\u2014'}</td>
                  <td style={{ ...td, fontSize: 11, color: B.gray }}>{c.city || '\u2014'}</td>
                  <td style={{ ...td, fontSize: 11, color: B.gray, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes || '\u2014'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── IMPORT MODAL ───
function ImportModal({ onClose, onImported }) {
  const [mode, setMode] = useState('file') // file, card
  const [file, setFile] = useState(null)
  const [cardFile, setCardFile] = useState(null)
  const [cardPreview, setCardPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleFileUpload = async () => {
    if (!file) return
    setLoading(true); setError(''); setResult(null)
    try {
      const ext = file.name.split('.').pop().toLowerCase()

      if (ext === 'csv') {
        const text = await file.text()
        const res = await fetch('/api/contacts-import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'csv', data: text, filename: file.name }),
        })
        const data = await res.json()
        if (res.ok) { setResult(data); onImported() } else setError(data.error)

      } else if (ext === 'xlsx' || ext === 'xls') {
        const arrayBuffer = await file.arrayBuffer()
        const XLSX = require('xlsx')
        const wb = XLSX.read(arrayBuffer)
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws)
        const res = await fetch('/api/contacts-import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'json', data: json, filename: file.name }),
        })
        const data = await res.json()
        if (res.ok) { setResult(data); onImported() } else setError(data.error)

      } else if (ext === 'pdf') {
        const base64 = await toBase64(file)
        const res = await fetch('/api/contacts-import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pdf', data: base64, filename: file.name }),
        })
        const data = await res.json()
        if (res.ok) { setResult(data); onImported() } else setError(data.error)
      } else {
        setError('Unsupported file type. Use .csv, .xlsx, or .pdf')
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const handleCardUpload = async () => {
    if (!cardFile) return
    setLoading(true); setError(''); setResult(null)
    try {
      const base64 = await toBase64(cardFile)
      const res = await fetch('/api/contacts-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'image', data: base64, filename: cardFile.name }),
      })
      const data = await res.json()
      if (res.ok) { setResult(data); onImported() } else setError(data.error)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const toBase64 = (f) => new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result.split(',')[1])
    r.onerror = reject
    r.readAsDataURL(f)
  })

  const handleCardSelect = (f) => {
    setCardFile(f)
    const url = URL.createObjectURL(f)
    setCardPreview(url)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: B.white, borderRadius: 6, padding: 24, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: B.blue, fontFamily: hf }}>Import contacts</div>
            <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>Duplicates by email are skipped automatically</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: B.gray, cursor: 'pointer' }}>x</button>
        </div>

        {!result && (
          <>
            <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
              <button onClick={() => setMode('file')} style={{ flex: 1, padding: '8px 0', borderRadius: 3, fontSize: 12, fontWeight: mode === 'file' ? 700 : 400, border: `1px solid ${mode === 'file' ? B.blue : B.gray20}`, background: mode === 'file' ? B.blue : 'transparent', color: mode === 'file' ? B.white : B.gray, cursor: 'pointer', fontFamily: hf }}>CSV / Excel / PDF</button>
              <button onClick={() => setMode('card')} style={{ flex: 1, padding: '8px 0', borderRadius: 3, fontSize: 12, fontWeight: mode === 'card' ? 700 : 400, border: `1px solid ${mode === 'card' ? B.blue : B.gray20}`, background: mode === 'card' ? B.blue : 'transparent', color: mode === 'card' ? B.white : B.gray, cursor: 'pointer', fontFamily: hf }}>Business card photo</button>
            </div>

            {mode === 'file' && (
              <div>
                <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 6 }}>Upload a CSV, Excel (.xlsx), or PDF with contact info. Column headers should include: name, email, phone, company, title, city, category, notes.</div>
                <div style={{ border: `2px dashed ${B.gray40}`, borderRadius: 4, padding: 24, textAlign: 'center', cursor: 'pointer', background: file ? B.blue05 : B.gray10 }}
                  onClick={() => document.getElementById('crm-file-upload').click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.blue; e.currentTarget.style.background = B.blue05 }}
                  onDragLeave={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.gray40; e.currentTarget.style.background = B.gray10 }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.gray40; if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]) }}>
                  <input id="crm-file-upload" type="file" accept=".csv,.xlsx,.xls,.pdf" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]) }} />
                  {file ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: B.blue, fontFamily: hf }}>{file.name}</div>
                      <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{(file.size / 1024).toFixed(0)} KB</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: B.gray, fontFamily: bf }}>Click to select file</div>
                  )}
                </div>
                <button onClick={handleFileUpload} disabled={loading || !file} style={{ marginTop: 10, width: '100%', padding: '10px 0', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: hf, opacity: loading || !file ? 0.5 : 1 }}>
                  {loading ? 'Importing...' : 'Import contacts'}
                </button>
              </div>
            )}

            {mode === 'card' && (
              <div>
                <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 6 }}>Take a photo or upload an image of a business card. AI reads it and adds the contact.</div>
                <div style={{ border: `2px dashed ${B.gray40}`, borderRadius: 4, padding: cardPreview ? 8 : 24, textAlign: 'center', cursor: 'pointer', background: cardFile ? B.blue05 : B.gray10 }}
                  onClick={() => document.getElementById('crm-card-upload').click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.blue; e.currentTarget.style.background = B.blue05 }}
                  onDragLeave={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.gray40; e.currentTarget.style.background = B.gray10 }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.gray40; if (e.dataTransfer.files[0]) handleCardSelect(e.dataTransfer.files[0]) }}>
                  <input id="crm-card-upload" type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) handleCardSelect(e.target.files[0]) }} />
                  {cardPreview ? (
                    <img src={cardPreview} style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }} alt="Business card" />
                  ) : (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
                      <div style={{ fontSize: 13, color: B.gray, fontFamily: bf }}>Take photo or upload image</div>
                    </div>
                  )}
                </div>
                <button onClick={handleCardUpload} disabled={loading || !cardFile} style={{ marginTop: 10, width: '100%', padding: '10px 0', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: hf, opacity: loading || !cardFile ? 0.5 : 1 }}>
                  {loading ? 'Reading card...' : 'Read & add contact'}
                </button>
              </div>
            )}

            {loading && <div style={{ marginTop: 10, padding: 10, background: B.blue05, borderRadius: 3, fontSize: 12, color: B.blue, fontFamily: bf, textAlign: 'center' }}>{mode === 'card' ? 'AI is reading the business card...' : 'Processing file...'}</div>}
          </>
        )}

        {error && <div style={{ marginTop: 10, padding: 10, background: B.redLight, borderRadius: 3, color: B.redDark, fontSize: 12, fontFamily: bf }}>{error}</div>}

        {result && (
          <div>
            <div style={{ background: '#D1FAE5', borderRadius: 4, padding: 14, textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#065F46', fontFamily: hf }}>{result.imported} imported</div>
              <div style={{ fontSize: 12, color: '#065F46', fontFamily: bf }}>{result.skipped} skipped (duplicate email) &middot; {result.total_processed} total processed</div>
            </div>

            {result.new_contacts && result.new_contacts.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 4 }}>Added:</div>
                {result.new_contacts.slice(0, 10).map((c, i) => (
                  <div key={i} style={{ fontSize: 12, fontFamily: bf, padding: '2px 0' }}>{c.name} {c.email ? '(' + c.email + ')' : ''} — {c.category}</div>
                ))}
                {result.new_contacts.length > 10 && <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>+ {result.new_contacts.length - 10} more</div>}
              </div>
            )}

            {result.skipped_contacts && result.skipped_contacts.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: B.amber, fontFamily: hf, marginBottom: 4 }}>Skipped (duplicate):</div>
                {result.skipped_contacts.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{c.name} — {c.email}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '9px 0', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>Done</button>
              <button onClick={() => { setResult(null); setFile(null); setCardFile(null); setCardPreview(null); setError('') }} style={{ padding: '9px 14px', background: 'transparent', color: B.blue, border: `1px solid ${B.blue20}`, borderRadius: 3, fontSize: 13, cursor: 'pointer', fontFamily: bf }}>Import more</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CONTACT FORM ───
function ContactForm({ contact, onSave, onCancel, onDelete }) {
  const [c, setC] = useState({ ...contact })
  const [saving, setSaving] = useState(false)
  const set = useCallback((k, v) => setC(p => ({ ...p, [k]: v })), [])
  const handleSave = async () => { setSaving(true); await onSave(c); setSaving(false) }

  const is = { width: '100%', padding: '8px 10px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 13, color: B.black, background: B.white, outline: 'none', boxSizing: 'border-box', fontFamily: bf }
  const ls = { fontSize: 11, fontWeight: 500, color: B.gray, marginBottom: 2, display: 'block', fontFamily: bf }

  // Render field inline instead of as a component to avoid remount/focus loss
  const renderField = (l, k, ph, h) => (
    <div style={{ flex: h ? '1 1 47%' : '1 1 100%', minWidth: h ? 140 : 'auto' }}>
      <label style={ls}>{l}</label>
      <input style={is} placeholder={ph} value={c[k] ?? ''} onChange={e => set(k, e.target.value)} />
    </div>
  )

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: B.blue, marginBottom: 14, fontFamily: hf }}>{contact.id ? 'Edit contact' : 'New contact'}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{renderField("Full name", "name", "John Smith", true)}
        <div style={{ flex: '1 1 47%', minWidth: 140 }}>
          <label style={ls}>Category</label>
          <select style={{ ...is, cursor: 'pointer' }} value={c.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.filter(x => x !== 'All').map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{renderField("Company", "company", "Burnham Industrial", true)}{renderField("Title", "title", "Managing Director", true)}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{renderField("Phone", "phone", "(312) 555-0100", true)}{renderField("Email", "email", "john@company.com", true)}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{renderField("City", "city", "Chicago, IL", true)}
        <div style={{ flex: '1 1 47%', minWidth: 140 }}>
          <label style={ls}>Last contact</label>
          <input style={is} type="date" value={c.last_contact_date || ''} onChange={e => set('last_contact_date', e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={ls}>Notes</label>
        <textarea style={{ ...is, minHeight: 80, resize: 'vertical' }} value={c.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="How you know them, deal involvement..." />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={handleSave} disabled={saving || !c.name} style={{ padding: '8px 18px', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: bf, opacity: saving || !c.name ? 0.5 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
        <button onClick={onCancel} style={{ padding: '8px 18px', background: 'transparent', color: B.gray, border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 13, cursor: 'pointer', fontFamily: bf }}>Cancel</button>
        {onDelete && contact.id && <button onClick={() => onDelete(contact.id)} style={{ padding: '8px 18px', background: 'transparent', color: B.red, border: `1px solid ${B.redLight}`, borderRadius: 3, fontSize: 13, cursor: 'pointer', marginLeft: 'auto', fontFamily: bf }}>Delete</button>}
      </div>
    </div>
  )
}
