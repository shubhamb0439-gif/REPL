// Content plan + autopilot.
//
// The plan lives in engine/data/plan.json (one item per scheduled creative). While the server runs, a tick every
// minute:
//   1. auto-plans the next 7 days with /plan-week when nothing is planned for them yet (once per day),
//   2. publishes approved items whose time has come, and
//   3. generates anything Planned that is due within `leadDays` (so it's ready for review before it goes out).
// Generation runs one item at a time so Claude isn't asked to render several reels in parallel.
//
// Shared workspace (Supabase, see cloud.mjs): plan.json becomes a local cache that's pushed on every change and
// pulled every few seconds. Before generating or publishing, a laptop *claims* the item in the database, so when
// both laptops run autopilot nothing is created or posted twice; only one laptop plans a given week.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cloud from './cloud.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN_FILE = path.join(ROOT, 'engine/data/plan.json')
const SETTINGS_FILE = path.join(ROOT, 'server/autopilot.json')

const readJson = (f, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return fallback
  }
}
const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2))

/** Local calendar date, e.g. "2026-10-22" (not UTC — posting days are local days). */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n))
}
const sortPlan = (items) => items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

// ---------- Plan store ----------
export const STATUSES = ['Planned', 'Generating', 'In review', 'Approved', 'Posted', 'Failed', 'Skipped']
export const listPlan = () => readJson(PLAN_FILE, [])

// Changes not yet confirmed by the cloud (so a pull doesn't undo them, and they're retried).
const pending = new Map() // id → 'upsert' | 'delete'
function savePlan(items) {
  const before = new Map(listPlan().map((x) => [x.id, JSON.stringify(x)]))
  writeJson(PLAN_FILE, sortPlan(items))
  if (!cloud.enabled()) return
  for (const x of items) if (before.get(x.id) !== JSON.stringify(x)) pending.set(x.id, 'upsert')
  for (const id of before.keys()) if (!items.some((x) => x.id === id)) pending.set(id, 'delete')
  flush()
}
let flushing = false
async function flush() {
  if (flushing || !pending.size || !cloud.enabled()) return
  flushing = true
  try {
    const items = new Map(listPlan().map((x) => [x.id, x]))
    const up = [...pending].filter(([id, op]) => op === 'upsert' && items.has(id)).map(([id]) => id)
    const del = [...pending].filter(([, op]) => op === 'delete').map(([id]) => id)
    await cloud.pushPlan(up.map((id) => items.get(id)))
    await cloud.deletePlan(del)
    for (const id of [...up, ...del]) pending.delete(id)
  } catch (e) {
    console.error('  [cloud] sync failed (will retry):', e.message.slice(0, 160))
  } finally {
    flushing = false
  }
}
/** Bring in changes made on the other laptop. Newer `updatedAt` wins; local unsynced changes are kept. */
async function pull() {
  if (!cloud.enabled()) return
  try {
    await flush()
    const remote = await cloud.fetchPlan()
    const local = new Map(listPlan().map((x) => [x.id, x]))
    const merged = new Map()
    for (const r of remote) {
      const l = local.get(r.id)
      merged.set(r.id, pending.has(r.id) && l ? l : !l || (r.updatedAt ?? '') >= (l.updatedAt ?? '') ? r : l)
    }
    for (const [id, l] of local) if (!merged.has(id) && pending.get(id) === 'upsert') merged.set(id, l) // not uploaded yet
    writeJson(PLAN_FILE, sortPlan([...merged.values()]))
    // Shared autopilot settings (the other laptop may have changed the time or focus).
    const kv = await cloud.getKV('autopilot')
    if (kv?.data) writeJson(SETTINGS_FILE, { ...readJson(SETTINGS_FILE, {}), ...pickShared(kv.data) })
  } catch (e) {
    console.error('  [cloud] pull failed:', e.message.slice(0, 160))
  }
}

export function upsertItem(item) {
  const items = listPlan()
  const now = new Date().toISOString()
  const next = { status: 'Planned', time: '19:00', format: 'post', ...item, id: item.id ?? 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), updatedAt: now }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date ?? '')) throw new Error('date must be YYYY-MM-DD')
  if (!STATUSES.includes(next.status)) throw new Error('unknown status')
  const i = items.findIndex((x) => x.id === next.id)
  i >= 0 ? (items[i] = { ...items[i], ...next }) : items.push(next)
  savePlan(items)
  return i >= 0 ? items[i] : next
}
const patchItem = (id, patch) => {
  const items = listPlan()
  const i = items.findIndex((x) => x.id === id)
  if (i < 0) return null
  items[i] = { ...items[i], ...patch, updatedAt: new Date().toISOString() }
  savePlan(items)
  return items[i]
}
export const deleteItem = (id) => savePlan(listPlan().filter((x) => x.id !== id))
/** Remove auto-planned items from `from` onwards that you haven't approved or posted. Manual items are kept. */
export function clearUpcoming(from = dayKey()) {
  const keep = (x) => x.date < from || x.source !== 'auto-plan' || ['Approved', 'Posted', 'Generating'].includes(x.status) || x.id === busy
  const items = listPlan()
  savePlan(items.filter(keep))
  return items.length - items.filter(keep).length
}

// ---------- Settings ----------
// Shared between laptops: how autopilot behaves. Local only: runtime state (last tick, usage-limit pause).
const SHARED = ['enabled', 'leadDays', 'hour', 'autoPlan', 'autoPublish', 'focus']
const pickShared = (o) => Object.fromEntries(SHARED.filter((k) => k in o).map((k) => [k, o[k]]))
const defaults = { enabled: true, leadDays: 1, hour: 9, autoPlan: true, autoPublish: true, focus: '', lastAutoPlan: null, lastTick: null }
export const getSettings = () => ({ ...defaults, ...readJson(SETTINGS_FILE, {}) })
export const saveSettings = (patch) => {
  const s = { ...getSettings(), ...patch }
  writeJson(SETTINGS_FILE, s)
  if (cloud.enabled() && SHARED.some((k) => k in patch)) cloud.setKV('autopilot', pickShared(s)).catch((e) => console.error('  [cloud] settings sync failed:', e.message.slice(0, 120)))
  return s
}

// ---------- Generation queue ----------
let generateFn = null
let planWeekFn = null
let publishFn = null
let canPublish = () => false
const publishing = new Set()

/** Publish one item now. Marks it Posted with the Instagram link, or records the error (status unchanged). */
export async function publishNow(id) {
  if (cloud.enabled()) await pull()
  const item = listPlan().find((x) => x.id === id)
  if (!item) throw new Error('Plan item not found')
  if (item.status === 'Posted') throw new Error('Already posted')
  if (publishing.has(id)) throw new Error('Already publishing')
  // The other laptop may be publishing this exact item right now — only one may.
  if (cloud.enabled() && !(await cloud.claim(id, { status: item.status, staleMin: 15 }))) throw new Error('The other laptop is publishing this right now.')
  publishing.add(id)
  try {
    console.log(`  [autopilot] publishing ${item.date} ${item.format}: ${item.title}`)
    const r = await publishFn(item)
    return patchItem(id, { status: 'Posted', postedAt: new Date().toISOString(), permalink: r.permalink, mediaId: r.mediaId, error: null })
  } catch (e) {
    patchItem(id, { error: 'Publishing failed: ' + e.message.slice(0, 600) })
    throw e
  } finally {
    publishing.delete(id)
    if (cloud.enabled()) {
      await flush()
      await cloud.release(id).catch(() => {})
    }
  }
}
const queue = []
let busy = null

// When the Claude plan's usage limit is hit, pause generation until it resets instead of failing every item.
// Message looks like: "You've hit your limit · resets 3pm (Asia/Calcutta)".
const isLimit = (msg) => /hit your limit|usage limit|rate.?limit|429/i.test(msg)
function resetTime(msg) {
  const m = msg.match(/resets\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (!m) return new Date(Date.now() + 60 * 60_000)
  let h = +m[1] % 12
  if (m[3].toLowerCase() === 'pm') h += 12
  const t = new Date()
  t.setHours(h, +(m[2] ?? 0) + 2, 0, 0) // +2 min margin
  if (t <= new Date()) t.setDate(t.getDate() + 1)
  return t
}
export const pausedUntil = () => {
  const u = getSettings().pausedUntil
  return u && new Date(u) > new Date() ? u : null
}
const hhmm = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

/** Queue one plan item for generation. */
export function enqueue(id) {
  const paused = pausedUntil()
  if (paused) throw new Error(`Claude usage limit reached — creation resumes automatically at ${hhmm(paused)}.`)
  if (busy === id || queue.includes(id)) return
  queue.push(id)
  pump()
}
async function pump() {
  if (busy || !queue.length) return
  busy = queue.shift()
  const id = busy
  try {
    // Lock it so the other laptop's autopilot doesn't make the same thing.
    if (cloud.enabled() && !(await cloud.claim(id).catch(() => false))) {
      console.log(`  [autopilot] ${id} is being made on the other laptop — skipping`)
      return
    }
    patchItem(id, { status: 'Generating', error: null, generatingOn: cloud.machine })
    const item = listPlan().find((x) => x.id === id)
    try {
      if (!item) throw new Error('Plan item was deleted')
      console.log(`  [autopilot] generating ${item.date} ${item.format}: ${item.title}`)
      const result = await generateFn(item)
      patchItem(item.id, { status: 'In review', result, error: null, generatedAt: new Date().toISOString() })
    } catch (e) {
      console.error(`  [autopilot] failed: ${e.message.slice(0, 200)}`)
      if (isLimit(e.message)) {
        // Put this item and everything queued back to Planned; tick() retries after the reset.
        const until = resetTime(e.message).toISOString()
        saveSettings({ pausedUntil: until })
        const note = `Waiting — Claude usage limit reached. Retries automatically after ${hhmm(until)}.`
        for (const qid of [item?.id, ...queue.splice(0)].filter(Boolean)) patchItem(qid, { status: 'Planned', error: note })
        console.log(`  [autopilot] paused until ${until}`)
      } else if (item) patchItem(item.id, { status: 'Failed', error: e.message.slice(0, 800) })
    }
    if (cloud.enabled()) {
      await flush()
      await cloud.release(id).catch(() => {})
    }
  } finally {
    busy = null
    pump()
  }
}
export const queueState = () => ({ busy, queued: [...queue] })

/** Ask Claude to plan 7 days starting `from` and add them as Planned items. */
export async function planWeek(from = addDays(dayKey(), 1), focus = getSettings().focus) {
  const to = addDays(from, 6)
  const out = await planWeekFn({ from, to, focus })
  const added = []
  for (const x of out.items ?? []) {
    if (!x.date || x.date < from || x.date > to) continue
    added.push(
      upsertItem({
        date: x.date,
        time: x.time ?? '19:00',
        format: ['post', 'carousel', 'reel', 'shoot'].includes(x.format) ? x.format : 'post',
        title: x.hook ?? x.title ?? 'Untitled',
        angle: x.angle ?? '',
        occasion: x.occasion || undefined,
        source: 'auto-plan',
      }),
    )
  }
  return added
}

// ---------- Daily tick ----------
const nowHHMM = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
async function tick() {
  await pull()
  const s = getSettings()
  if (!s.enabled) return
  const now = new Date()
  const today = dayKey(now)
  saveSettings({ lastTick: now.toISOString() })
  if (now.getHours() < s.hour) {
    // Publishing doesn't wait for the daily generation hour.
    if (s.autoPublish && canPublish())
      for (const x of listPlan())
        if (x.status === 'Approved' && x.date === today && x.time <= nowHHMM(now) && !x.error?.startsWith('Publishing failed'))
          await publishNow(x.id).catch(() => {})
    return
  }

  // While the Claude usage limit is in effect, only publishing (which doesn't use Claude) carries on.
  const paused = !!pausedUntil()
  if (!paused && s.pausedUntil) saveSettings({ pausedUntil: null })

  // 1) Make sure the coming week has a plan.
  if (!paused && s.autoPlan && s.lastAutoPlan !== today) {
    // Start today if nothing is planned for today yet, so "today's post" exists; otherwise start tomorrow.
    const hasToday = listPlan().some((x) => x.date === today && x.status !== 'Skipped')
    const from = hasToday ? addDays(today, 1) : today
    const to = addDays(from, 6)
    const planned = listPlan().filter((x) => x.date >= from && x.date <= to && x.status !== 'Skipped')
    if (planned.length < 3) {
      saveSettings({ lastAutoPlan: today })
      // Only one laptop plans a given week.
      const mine = !cloud.enabled() || (await cloud.claimKV(`autoplan:${from}`).catch(() => false))
      if (mine)
        try {
          const added = await planWeek(from)
          console.log(`  [autopilot] planned ${added.length} items for ${from} → ${to}`)
        } catch (e) {
          console.error(`  [autopilot] auto-plan failed: ${e.message.slice(0, 200)}`)
          if (isLimit(e.message)) saveSettings({ pausedUntil: resetTime(e.message).toISOString(), lastAutoPlan: null })
        }
    }
  }

  // 2) Publish approved items whose time has come (only once Cloudinary is set up).
  if (s.autoPublish && canPublish()) {
    const nowKey = today + ' ' + nowHHMM(now)
    for (const x of listPlan())
      if (x.status === 'Approved' && x.date >= addDays(today, -1) && `${x.date} ${x.time}` <= nowKey && !x.error?.startsWith('Publishing failed'))
        await publishNow(x.id).catch(() => {})
  }

  // 3) Generate anything due soon.
  if (paused) return
  const horizon = addDays(today, s.leadDays)
  for (const x of listPlan()) if (x.status === 'Planned' && x.date <= horizon && x.date >= today) enqueue(x.id)
}

export async function startAutopilot({ generate, planWeek: pw, publish, canPublish: cp, seed, everyMs = 60_000 }) {
  generateFn = generate
  planWeekFn = pw
  publishFn = publish
  canPublish = cp ?? canPublish
  if (cloud.enabled()) {
    // First time on this Supabase project: upload what's already here before syncing, so nothing local is lost.
    await seed?.(listPlan()).catch((e) => console.error('  [cloud] initial upload failed:', e.message.slice(0, 160)))
    // Items this laptop was making when it last stopped go back to Planned (the other laptop's work is left alone).
    const mine = await cloud.releaseMine().catch(() => [])
    await pull()
    for (const r of mine) if (r.status === 'Generating') patchItem(r.id, { status: 'Planned' })
    setInterval(pull, 8_000) // keep the calendar in step with the other laptop
    console.log(`  [cloud] shared workspace on (Supabase) as "${cloud.machine}"`)
  } else {
    for (const x of listPlan()) if (x.status === 'Generating') patchItem(x.id, { status: 'Planned' })
  }
  setTimeout(tick, 15_000)
  setInterval(tick, everyMs)
}
export const runTickNow = tick
