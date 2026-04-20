import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { B, hf, bf } from '../lib/brand'

// ─── Searchable contact dropdown that pulls from CRM ───
function ContactSearch({ label, value, onSelect, onClear, placeholder, category, is, ls }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [allContacts, setAllContacts] = useState([])
  const ref = useRef(null)

  // Load contacts from CRM once
  useEffect(() => {
    const load = async () => {
      let q = supabase.from('contacts').select('*').order('name')
      if (category) q = q.ilike('category', `%${category}%`)
      const { data } = await q.limit(500)
      if (data) setAllContacts(data)
    }
    load()
  }, [category])

  // Filter on query
  useEffect(() => {
    if (!query.trim()) { setResults(allContacts.slice(0, 8)); return }
    const q = query.toLowerCase()
    const filtered = allContacts.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    )
    setResults(filtered.slice(0, 8))
  }, [query, allContacts])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flex: '1 1 100%' }}>
      <label style={ls}>{label}</label>
      {value ? (
        <div style={{
          ...is, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#F0F9FF', border: '1px solid #1C458730', cursor: 'pointer',
        }} onClick={() => { onClear(); setQuery(''); setOpen(true) }}>
          <span style={{ fontWeight: 600, color: '#1C4587' }}>{value}</span>
          <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 8 }}>✕ clear</span>
        </div>
      ) : (
        <input
          style={is}
          placeholder={placeholder || 'Search CRM or type new...'}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
      )}
      {open && !value && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'white', border: `1px solid ${B.gray20}`, borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto', marginTop: 2,
        }}>
          {results.length > 0 ? results.map(c => (
            <div key={c.id}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${B.gray10}`, transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
              onClick={() => { onSelect(c); setQuery(''); setOpen(false) }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: B.black, fontFamily: hf }}>{c.name}</div>
              <div style={{ fontSize: 10, color: B.gray, fontFamily: bf }}>
                {[c.company, c.phone, c.email].filter(Boolean).join(' · ') || 'No details'}
                {c.category && <span style={{ marginLeft: 6, padding: '1px 5px', background: '#E5E7EB', borderRadius: 2, fontSize: 9, fontWeight: 600 }}>{c.category}</span>}
              </div>
            </div>
          )) : (
            query.trim() ? (
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: B.gray, fontFamily: bf, marginBottom: 6 }}>No matches in CRM</div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: '#1C4587', cursor: 'pointer', fontFamily: hf, padding: '4px 0' }}
                  onClick={() => { onSelect({ name: query.trim(), _isNew: true }); setQuery(''); setOpen(false) }}>
                  + Add "{query.trim()}" as new contact
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px 12px', fontSize: 11, color: B.gray, fontFamily: bf }}>Start typing to search...</div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main tab component ───
export default function OwnerContactTab({ d, set, is, ls, field }) {
  const [ownerLinked, setOwnerLinked] = useState(null) // CRM contact linked as owner
  const [brokerLinked, setBrokerLinked] = useState(null)
  const [saving, setSaving] = useState(null) // 'owner' | 'broker' | null

  // On mount, try to find linked CRM contact by name match
  useEffect(() => {
    const findLinked = async (name, setter) => {
      if (!name) return
      const { data } = await supabase.from('contacts').select('*').ilike('name', name).limit(1)
      if (data && data.length > 0) setter(data[0])
    }
    findLinked(d.owner, setOwnerLinked)
    findLinked(d.contact_name, setBrokerLinked)
  }, []) // only on mount

  // When a CRM contact is selected as owner
  const selectOwner = (contact) => {
    if (contact._isNew) {
      // New contact — just set the name, user fills rest
      set('owner', contact.name)
      setOwnerLinked(null)
    } else {
      set('owner', contact.name)
      if (contact.phone) set('owner_phone', contact.phone)
      if (contact.email) set('owner_email', contact.email)
      if (contact.city) set('owner_address', contact.city)
      setOwnerLinked(contact)
    }
  }

  const clearOwner = () => {
    set('owner', '')
    set('owner_phone', '')
    set('owner_email', '')
    set('owner_address', '')
    setOwnerLinked(null)
  }

  // When a CRM contact is selected as broker
  const selectBroker = (contact) => {
    if (contact._isNew) {
      set('contact_name', contact.name)
      setBrokerLinked(null)
    } else {
      set('contact_name', contact.name)
      const method = [contact.email, contact.phone].filter(Boolean).join(', ')
      if (method) set('contact_method', method)
      setBrokerLinked(contact)
    }
  }

  const clearBroker = () => {
    set('contact_name', '')
    set('contact_method', '')
    setBrokerLinked(null)
  }

  // Save current owner info back to CRM
  const saveOwnerToCRM = async () => {
    if (!d.owner) return
    setSaving('owner')
    const contact = {
      name: d.owner,
      phone: d.owner_phone || null,
      email: d.owner_email || null,
      city: d.owner_address || null,
      category: 'Owner',
    }
    if (ownerLinked?.id) {
      // Update existing
      await supabase.from('contacts').update(contact).eq('id', ownerLinked.id)
      setOwnerLinked({ ...ownerLinked, ...contact })
    } else {
      // Check if exists by name
      const { data: existing } = await supabase.from('contacts').select('*').ilike('name', d.owner).limit(1)
      if (existing && existing.length > 0) {
        await supabase.from('contacts').update(contact).eq('id', existing[0].id)
        setOwnerLinked({ ...existing[0], ...contact })
      } else {
        const { data: inserted } = await supabase.from('contacts').insert(contact).select()
        if (inserted && inserted[0]) setOwnerLinked(inserted[0])
      }
    }
    setSaving(null)
  }

  const saveBrokerToCRM = async () => {
    if (!d.contact_name) return
    setSaving('broker')
    // Parse contact_method for email/phone
    const method = d.contact_method || ''
    let email = null, phone = null
    const emailMatch = method.match(/[\w.-]+@[\w.-]+\.\w+/)
    if (emailMatch) email = emailMatch[0]
    const phoneMatch = method.replace(emailMatch ? emailMatch[0] : '', '').match(/[\d().\-\s]{7,}/)
    if (phoneMatch) phone = phoneMatch[0].trim()

    const contact = {
      name: d.contact_name,
      phone: phone,
      email: email,
      category: 'Broker',
    }
    if (brokerLinked?.id) {
      await supabase.from('contacts').update(contact).eq('id', brokerLinked.id)
      setBrokerLinked({ ...brokerLinked, ...contact })
    } else {
      const { data: existing } = await supabase.from('contacts').select('*').ilike('name', d.contact_name).limit(1)
      if (existing && existing.length > 0) {
        await supabase.from('contacts').update(contact).eq('id', existing[0].id)
        setBrokerLinked({ ...existing[0], ...contact })
      } else {
        const { data: inserted } = await supabase.from('contacts').insert(contact).select()
        if (inserted && inserted[0]) setBrokerLinked(inserted[0])
      }
    }
    setSaving(null)
  }

  const linkBadge = (linked, type) => {
    if (!linked) return null
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#ECFDF5', border: '1px solid #10B98130', borderRadius: 10, fontSize: 10, fontWeight: 600, color: '#059669', fontFamily: hf, marginLeft: 6 }}>
        CRM linked
      </div>
    )
  }

  return (
    <div>
      {/* ═══ PROPERTY OWNER ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4 }}>Property owner</div>
        {linkBadge(ownerLinked)}
      </div>

      <ContactSearch
        label="Owner name"
        value={d.owner}
        onSelect={selectOwner}
        onClear={clearOwner}
        placeholder="Search CRM or type new owner..."
        category="Owner"
        is={is} ls={ls}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8 }}>
        {field('Phone', 'owner_phone', 'text', '(520) 980-5509', true)}
        {field('Email', 'owner_email', 'text', 'owner@company.com', true)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {field('Owner address', 'owner_address', 'text', '123 Main St, City, ST 12345')}
      </div>

      {/* Save to CRM button */}
      {d.owner && !ownerLinked && (
        <button onClick={saveOwnerToCRM} disabled={saving === 'owner'}
          style={{
            padding: '5px 14px', background: '#059669', color: 'white', border: 'none', borderRadius: 3,
            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: hf, marginBottom: 12,
          }}>
          {saving === 'owner' ? 'Saving...' : '+ Save to CRM'}
        </button>
      )}
      {d.owner && ownerLinked && (
        <button onClick={saveOwnerToCRM} disabled={saving === 'owner'}
          style={{
            padding: '5px 14px', background: 'transparent', color: '#059669', border: '1px solid #10B98140', borderRadius: 3,
            fontSize: 11, cursor: 'pointer', fontFamily: bf, marginBottom: 12,
          }}>
          {saving === 'owner' ? 'Updating...' : 'Update CRM'}
        </button>
      )}

      {/* ═══ BROKER / CONTACT ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '16px 0 8px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4 }}>Broker / contact</div>
        {linkBadge(brokerLinked)}
      </div>

      <ContactSearch
        label="Contact name"
        value={d.contact_name}
        onSelect={selectBroker}
        onClear={clearBroker}
        placeholder="Search CRM or type new broker..."
        category="Broker"
        is={is} ls={ls}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8 }}>
        {field('Contact method', 'contact_method', 'text', 'shasta@mmparrish.com, (520) 980-5509')}
      </div>

      {d.contact_name && !brokerLinked && (
        <button onClick={saveBrokerToCRM} disabled={saving === 'broker'}
          style={{
            padding: '5px 14px', background: '#059669', color: 'white', border: 'none', borderRadius: 3,
            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: hf, marginBottom: 12,
          }}>
          {saving === 'broker' ? 'Saving...' : '+ Save to CRM'}
        </button>
      )}
      {d.contact_name && brokerLinked && (
        <button onClick={saveBrokerToCRM} disabled={saving === 'broker'}
          style={{
            padding: '5px 14px', background: 'transparent', color: '#059669', border: '1px solid #10B98140', borderRadius: 3,
            fontSize: 11, cursor: 'pointer', fontFamily: bf, marginBottom: 12,
          }}>
          {saving === 'broker' ? 'Updating...' : 'Update CRM'}
        </button>
      )}

      {/* ═══ SALE HISTORY ═══ */}
      <div style={{ fontSize: 12, fontWeight: 700, color: B.blue, margin: '16px 0 8px', fontFamily: hf, textTransform: 'uppercase', letterSpacing: 0.4 }}>Sale history</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {field('Purchase date', 'purchase_date', 'text', '2015', true)}
        {field('Purchase price ($)', 'purchase_price', 'number', '232300', true)}
      </div>

      {/* ═══ QUICK REFERENCE ═══ */}
      {(d.owner || d.owner_phone || d.owner_email) && (
        <div style={{ background: B.blue05, borderRadius: 4, padding: 12, border: `1px solid ${B.blue20}`, marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, fontFamily: hf, textTransform: 'uppercase', marginBottom: 6 }}>Quick reference</div>
          {d.owner && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 2 }}><span style={{ color: B.gray }}>Owner:</span> <span style={{ color: B.black, fontWeight: 600 }}>{d.owner}</span></div>}
          {d.owner_phone && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 2 }}><span style={{ color: B.gray }}>Phone:</span> <a href={`tel:${d.owner_phone}`} style={{ color: B.blue, textDecoration: 'none' }}>{d.owner_phone}</a></div>}
          {d.owner_email && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 2 }}><span style={{ color: B.gray }}>Email:</span> <a href={`mailto:${d.owner_email}`} style={{ color: B.blue, textDecoration: 'none' }}>{d.owner_email}</a></div>}
          {d.owner_address && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 2 }}><span style={{ color: B.gray }}>Addr:</span> {d.owner_address}</div>}
          {d.contact_name && <div style={{ fontSize: 12, fontFamily: bf, marginBottom: 2 }}><span style={{ color: B.gray }}>Contact:</span> {d.contact_name} {d.contact_method ? `(${d.contact_method})` : ''}</div>}
        </div>
      )}
    </div>
  )
}
