// ─── COMPS TAB ───
// Embeds the full Duffield Comps Database (Leaflet map + sidebar + filters)
// The comps-database.html file lives in /public/ and is served as a static asset.
// Data is stored in Supabase table 'duffield_comps' (same project as dashboard).

export default function CompsTab() {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 56px)', position: 'relative' }}>
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
      />
    </div>
  )
}
