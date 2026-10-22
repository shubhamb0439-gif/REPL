// Supabase connection: login, shared calendar/brand/settings, and shared files.
// Only active when SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are set in server/.env —
// otherwise RYPL keeps working purely locally. Zero dependencies: plain REST calls.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const URL_ = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
const ANON = (process.env.SUPABASE_ANON_KEY ?? '').trim()
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const BUCKET = process.env.SUPABASE_BUCKET ?? 'rypl'
const ALLOWED = (process.env.RYPL_ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

export const enabled = () => !!(URL_ && ANON && SERVICE)
/** This laptop's name in claims, e.g. "SHUBHAM-PC". */
export const machine = (process.env.RYPL_MACHINE ?? os.hostname()).slice(0, 60)
const enc = encodeURIComponent

async function call(url, { method = 'GET', key = SERVICE, token, body, headers = {}, raw = false } = {}) {
  const r = await fetch(url, {
    method,
    headers: { apikey: key, authorization: `Bearer ${token ?? key}`, ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...headers },
    body: raw ? body : body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    const err = new Error(`Supabase ${r.status}: ${t.slice(0, 300)}`)
    err.status = r.status
    throw err
  }
  return r
}
const rest = async (method, q, body, prefer) => {
  const r = await call(`${URL_}/rest/v1/${q}`, { method, body, headers: prefer ? { prefer } : {} })
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

// ---------- Auth ----------
export async function signIn(email, password) {
  const e = String(email).trim().toLowerCase()
  if (ALLOWED.length && !ALLOWED.includes(e)) throw new Error('This email is not allowed to use RYPL.')
  const r = await call(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', key: ANON, body: { email: e, password } }).catch((err) => {
    throw new Error(err.status === 400 ? 'Wrong email or password.' : err.message)
  })
  return session(await r.json())
}
export async function refresh(refresh_token) {
  const r = await call(`${URL_}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', key: ANON, body: { refresh_token } })
  return session(await r.json())
}
const session = (j) => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at, user: { email: j.user?.email } })

const tokenCache = new Map() // access token → { email, until }
/** Email of a valid, allowed session token — or null. */
export async function verify(token) {
  if (!token) return null
  const hit = tokenCache.get(token)
  if (hit && hit.until > Date.now()) return hit.email
  try {
    const r = await call(`${URL_}/auth/v1/user`, { key: ANON, token })
    const email = String((await r.json()).email ?? '').toLowerCase()
    if (!email || (ALLOWED.length && !ALLOWED.includes(email))) return null
    tokenCache.set(token, { email, until: Date.now() + 5 * 60_000 })
    return email
  } catch {
    return null
  }
}

// ---------- Calendar items ----------
const row = (i) => ({ id: i.id, status: i.status, date: i.date, data: i, updated_at: i.updatedAt ?? new Date().toISOString() })
export const fetchPlan = async () => ((await rest('GET', 'plan_items?select=data,claimed_by')) ?? []).map((r) => r.data)
export const pushPlan = (items) => (items.length ? rest('POST', 'plan_items?on_conflict=id', items.map(row), 'resolution=merge-duplicates,return=minimal') : null)
export const deletePlan = (ids) => (ids.length ? rest('DELETE', `plan_items?id=in.(${ids.map((id) => `"${id}"`).map(enc).join(',')})`) : null)

/** Atomically lock an item for this laptop (generate/publish). False if another laptop holds a fresh claim. */
export async function claim(id, { status, staleMin = 40 } = {}) {
  const cutoff = new Date(Date.now() - staleMin * 60_000).toISOString()
  let q = `plan_items?id=eq.${enc(id)}&or=${enc(`(claimed_by.is.null,claimed_by.eq."${machine}",claimed_at.lt."${cutoff}")`)}`
  if (status) q += `&status=eq.${enc(status)}`
  const rows = await rest('PATCH', q, { claimed_by: machine, claimed_at: new Date().toISOString() }, 'return=representation')
  return (rows ?? []).length > 0
}
export const release = (id) => rest('PATCH', `plan_items?id=eq.${enc(id)}&claimed_by=eq.${enc(machine)}`, { claimed_by: null, claimed_at: null }, 'return=minimal')
/** On startup: drop this laptop's leftover claims (e.g. after a crash) and return those items. */
export const releaseMine = async () => (await rest('PATCH', `plan_items?claimed_by=eq.${enc(machine)}`, { claimed_by: null, claimed_at: null }, 'return=representation')) ?? []

// ---------- Key/value (brand, shared autopilot settings, daily planning lock) ----------
export const getKV = async (key) => ((await rest('GET', `kv?key=eq.${enc(key)}&select=data,updated_at`)) ?? [])[0] ?? null
export const setKV = (key, data) => rest('POST', 'kv?on_conflict=key', [{ key, data, updated_at: new Date().toISOString() }], 'resolution=merge-duplicates,return=minimal')
/** Insert-if-absent: true only for the first laptop to ask (used so only one laptop plans a given week). */
export async function claimKV(key, data = {}) {
  const rows = await rest('POST', 'kv?on_conflict=key', [{ key, data: { ...data, by: machine } }], 'resolution=ignore-duplicates,return=representation')
  return (rows ?? []).length > 0
}

// ---------- Files (engine/out/** renders, engine/uploads/**) ----------
const objectFor = (abs) => path.relative(path.join(ROOT, 'engine'), abs).split(path.sep).join('/') // out/<slug>/post.png
const absFor = (obj) => path.join(ROOT, 'engine', ...obj.split('/'))
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.json': 'application/json', '.pdf': 'application/pdf', '.gif': 'image/gif' }

export async function uploadFile(abs) {
  if (!enabled() || !fs.existsSync(abs)) return
  await call(`${URL_}/storage/v1/object/${BUCKET}/${objectFor(abs).split('/').map(enc).join('/')}`, {
    method: 'POST',
    raw: true,
    body: fs.readFileSync(abs),
    headers: { 'content-type': TYPES[path.extname(abs).toLowerCase()] ?? 'application/octet-stream', 'x-upsert': 'true' },
  })
}
/** Upload a creative's folder (renders + design/voice files; skips frames and the regenerable music.wav). */
export async function uploadDir(absDir) {
  if (!enabled() || !fs.existsSync(absDir)) return
  for (const f of fs.readdirSync(absDir)) {
    const p = path.join(absDir, f)
    if (fs.statSync(p).isFile() && f !== 'music.wav') await uploadFile(p).catch((e) => console.error('  [cloud] upload failed', f, e.message.slice(0, 120)))
  }
}
/** Make sure an engine/… file exists locally, downloading it from the shared bucket if another laptop made it. */
export async function ensureLocal(abs) {
  if (fs.existsSync(abs) || !enabled()) return fs.existsSync(abs)
  try {
    const r = await call(`${URL_}/storage/v1/object/${BUCKET}/${objectFor(abs).split('/').map(enc).join('/')}`)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, Buffer.from(await r.arrayBuffer()))
    return true
  } catch {
    return false
  }
}
/** Download every file of a creative folder that's missing locally (before editing or publishing it). */
export async function hydrateDir(absDir) {
  if (!enabled()) return
  const prefix = objectFor(absDir) + '/'
  const r = await call(`${URL_}/storage/v1/object/list/${BUCKET}`, { method: 'POST', body: { prefix, limit: 1000 } })
  for (const o of await r.json()) if (o.id) await ensureLocal(absFor(prefix + o.name))
}
