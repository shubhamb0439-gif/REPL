import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { defaultBrand, leads as seedLeads, type Brand, type Lead } from './data'
import { saveBrandProfile } from './engine'

type Store = {
  brand: Brand
  setBrand: (b: Brand) => void
  leads: Lead[]
  setLeads: (l: Lead[]) => void
  igConnected: boolean
  setIgConnected: (v: boolean) => void
}

const Ctx = createContext<Store | null>(null)

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('rypl:' + key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem('rypl:' + key, JSON.stringify(v))
  } catch {
    /* storage unavailable */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // Merge over defaults so brands saved before new fields existed still load cleanly.
  const [brand, setBrandRaw] = useState<Brand>(() => ({ ...defaultBrand, ...load<Partial<Brand>>('brand', {}) }))
  // Every edit is stamped so the newest brand wins across laptops (shared workspace).
  const setBrand = (b: Brand) => setBrandRaw({ ...b, updatedAt: new Date().toISOString() })
  useEffect(() => {
    const pullBrand = () =>
      fetch('/api/brand')
        .then((r) => (r.ok ? r.json() : null))
        .then((remote: Brand | null) => {
          if (remote?.name && (remote.updatedAt ?? '') > (brandRef.current.updatedAt ?? '')) setBrandRaw({ ...defaultBrand, ...remote })
        })
        .catch(() => {})
        .finally(() => (pulled.current = true))
    pullBrand()
    window.addEventListener('focus', pullBrand)
    return () => window.removeEventListener('focus', pullBrand)
  }, [])
  const [leads, setLeads] = useState<Lead[]>(() => load('leads', seedLeads))
  const [igConnected, setIgConnected] = useState<boolean>(() => load('ig', false))
  const brandRef = useRef(brand)
  brandRef.current = brand
  const pulled = useRef(false) // don't push our copy until we've seen the shared one
  useEffect(() => save('brand', brand), [brand])
  // Mirror the brand profile to the server so autopilot can create content while the app is closed.
  useEffect(() => {
    const t = setTimeout(() => pulled.current && saveBrandProfile(brand).catch(() => {}), 800)
    return () => clearTimeout(t)
  }, [brand])
  useEffect(() => save('leads', leads), [leads])
  useEffect(() => save('ig', igConnected), [igConnected])
  // The server is the source of truth for Instagram (OAuth token or IG_ACCESS_TOKEN in server/.env).
  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => h && setIgConnected(!!h.instagram))
      .catch(() => {})
  }, [])
  return <Ctx.Provider value={{ brand, setBrand, leads, setLeads, igConnected, setIgConnected }}>{children}</Ctx.Provider>
}

export const useStore = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('StoreProvider missing')
  return c
}
