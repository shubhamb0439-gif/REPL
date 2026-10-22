import { Lock, RefreshCw } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Wordmark } from './ui'

// Login for the shared (Supabase) workspace. The local server does the actual Supabase calls; the browser only
// keeps the session tokens and sends them as "Authorization: Bearer …" on every /api request.
type Session = { access_token: string; refresh_token: string; expires_at?: number; user: { email?: string } }
const KEY = 'rypl:session'

export const getSession = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}
const setSession = (s: Session | null) => {
  try {
    s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}
export const signOut = () => {
  setSession(null)
  window.dispatchEvent(new Event('rypl:logout'))
}

const nativeFetch = window.fetch.bind(window)
let refreshing: Promise<boolean> | null = null
async function refreshSession(): Promise<boolean> {
  const s = getSession()
  if (!s?.refresh_token) return false
  refreshing ??= nativeFetch('/api/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json', 'x-rypl': '1' }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
    .then(async (r) => {
      if (!r.ok) return false
      setSession(await r.json())
      return true
    })
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0))
  return refreshing
}

/** Adds the session token to every /api call, refreshes it when it expires, and signs out if it's rejected. */
export function installAuthFetch() {
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
    if (!url.startsWith('/api/') || url.startsWith('/api/auth/')) return nativeFetch(input, init)
    let s = getSession()
    if (s?.expires_at && s.expires_at * 1000 - Date.now() < 60_000 && (await refreshSession())) s = getSession()
    const withAuth = (sess: Session | null) => {
      const h = new Headers(init.headers)
      if (sess) h.set('authorization', `Bearer ${sess.access_token}`)
      return { ...init, headers: h }
    }
    let r = await nativeFetch(input, withAuth(s))
    if (r.status === 401 && s) {
      if (await refreshSession()) r = await nativeFetch(input, withAuth(getSession()))
      if (r.status === 401) signOut()
    }
    return r
  }
}

/** Shows the login screen when the server requires sign-in; renders the app otherwise. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'login' | 'ok'>('checking')
  useEffect(() => {
    const check = async () => {
      const h = await nativeFetch('/api/health').then((r) => r.json()).catch(() => null)
      if (!h?.auth) return setState('ok') // local mode (or server offline → demo mode)
      if (!getSession()) return setState('login')
      const me = await fetch('/api/auth/me').catch(() => null)
      setState(me?.ok ? 'ok' : 'login')
    }
    check()
    const out = () => setState('login')
    window.addEventListener('rypl:logout', out)
    return () => window.removeEventListener('rypl:logout', out)
  }, [])
  if (state === 'checking') return <div className="grid h-full place-items-center text-sm text-zinc-500"><RefreshCw size={16} className="animate-spin" /></div>
  if (state === 'login') return <Login onDone={() => setState('ok')} />
  return <>{children}</>
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const r = await nativeFetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-rypl': '1' }, body: JSON.stringify({ email, password }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Sign-in failed')
      setSession(j)
      onDone()
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }
  return (
    <div className="grid min-h-full place-items-center p-6">
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-4 p-7">
        <Wordmark />
        <div>
          <h1 className="font-display text-xl font-bold text-white">Sign in</h1>
          <p className="mt-1 text-xs text-zinc-500">Shared AXIon workspace — calendar, creatives and brand sync between your team.</p>
        </div>
        <input className="input" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-xs text-flare">{err}</p>}
        <button disabled={busy} className="btn-volt w-full py-2.5">
          {busy ? <RefreshCw size={15} className="animate-spin" /> : <Lock size={15} />} Sign in
        </button>
      </form>
    </div>
  )
}
