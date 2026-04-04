import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, Badge } from '../lib/brand'

const DOC_TYPES = ['LOI', 'PSA', 'Lease', 'Loan', 'Insurance', 'Inspection', 'Appraisal', 'Survey', 'Title', 'Environmental', 'Tax', 'OM', 'Invoice', 'Legal', 'Other']
const DT_COLORS = { LOI: '#F59E0B', PSA: '#1C4587', Lease: '#10B981', Loan: '#8B5CF6', Insurance: '#6366F1', Inspection: '#14B8A6', OM: '#059669', Invoice: '#EF4444', Legal: '#6B7280', Other: '#9CA3AF' }

// Clean a numeric value — strip $, commas, spaces
function cleanNum(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  const cleaned = String(v).replace(/[$,\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export default function DealDocuments({ dealId, onDealUpdated }) {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [reading, setReading] = useState(null) // doc id currently being read
  const [readingAll, setReadingAll] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [pendingUpdate, setPendingUpdate] = useState(null)

  const fetchDocs = useCallback(async () => {
    if (!dealId) return
    const { data } = await supabase.from('deal_documents').select('*').eq('deal_id', dealId).order('uploaded_at', { ascending: false })
    if (data) setDocs(data)
  }, [dealId])
  useEffect(() => { fetchDocs() }, [fetchDocs])

  // ── UPLOAD (store only, no AI read) ──
  const uploadFile = async (file) => {
    if (!file || !dealId) return
    setUploading(true)
    try {
      const filePath = `${dealId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('deal-oms').upload(filePath, file, { upsert: true })
      if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(false); return }

      const { data: urlData } = supabase.storage.from('deal-oms').getPublicUrl(filePath)
      const fileUrl = urlData?.publicUrl || filePath

      // Guess doc type from filename
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

      await supabase.from('deal_documents').insert({
        deal_id: dealId, filename: file.name, file_url: fileUrl,
        file_size: file.size, doc_type: docType,
      })
      fetchDocs()
    } catch (e) { alert('Error: ' + e.message) }
    setUploading(false)
  }

  // ── AI READ (per document) ──
  const aiReadDoc = async (doc) => {
    if (!doc.file_url || reading) return
    const ext = doc.filename.split('.').pop().toLowerCase()
    if (ext !== 'pdf') { alert('AI read only works on PDFs'); return }

    setReading(doc.id)
    try {
      // Fetch the PDF from storage
      const resp = await fetch(doc.file_url)
      if (!resp.ok) { alert('Could not fetch file'); setReading(null); return }
      const blob = await resp.blob()
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const res = await fetch('/api/doc-read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_base64: base64, filename: doc.filename, doc_id: doc.id }),
      })

      if (res.ok) {
        const result = await res.json()
        await supabase.from('deal_documents').update({
          ai_summary: result.summary, ai_extracted: result.extracted, doc_type: result.doc_type || doc.doc_type,
        }).eq('id', doc.id)

        // Build deal field updates with clean numbers
        if (result.deal_fields) {
          const f = result.deal_fields
          const updates = {}
          if (cleanNum(f.asking_price)) updates.asking_price = cleanNum(f.asking_price)
          if (cleanNum(f.building_sf)) updates.building_sf = cleanNum(f.building_sf)
          if (cleanNum(f.lot_acres)) updates.lot_acres = cleanNum(f.lot_acres)
          if (cleanNum(f.clear_height)) updates.clear_height = cleanNum(f.clear_height)
          if (cleanNum(f.dock_doors)) updates.dock_doors = cleanNum(f.dock_doors)
          if (cleanNum(f.cap_rate)) updates.cap_rate = cleanNum(f.cap_rate)
          if (f.zoning && typeof f.zoning === 'string') updates.zoning = f.zoning
          if (f.property_type && typeof f.property_type === 'string') updates.property_type = f.property_type
          if (f.owner && typeof f.owner === 'string') updates.owner = f.owner
          if (f.contact_name && typeof f.contact_name === 'string') updates.contact_name = f.contact_name
          if (f.contact_method && typeof f.contact_method === 'string') updates.contact_method = f.contact_method
          if (f.address && typeof f.address === 'string') updates.address = f.address
          if (f.city && typeof f.city === 'string') updates.city = f.city
          if (f.state && typeof f.state === 'string' && f.state.length <= 2) updates.state = f.state
          if (Object.keys(updates).length > 0) {
            setPendingUpdate({ fields: updates, notes: f.notes_append, docName: doc.filename })
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

  // ── READ ALL DOCUMENTS ──
  const aiReadAll = async () => {
    const pdfs = docs.filter(d => d.filename.toLowerCase().endsWith('.pdf') && !d.ai_summary)
    if (pdfs.length === 0) { alert('No unread PDFs to process'); return }
    setReadingAll(true)
    for (const doc of pdfs) {
      await aiReadDoc(doc)
    }
    setReadingAll(false)
  }

  const applyUpdate = async () => {
    if (!pendingUpdate) return
    await supabase.from('deals').update(pendingUpdate.fields).eq('id', dealId)
    if (pendingUpdate.notes) {
      const { data: current } = await supabase.from('deals').select('notes').eq('id', dealId).single()
      const newNotes = (current?.notes || '') + '\n[AI: ' + pendingUpdate.docName + '] ' + pendingUpdate.notes
      await supabase.from('deals').update({ notes: newNotes.trim() }).eq('id', dealId)
    }
    setPendingUpdate(null)
    if (onDealUpdated) onDealUpdated()
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

  return (
    <div>
      {/* Upload zone + Read All button */}
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
            {readingAll ? 'Reading...' : `AI Read All`}
            {unreadPdfs > 0 && !readingAll && <div style={{ fontSize: 9, fontWeight: 400, marginTop: 2, fontFamily: bf }}>{unreadPdfs} unread</div>}
          </button>
        )}
      </div>

      {/* Pending AI update banner */}
      {pendingUpdate && (
        <div style={{ background: '#FFFBEB', border: '1px solid #F59E0B', borderRadius: 4, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', fontFamily: hf, marginBottom: 6 }}>AI extracted data from {pendingUpdate.docName}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {Object.entries(pendingUpdate.fields).map(([k, v]) => (
              <span key={k} style={{ fontSize: 10, padding: '2px 6px', background: '#FEF3C7', borderRadius: 2, fontFamily: bf, color: '#78350F' }}>
                {k.replace(/_/g, ' ')}: {typeof v === 'number' ? v.toLocaleString() : v}
              </span>
            ))}
          </div>
          {pendingUpdate.notes && <div style={{ fontSize: 11, color: '#78350F', fontFamily: bf, marginBottom: 6 }}>{pendingUpdate.notes}</div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={applyUpdate} style={{ padding: '5px 14px', background: '#1C4587', color: 'white', border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: hf }}>Apply to deal</button>
            <button onClick={() => setPendingUpdate(null)} style={{ padding: '5px 14px', background: 'transparent', color: '#92400E', border: '1px solid #F59E0B', borderRadius: 3, fontSize: 11, cursor: 'pointer', fontFamily: bf }}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Document list */}
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
                  {/* AI Read button */}
                  {isPdf && (
                    <button onClick={e => { e.stopPropagation(); aiReadDoc(doc) }} disabled={isBeingRead}
                      style={{ fontSize: 10, color: doc.ai_summary ? '#10B981' : B.blue, fontFamily: hf, textDecoration: 'none', padding: '3px 8px', border: `1px solid ${doc.ai_summary ? '#10B98130' : B.blue + '30'}`, borderRadius: 3, background: isBeingRead ? B.gray10 : 'transparent', cursor: isBeingRead ? 'default' : 'pointer' }}>
                      {isBeingRead ? '...' : doc.ai_summary ? 'Re-read' : 'AI Read'}
                    </button>
                  )}
                  <a href={doc.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: B.blue, fontFamily: hf, textDecoration: 'none', padding: '3px 8px', border: `1px solid ${B.blue}20`, borderRadius: 3 }}>View</a>
                  <button onClick={e => { e.stopPropagation(); deleteDoc(doc.id, doc.file_url) }} style={{ background: 'none', border: 'none', color: B.gray40, cursor: 'pointer', fontSize: 12, padding: '0 4px' }}>x</button>
                </div>
                {/* AI Summary expanded */}
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
