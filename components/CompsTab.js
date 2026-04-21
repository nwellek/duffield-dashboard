// ─── COMPS TAB ───
// Embeds the full Duffield Comps Database (Leaflet map + sidebar + filters)
// The comps-database.html file lives in /public/ and is served as a static asset.

export default function CompsTab() {
  return (
    <div style={{
      margin: '-16px -20px',
      width: 'calc(100% + 40px)',
      height: 'calc(100vh)',
      position: 'relative',
    }}>
      <iframe
        src="/comps-database.html"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="Duffield Comps Database"
        allow="clipboard-read; clipboard-write"
        referrerPolicy="no-referrer"
      />
    </div>
  )
}
