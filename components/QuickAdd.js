import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf, scoreDeal, gradeColor, fmt, Badge, MAX_SCORE } from '../lib/brand'

export default function QuickAdd({ onClose, onDealCreated }) {
  const [mode, setMode] = useState('url') // url or pdf
  const [url, setUrl] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleSubmitUrl = async () => {
    if (!url.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      let data; try { data = await res.json() } catch(e) { setError('Server error: ' + await res.text().catch(() => res.status)); setLoading(false); return }
      if (res.ok) { setResult(data); if (onDealCreated) onDealCreated() }
      else setError(data.error + (data.raw ? ' | Raw: ' + data.raw.slice(0,200) : '') + (data.debug ? ' | Debug: ' + data.debug : ''))
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const handleSubmitPdf = async () => {
    if (!pdfFile) return
    setLoading(true); setError(''); setResult(null)
    try {
      // Step 1: Upload PDF to Supabase Storage (temp folder) to avoid Vercel body size limits
      const tempPath = `temp-ingest/${Date.now()}_${pdfFile.name}`
      const { error: uploadErr } = await supabase.storage.from('deal-oms').upload(tempPath, pdfFile, { contentType: 'application/pdf', upsert: true })
      if (uploadErr) { setError('Upload failed: ' + uploadErr.message); setLoading(false); return }

      const { data: urlData } = supabase.storage.from('deal-oms').getPublicUrl(tempPath)
      const storageUrl = urlData?.publicUrl

      // Step 2: Send storage URL to API (small JSON body, no base64)
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_storage_url: storageUrl, pdf_storage_path: tempPath, pdf_name: pdfFile.name }),
      })
      const responseText = await res.text()
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`
        try { const errJson = JSON.parse(responseText); errMsg = errJson.error || errMsg } catch(e) { errMsg += ': ' + responseText.slice(0, 200) }
        setError(errMsg); setLoading(false); return
      }
      let data
      try { data = JSON.parse(responseText) } catch(e) { setError('Invalid response: ' + responseText.slice(0, 200)); setLoading(false); return }
      if (data) { setResult(data); if (onDealCreated) onDealCreated() }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const deal = result?.deal
  const score = deal ? scoreDeal(deal) : null
  const g = score ? gradeColor(score.grade) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: B.white, borderRadius: 6, padding: 24, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: B.blue, fontFamily: hf }}>Quick add deal</div>
            <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>Paste a listing URL or upload a broker OM — AI extracts and scores it</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: B.gray, cursor: 'pointer' }}>x</button>
        </div>

        {!result && (
          <>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
              <button onClick={() => setMode('url')} style={{ flex: 1, padding: '8px 0', borderRadius: 3, fontSize: 12, fontWeight: mode === 'url' ? 700 : 400, border: `1px solid ${mode === 'url' ? B.blue : B.gray20}`, background: mode === 'url' ? B.blue : 'transparent', color: mode === 'url' ? B.white : B.gray, cursor: 'pointer', fontFamily: hf }}>Paste URL</button>
              <button onClick={() => setMode('pdf')} style={{ flex: 1, padding: '8px 0', borderRadius: 3, fontSize: 12, fontWeight: mode === 'pdf' ? 700 : 400, border: `1px solid ${mode === 'pdf' ? B.blue : B.gray20}`, background: mode === 'pdf' ? B.blue : 'transparent', color: mode === 'pdf' ? B.white : B.gray, cursor: 'pointer', fontFamily: hf }}>Upload OM PDF</button>
            </div>

            {mode === 'url' && (
              <div>
                <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 6 }}>Paste a Crexi, LoopNet, or any commercial listing URL</div>
                <input style={{ width: '100%', padding: '10px 12px', border: `1px solid ${B.gray40}`, borderRadius: 3, fontSize: 13, fontFamily: bf, outline: 'none', boxSizing: 'border-box' }}
                  placeholder="https://www.crexi.com/properties/..."
                  value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmitUrl() }}
                />
                <button onClick={handleSubmitUrl} disabled={loading || !url.trim()} style={{ marginTop: 10, width: '100%', padding: '10px 0', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: hf, opacity: loading || !url.trim() ? 0.5 : 1 }}>
                  {loading ? 'Extracting deal data...' : 'Extract & score'}
                </button>
              </div>
            )}

            {mode === 'pdf' && (
              <div>
                <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 6 }}>Upload a broker OM, flyer, or listing sheet (PDF)</div>
                <div style={{ border: `2px dashed ${B.gray40}`, borderRadius: 4, padding: 30, textAlign: 'center', cursor: 'pointer', background: pdfFile ? B.blue05 : B.gray10 }}
                  onClick={() => document.getElementById('pdf-upload').click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.blue; e.currentTarget.style.background = B.blue05 }}
                  onDragLeave={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.gray40; e.currentTarget.style.background = B.gray10 }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = B.gray40; if (e.dataTransfer.files[0]) setPdfFile(e.dataTransfer.files[0]) }}>
                  <input id="pdf-upload" type="file" accept=".pdf" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) setPdfFile(e.target.files[0]) }} />
                  {pdfFile ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: B.blue, fontFamily: hf }}>{pdfFile.name}</div>
                      <div style={{ fontSize: 11, color: B.gray, fontFamily: bf }}>{(pdfFile.size / 1024 / 1024).toFixed(1)} MB — click to change</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 13, color: B.gray, fontFamily: bf }}>Click to select PDF</div>
                      <div style={{ fontSize: 11, color: B.gray60, fontFamily: bf }}>or drag and drop</div>
                    </div>
                  )}
                </div>
                <button onClick={handleSubmitPdf} disabled={loading || !pdfFile} style={{ marginTop: 10, width: '100%', padding: '10px 0', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: hf, opacity: loading || !pdfFile ? 0.5 : 1 }}>
                  {loading ? 'Reading OM and extracting...' : 'Extract & score'}
                </button>
              </div>
            )}

            {loading && (
              <div style={{ marginTop: 12, padding: 12, background: B.blue05, borderRadius: 3, border: `1px solid ${B.blue20}`, fontSize: 12, color: B.blue, fontFamily: bf, textAlign: 'center' }}>
                AI is reading the listing and extracting property details...
              </div>
            )}
          </>
        )}

        {error && <div style={{ marginTop: 10, padding: 10, background: B.redLight, borderRadius: 3, color: B.redDark, fontSize: 12, fontFamily: bf }}>{error}</div>}

        {/* Results */}
        {result && deal && (
          <div>
            <div style={{ background: g.bg, borderRadius: 4, padding: 14, border: `1px solid ${g.bd}`, marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: g.tx, fontFamily: hf }}>{score.grade}</div>
              <div style={{ fontSize: 14, color: g.tx, fontFamily: bf }}>{score.total} / {MAX_SCORE} points</div>
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, color: B.black, fontFamily: hf, marginBottom: 2 }}>{deal.address}</div>
            <div style={{ fontSize: 12, color: B.gray, fontFamily: bf, marginBottom: 10 }}>{deal.city}{deal.state ? ', ' + deal.state : ''} &mdash; {deal.market}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { l: 'Price', v: deal.asking_price ? fmt(deal.asking_price) : '—' },
                { l: 'Price/SF', v: deal.price_per_sf ? '$' + deal.price_per_sf : '—' },
                { l: 'Building SF', v: deal.building_sf ? Number(deal.building_sf).toLocaleString() : '—' },
                { l: 'Lot acres', v: deal.lot_acres || '—' },
                { l: 'Cap rate', v: deal.cap_rate ? deal.cap_rate + '%' : '—' },
                { l: 'Year built', v: deal.year_built || '—' },
                { l: 'Clear height', v: deal.clear_height ? deal.clear_height + ' ft' : '—' },
                { l: 'Dock doors', v: deal.dock_doors || '—' },
              ].map((item, i) => (
                <div key={i} style={{ fontSize: 12, fontFamily: bf }}>
                  <span style={{ color: B.gray }}>{item.l}:</span> <span style={{ fontWeight: 600, color: B.black }}>{item.v}</span>
                </div>
              ))}
            </div>

            {deal.owner && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 4 }}><span style={{ color: B.gray }}>Owner:</span> {deal.owner}</div>}
            {deal.notes && <div style={{ fontSize: 12, fontFamily: bf, color: B.gray, padding: '6px 8px', background: B.gray10, borderRadius: 3, marginBottom: 10, lineHeight: 1.4 }}>{deal.notes}</div>}

            {deal.latitude && deal.latitude !== 0 && <div style={{ fontSize: 10, color: B.gray60, fontFamily: bf, marginBottom: 10 }}>Geocoded to exact location</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '9px 0', background: B.blue, color: B.white, border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: hf }}>Done — view in pipeline</button>
              <button onClick={() => { setResult(null); setUrl(''); setPdfFile(null); setError('') }} style={{ padding: '9px 14px', background: 'transparent', color: B.blue, border: `1px solid ${B.blue20}`, borderRadius: 3, fontSize: 13, cursor: 'pointer', fontFamily: bf }}>Add another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
