import { signIn } from 'next-auth/react'

export default function SignIn() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F4F6F9', fontFamily: "'Fira Sans', -apple-system, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:wght@400;600;700&family=Fira+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{
        background: '#FFFFFF', borderRadius: 6, padding: '40px 36px', textAlign: 'center',
        border: '1px solid #E4E4E4', maxWidth: 380, width: '100%',
      }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1C4587', fontFamily: "'Fira Sans Condensed', sans-serif", marginBottom: 4 }}>
          Duffield Holdings
        </div>
        <div style={{ fontSize: 13, color: '#7A7A7A', marginBottom: 28 }}>Deal Pipeline & Scoring</div>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          style={{
            padding: '12px 24px', background: '#1C4587', color: '#FFFFFF', border: 'none',
            borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%',
            fontFamily: "'Fira Sans', sans-serif",
          }}
        >
          Sign in with Google
        </button>
        <div style={{ fontSize: 11, color: '#AFAFAF', marginTop: 16 }}>Authorized users only</div>
      </div>
    </div>
  )
}
