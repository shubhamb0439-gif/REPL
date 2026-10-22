// Instagram API with Instagram Login (no Facebook Page needed).
// Requires an Instagram Business or Creator account and a Meta app with the Instagram product.
// Docs: https://developers.facebook.com/docs/instagram-platform
//
// Endpoints and metric names change between Graph API versions — if a call fails,
// check the docs for the version in IG_API_VERSION.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TOKEN_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.ig-token.json')
const V = process.env.IG_API_VERSION ?? 'v21.0'
const GRAPH = `https://graph.instagram.com/${V}`

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
].join(',')

// Token from the "Connect Instagram" OAuth flow, or one pasted into server/.env as IG_ACCESS_TOKEN
// (Meta dashboard → Instagram → API setup with Instagram login → Generate token).
const loadToken = () => {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
  } catch {
    return process.env.IG_ACCESS_TOKEN ? { access_token: process.env.IG_ACCESS_TOKEN } : null
  }
}
const saveToken = (t) => fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2))
export const isConnected = () => !!loadToken()?.access_token

function need(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name} in server/.env`)
  return v
}

export function authUrl() {
  const u = new URL('https://www.instagram.com/oauth/authorize')
  u.searchParams.set('client_id', need('IG_APP_ID'))
  u.searchParams.set('redirect_uri', need('IG_REDIRECT_URI'))
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', SCOPES)
  return u.toString()
}

export async function exchangeCode(code) {
  // 1) short-lived token
  const form = new URLSearchParams({
    client_id: need('IG_APP_ID'),
    client_secret: need('IG_APP_SECRET'),
    grant_type: 'authorization_code',
    redirect_uri: need('IG_REDIRECT_URI'),
    code,
  })
  const short = await (await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form })).json()
  if (!short.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(short))
  // 2) long-lived token (~60 days)
  const long = await (
    await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${need('IG_APP_SECRET')}&access_token=${short.access_token}`)
  ).json()
  saveToken({ access_token: long.access_token ?? short.access_token, user_id: short.user_id, saved_at: Date.now(), expires_in: long.expires_in })
}

async function get(p, params = {}) {
  const t = loadToken()
  if (!t) throw new Error('Instagram not connected')
  const u = new URL(GRAPH + p)
  Object.entries({ ...params, access_token: t.access_token }).forEach(([k, v]) => u.searchParams.set(k, v))
  const r = await fetch(u)
  const j = await r.json()
  if (j.error) throw new Error(j.error.message)
  return j
}
async function post(p, params) {
  const t = loadToken()
  if (!t) throw new Error('Instagram not connected')
  const r = await fetch(GRAPH + p, { method: 'POST', body: new URLSearchParams({ ...params, access_token: t.access_token }) })
  const j = await r.json()
  if (j.error) throw new Error(j.error.message)
  return j
}

export async function accountInsights() {
  const me = await get('/me', { fields: 'user_id,username,followers_count,media_count' })
  const insights = await get('/me/insights', { metric: 'reach,views,accounts_engaged,total_interactions', period: 'day', metric_type: 'total_value' }).catch((e) => ({ error: e.message }))
  return { me, insights }
}

export async function recentMediaWithInsights(limit = 25) {
  const media = await get('/me/media', { fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url', limit })
  const metricsFor = (m) =>
    m.media_product_type === 'REELS'
      ? 'views,reach,saved,shares,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time'
      : 'views,reach,saved,shares,total_interactions'
  const out = []
  for (const m of media.data ?? []) {
    const ins = await get(`/${m.id}/insights`, { metric: metricsFor(m) }).catch(() => ({ data: [] }))
    const metrics = Object.fromEntries((ins.data ?? []).map((x) => [x.name, x.values?.[0]?.value ?? x.total_value?.value]))
    out.push({ ...m, metrics })
  }
  // Feed the learning loop
  const perf = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../engine/data/performance.json')
  fs.writeFileSync(perf, JSON.stringify(out, null, 2))
  return out
}

/**
 * Publish an image, carousel or reel.
 * Media must be at a PUBLIC https URL (Instagram fetches it) — upload renders to S3/Cloudinary/R2
 * or expose engine/out via a tunnel (e.g. cloudflared) before calling this.
 *   { type: 'IMAGE', url, caption }
 *   { type: 'CAROUSEL', urls: [...], caption }
 *   { type: 'REELS', url, caption, cover_url? }
 */
export async function publish({ type = 'IMAGE', url, urls, caption = '', cover_url }) {
  let creation
  if (type === 'CAROUSEL') {
    const children = []
    for (const u of urls) children.push((await post('/me/media', { image_url: u, is_carousel_item: 'true' })).id)
    creation = await post('/me/media', { media_type: 'CAROUSEL', children: children.join(','), caption })
  } else if (type === 'REELS') {
    creation = await post('/me/media', { media_type: 'REELS', video_url: url, caption, ...(cover_url ? { cover_url } : {}) })
    // videos process asynchronously — poll until ready
    for (let i = 0; i < 30; i++) {
      const s = await get(`/${creation.id}`, { fields: 'status_code' })
      if (s.status_code === 'FINISHED') break
      if (s.status_code === 'ERROR') throw new Error('Instagram could not process the video')
      await new Promise((r) => setTimeout(r, 5000))
    }
  } else {
    creation = await post('/me/media', { image_url: url, caption })
  }
  // Images and carousels usually finish instantly, but publishing an unfinished container fails — wait briefly.
  for (let i = 0; i < 12; i++) {
    const s = await get(`/${creation.id}`, { fields: 'status_code' }).catch(() => ({}))
    if (!s.status_code || s.status_code === 'FINISHED') break
    if (s.status_code === 'ERROR') throw new Error('Instagram could not process the media')
    await new Promise((r) => setTimeout(r, 3000))
  }
  return post('/me/media_publish', { creation_id: creation.id })
}

export const permalink = async (id) => (await get(`/${id}`, { fields: 'permalink' })).permalink

// ---------- Live dashboard + comment leads (cached briefly to stay well under rate limits) ----------
const cache = new Map()
const cached = async (key, ms, fn) => {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ms) return hit.value
  const value = await fn()
  cache.set(key, { at: Date.now(), value })
  return value
}

const totalsFor = async (since, until) => {
  const r = await get('/me/insights', {
    metric: 'views,reach,accounts_engaged,total_interactions,likes,comments,shares,saves',
    period: 'day',
    metric_type: 'total_value',
    since,
    until,
  }).catch(() => ({ data: [] }))
  return Object.fromEntries((r.data ?? []).map((x) => [x.name, x.total_value?.value ?? 0]))
}

/** Everything the Dashboard needs, for the last 30 days (+ the 30 before, for % change). */
export const dashboard = () =>
  cached('dashboard', 5 * 60_000, async () => {
    const now = Math.floor(Date.now() / 1000)
    const d30 = now - 30 * 86400
    const [account, totals, prev, series, media] = await Promise.all([
      get('/me', { fields: 'username,name,profile_picture_url,followers_count,follows_count,media_count' }),
      totalsFor(d30, now),
      totalsFor(d30 - 30 * 86400, d30),
      get('/me/insights', { metric: 'reach', period: 'day', since: d30, until: now }).catch(() => ({ data: [] })),
      recentMediaWithInsights(25),
    ])
    return {
      account,
      totals,
      prev,
      series: (series.data?.[0]?.values ?? []).map((v) => ({ date: v.end_time, reach: v.value })),
      media,
      fetchedAt: new Date().toISOString(),
    }
  })

/** Comments from other people on your recent posts — each one is a potential lead. */
export const commentLeads = () =>
  cached('leads', 2 * 60_000, async () => {
    const me = await get('/me', { fields: 'username' })
    const media = await get('/me/media', { fields: 'id,caption,permalink,comments_count', limit: 25 })
    const out = []
    for (const m of (media.data ?? []).filter((x) => x.comments_count > 0)) {
      // Other people's comments carry the author in `from`, not `username`.
      const c = await get(`/${m.id}/comments`, { fields: 'id,text,username,from,timestamp', limit: 50 }).catch(() => ({ data: [] }))
      for (const x of c.data ?? []) {
        const username = x.from?.username ?? x.username
        if (!username || username === me.username) continue
        out.push({ id: x.id, username, text: x.text, timestamp: x.timestamp, post: { id: m.id, permalink: m.permalink, caption: (m.caption ?? '').split('\n')[0].slice(0, 80) } })
      }
    }
    // One lead per person: latest comment first, with all their comments attached.
    const byUser = new Map()
    for (const x of out.sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
      const l = byUser.get(x.username)
      l ? l.comments.push(x) : byUser.set(x.username, { username: x.username, latest: x, comments: [x] })
    }
    return [...byUser.values()]
  })
