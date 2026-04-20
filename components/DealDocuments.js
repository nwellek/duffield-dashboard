import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, Badge } from '../lib/brand'

const DOC_TYPES = ['LOI', 'PSA', 'Lease', 'Loan', 'Insurance', 'Inspection', 'Appraisal', 'Survey', 'Title', 'Environmental', 'Tax', 'OM', 'Invoice', 'Legal', 'Other']
const DT_COLORS = { LOI: '#F59E0B', PSA: '#1C4587', Lease: '#10B981', Loan: '#8B5CF6', Insurance: '#6366F1', Inspection: '#14B8A6', OM: '#059669', Invoice: '#EF4444', Legal: '#6B7280', Other: '#9CA3AF' }

const FIELD_LABELS = {
  asking_price: 'Asking Price',
  building_sf: 'Building SF',
  lot_acres: 'Lot Acres',
  clear_height: 'Clear Height (ft)',
  dock_doors: 'Dock Doors',
  cap_rate: 'Cap Rate (%)',
  zoning: 'Zoning',
  property_type: 'Property Type',
  owner: 'Owner',
  contact_name: 'Contact Name',
  contact_method: 'Contact Method',
  address: 'Address',
  city: 'City',
  state: 'State',
  year_built: 'Year Built',
  price_per_sf: 'Price/SF',
}

function cleanNum(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  const cleaned = String(v).replace(/[$,\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function formatVal(k, v) {
  if (v === null || v === undefined) return '—'
  if (['asking_price', 'price_per_sf'].includes(k) && typeof v === 'number') return '$' + v.toLocaleString()
  if (k === 'building_sf' && typeof v === 'number') return v.toLocaleString() + ' SF'
  if (k === 'lot_acres') return v + ' acres'
  if (k === 'clear_height') return v + ' ft'
  if (k === 'cap_rate') return v + '%'
  return String(v)
}

export default function DealDocuments({ dealId, deal, onDealUpdated }) {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [reading, setReading] = useState(null)
  const [readingAll, setReadingAll] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [pendingFields, setPendingFields] = useState(null)

  const fetchDocs = useCallback(async () => {
    if (!dealId) return
    const { data } = await supabase.from('deal_documents').select('*').eq('deal_id', dealId).order('uploaded_at', { ascending: false })
    if (data) setDocs(data)
  }, [dealId])
  useEffect(() => { fetchDocs() }, [fetchDocs])

  const uploadFile = async (file) => {
    if (!file || !dealId) return
    setUploading(true)
    try {
      const filePath = `${dealId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('deal-oms').upload(filePath, file, { upsert: true })
      if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(false); return }
      const { data: urlData } = supabase.storage.from('deal-oms').getPublicUrl(filePath)
      const fileUrl = urlData?.publicUrl || filePath
      const nameLower = file.name.toLowerCase()
      let docType = 'Other'
      if (nameLower.includes('loi')) docType = 'LOI'
      else if (nameLower.includes('psa') || nameLower.includes('purchase')) docType = 'PSA'
      else if (nameLower.includes('lease')) docType = 'Lease'
      else if (nameLower.includes('loan') || nameLower.includes('promissory') || nameLower.includes('note')) docType = 'Loan'
      else if (nameLower.includes('insurance') || nameLower.includes('policy')) docType = 'Insurance'
      else if (nameLower.includes('inspect') || nameLower.includes('pca') || nameLower.includes('esa')) docType = 'Inspection'
      else if (nameLower.includes('survey')) docType = 'Survey'
      else if (nameLower.includes('title')) docType = 'Title'
      else if (nameLower.includes('environ') || nameLower.includes('phase')) docType = 'Environmental'
      else if (nameLower.includes('tax')) docType = 'Tax'
      else if (nameLower.includes('om') || nameLower.includes('memo') || nameLower.includes('offering')) docType = 'OM'
      else if (nameLower.includes('invoice')) docType = 'Invoice'
      else if (nameLower.includes('legal') || nameLower.includes('agreement') || nameLower.includes('contract')) docType = 'Legal'
      await supabase.from('deal_documents').insert({ deal_id: dealId, filename: file.name, file_url: fileUrl, file_size: file.size, doc_type: docType })
      fetchDocs()
    } catch (e) { alert('Error: ' + e.message) }
    setUploading(false)
  }

  const aiReadDoc = async (doc) => {
    if (!doc.file_url || reading) return
    const ext = doc.filename.split('.').pop().toLowerCase()
    if (ext !== 'pdf') { alert('AI read only works on PDFs'); return }
    setReading(doc.id)
    try {
      // Pass the storage URL to the API — it downloads server-side (avoids Vercel body size limit)
      const res = await fetch('/api/doc-read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_url: doc.file_url, filename: doc.filename, doc_id: doc.id }),
      })
      if (res.ok) {
        const result = await res.json()
        await supabase.from('deal_documents').update({
          ai_summary: result.summary, ai_extracted: result.extracted, doc_type: result.doc_type || doc.doc_type,
        }).eq('id', doc.id)

        if (result.deal_fields) {
          const f = result.deal_fields
          const fieldMap = {}
          const numFields = ['asking_price', 'building_sf', 'lot_acres', 'clear_height', 'dock_doors', 'cap_rate', 'year_built', 'price_per_sf']
          for (const k of numFields) {
            const cleaned = cleanNum(f[k])
            if (cleaned !== null) {
              const current = deal ? cleanNum(deal[k]) : null
              fieldMap[k] = { value: cleaned, current, changed: current !== null ? current !== cleaned : true }
            }
          }
          const strFields = ['zoning', 'property_type', 'owner', 'contact_name', 'contact_method', 'address', 'city', 'state']
          for (const k of strFields) {
            if (f[k] && typeof f[k] === 'string' && (k !== 'state' || f[k].length <= 2)) {
              const current = deal ? deal[k] : null
              fieldMap[k] = { value: f[k], current: current || null, changed: current ? current !== f[k] : true }
            }
          }
          if (Object.keys(fieldMap).length > 0) {
            for (const k of Object.keys(fieldMap)) {
              fieldMap[k].accepted = fieldMap[k].current === null ? true : null
            }
            setPendingFields({ fields: fieldMap, notes: f.notes_append, docName: doc.filename })
          }
        }
        fetchDocs()
      } else {
        let errMsg = 'AI read failed'
        try { const e = await res.json(); errMsg = e.error || errMsg } catch(e) {}
        alert(errMsg)
      }
    } catch (e) { alert('AI read error: ' + e.message) }
    setReading(null)
  }

  const aiReadAll = async () => {
    const pdfs = docs.filter(d => d.filename.toLowerCase().endsWith('.pdf') && !d.ai_summary)
    if (pdfs.length === 0) return
    setReadingAll(true)
    for (const doc of pdfs) { await aiReadDoc(doc) }
    setReadingAll(false)
  }

  const applyApproved = async () => {
    if (!pendingFields) return
    const updates = {}
    for (const [k, v] of Object.entries(pendingFields.fields)) {
      if (v.accepted === true) updates[k] = v.value
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('deals').update(updates).eq('id', dealId)
    }
    if (pendingFields.notes) {
      const { data: current } = await supabase.from('deals').select('notes').eq('id', dealId).single()
      const newNotes = (current?.notes || '') + '\n[AI: ' + pendingFields.docName + '] ' + pendingFields.notes
      await supabase.from('deals').update({ notes: newNotes.trim() }).eq('id', dealId)
    }
    setPendingFields(null)
    if (onDealUpdated) onDealUpdated()
  }

  const toggleField = (key) => {
    setPendingFields(prev => {
      const fields = { ...prev.fields }
      const cur = fields[key].accepted
      if (cur === null) fields[key] = { ...fields[key], accepted: true }
      else if (cur === true) fields[key] = { ...fields[key], accepted: false }
      else fields[key] = { ...fields[key], accepted: fields[key].current === null ? true : null }
      return { ...prev, fields }
    })
  }

  const acceptAll = () => {
    setPendingFields(prev => {
      const fields = {}
      for (const [k, v] of Object.entries(prev.fields)) { fields[k] = { ...v, accepted: true } }
      return { ...prev, fields }
    })
  }

  const rejectAll = () => {
    setPendingFields(prev => {
      const fields = {}
      for (const [k, v] of Object.entries(prev.fields)) { fields[k] = { ...v, accepted: false } }
      return { ...prev, fields }
    })
  }

  const deleteDoc = async (id, fileUrl) => {
    await supabase.from('deal_documents').delete().eq('id', id)
    try {
      const path = fileUrl.split('/deal-oms/')[1]
      if (path) await supabase.storage.from('deal-oms').remove([decodeURIComponent(path)])
    } catch (e) {}
    fetchDocs()
  }

  const updateType = async (id, docType) => {
    await supabase.from('deal_documents').update({ doc_type: docType }).eq('id', id)
    fetchDocs()
  }

  const formatSize = (bytes) => {
    if (!bytes) return '—'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  const unreadPdfs = docs.filter(d => d.filename.toLowerCase().endsWith('.pdf') && !d.ai_summary).length
  const pendingAccepted = pendingFields ? Object.values(pendingFields.fields).filter(f => f.accepted === true).length : 0
  const pendingTotal = pendingFields ? Object.keys(pendingFields.fields).length : 0
  const pendingUndecided = pendingFields ? Object.values(pendingFields.fields).filter(f => f.accepted === null).length : 0

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'stretch' }}>
        <div style={{ flex: 1, border: `2px dashed ${B.gray40}`, borderRadius: 4, padding: 16, textAlign: 'center', cursor: 'pointer', background: B.gray10 }}
          onClick={() => document.getElementById('deal-doc-upload').click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.blue }}
          onDragLeave={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.gray40 }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.gray40; const files = e.dataTransfer.files; for (let i = 0; i < files.length; i++) uploadFile(files[i]) }}>
          <input id="deal-doc-upload" type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png" style={{ display: 'none' }}
            onChange={e => { for (let i = 0; i < e.target.files.length; i++) uploadFile(e.target.files[i]); e.target.value = '' }} />
          {uploading ? (
            <div style={{ fontSize: 13, color: B.blue, fontFamily: bf }}>Uploading...</div>
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: B.blue, fontFamily: hf }}>Drop files or click to upload</div>
              <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>Files are stored. Click "AI Read" to extract data from PDFs.</div>
            </div>
          )}
        </div>
        {docs.length > 0 && (
          <button onClick={aiReadAll} disabled={readingAll || unreadPdfs === 0} style={{
            padding: '12px 16px', background: readingAll ? B.gray : '#1C4587', color: B.white, border: 'none',
            borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: readingAll || unreadPdfs === 0 ? 'default' : 'pointer',
            fontFamily: hf, minWidth: 100, opacity: unreadPdfs === 0 ? 0.4 : 1,
          }}>
            {readingAll ? 'Reading...' : 'AI Read All'}
            {unreadPdfs > 0 && !readingAll && <div style={{ fontSize: 9, fontWeight: 400, marginTop: 2, fontFamily: bf }}>{unreadPdfs} unread</div>}
          </button>
        )}
      </div>

      {/* ═══ PER-FIELD APPROVAL BANNER ═══ */}
      {pendingFields && (
        <div style={{ background: '#FFFBEB', border: '1px solid #F59E0B', borderRadius: 6, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', fontFamily: hf }}>
                AI extracted {pendingTotal} fields from {pendingFields.docName}
              </div>
              <div style={{ fontSize: 11, color: '#B45309', fontFamily: bf }}>
                Click each field to accept or reject · {pendingAccepted} accepted
                {pendingUndecided > 0 && <span style={{ color: '#DC2626' }}> · {pendingUndecided} need review</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={acceptAll} style={{ padding: '4px 10px', background: '#059669', color: 'white', border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: hf }}>✓ All</button>
              <button onClick={rejectAll} style={{ padding: '4px 10px', background: '#DC2626', color: 'white', border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: hf }}>✗ All</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {Object.entries(pendingFields.fields).map(([key, field]) => {
              const isAccepted = field.accepted === true
              const isRejected = field.accepted === false
              const hasOverwrite = field.current !== null && field.changed
              return (
                <div key={key} onClick={() => toggleField(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: isAccepted ? '#ECFDF5' : isRejected ? '#FEF2F2' : '#FFF',
                    border: `1px solid ${isAccepted ? '#10B981' : isRejected ? '#EF4444' : '#E5E7EB'}`,
                    borderRadius: 4, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 12, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                    background: isAccepted ? '#10B981' : isRejected ? '#EF4444' : '#D1D5DB', color: 'white',
                  }}>
                    {isAccepted ? '✓' : isRejected ? '✗' : '?'}
                  </div>
                  <div style={{ width: 110, fontSize: 11, fontWeight: 600, color: '#374151', fontFamily: hf, flexShrink: 0 }}>
                    {FIELD_LABELS[key] || key.replace(/_/g, ' ')}
                  </div>
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#111827', fontFamily: bf }}>
                    {formatVal(key, field.value)}
                  </div>
                  {hasOverwrite && (
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: bf, textDecoration: 'line-through' }}>
                      was: {formatVal(key, field.current)}
                    </div>
                  )}
                  {!hasOverwrite && field.current === null && (
                    <div style={{ fontSize: 10, color: '#059669', fontFamily: bf, fontWeight: 600 }}>NEW</div>
                  )}
                </div>
              )
            })}
          </div>
          {pendingFields.notes && (
            <div style={{ fontSize: 11, color: '#78350F', fontFamily: bf, marginBottom: 8, padding: '6px 8px', background: '#FEF3C7', borderRadius: 3 }}>
              <span style={{ fontWeight: 600 }}>AI notes:</span> {pendingFields.notes}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={applyApproved} disabled={pendingAccepted === 0}
              style={{
                padding: '7px 18px', background: pendingAccepted > 0 ? '#1C4587' : '#9CA3AF', color: 'white',
                border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700,
                cursor: pendingAccepted > 0 ? 'pointer' : 'default', fontFamily: hf,
                opacity: pendingAccepted > 0 ? 1 : 0.5,
              }}>
              Apply {pendingAccepted} field{pendingAccepted !== 1 ? 's' : ''}
            </button>
            <button onClick={() => setPendingFields(null)}
              style={{ padding: '7px 14px', background: 'transparent', color: '#92400E', border: '1px solid #F59E0B', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: bf }}>
              Skip all
            </button>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: B.gray40, fontSize: 12, fontFamily: bf }}>No documents uploaded yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {docs.map(doc => {
            const color = DT_COLORS[doc.doc_type] || B.gray
            const isExp = expanded === doc.id
            const isPdf = doc.filename.toLowerCase().endsWith('.pdf')
            const isBeingRead = reading === doc.id
            return (
              <div key={doc.id} style={{ background: B.white, borderRadius: 4, border: `1px solid ${B.gray20}`, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}
                  onClick={() => setExpanded(isExp ? null : doc.id)}
                  onMouseEnter={e => e.currentTarget.style.background = B.blue05}
                  onMouseLeave={e => e.currentTarget.style.background = B.white}>
                  <div style={{ width: 32, height: 32, borderRadius: 4, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color, fontFamily: hf, flexShrink: 0 }}>
                    {doc.filename.split('.').pop().toUpperCase().slice(0, 3)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: B.black, fontFamily: hf, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</div>
                    <div style={{ fontSize: 10, color: B.gray, fontFamily: bf }}>
                      {formatSize(doc.file_size)} &middot; {new Date(doc.uploaded_at).toLocaleDateString()}
                      {doc.ai_summary && <span style={{ color: '#10B981', fontWeight: 600 }}> &middot; AI read ✓</span>}
                    </div>
                  </div>
                  <select value={doc.doc_type} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); updateType(doc.id, e.target.value) }} style={{
                    padding: '2px 4px', borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${color}30`, background: color + '18', color, fontFamily: hf,
                  }}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {isPdf && (
                    <button onClick={e => { e.stopPropagation(); aiReadDoc(doc) }} disabled={isBeingRead}
                      style={{ fontSize: 10, color: doc.ai_summary ? '#10B981' : B.blue, fontFamily: hf, textDecoration: 'none', padding: '3px 8px', border: `1px solid ${doc.ai_summary ? '#10B98130' : B.blue + '30'}`, borderRadius: 3, background: isBeingRead ? B.gray10 : 'transparent', cursor: isBeingRead ? 'default' : 'pointer' }}>
                      {isBeingRead ? '...' : doc.ai_summary ? 'Re-read' : 'AI Read'}
                    </button>
                  )}
                  <a href={doc.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: B.blue, fontFamily: hf, textDecoration: 'none', padding: '3px 8px', border: `1px solid ${B.blue}20`, borderRadius: 3 }}>View</a>
                  <button onClick={e => { e.stopPropagation(); deleteDoc(doc.id, doc.file_url) }} style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 12, padding: '0 4px' }}>x</button>
                </div>
                {isExp && doc.ai_summary && (
                  <div style={{ padding: '0 12px 12px 52px', borderTop: `1px solid ${B.gray10}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, marginTop: 8, marginBottom: 4 }}>AI Summary</div>
                    <div style={{ fontSize: 12, color: B.black, fontFamily: bf, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{doc.ai_summary}</div>
                    {doc.ai_extracted && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, marginBottom: 4 }}>Key data</div>
                        {Object.entries(doc.ai_extracted).filter(([k, v]) => v).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: `1px solid ${B.gray10}`, fontSize: 11, fontFamily: bf }}>
                            <span style={{ color: B.gray }}>{k.replace(/_/g, ' ')}</span>
                            <span style={{ color: B.black, fontWeight: 500 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {isExp && !doc.ai_summary && isPdf && (
                  <div style={{ padding: '8px 12px 12px 52px', borderTop: `1px solid ${B.gray10}`, fontSize: 11, color: B.gray40, fontFamily: bf }}>
                    Click "AI Read" to extract information from this document.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
