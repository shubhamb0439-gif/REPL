import type { Brand } from './data'

// RYPL engine client.
// 1. Tries the local RYPL server (server/ → runs Claude Code headless against /engine).
// 2. Falls back to the built-in demo generator so the UI always works.

export type Format = 'post' | 'carousel' | 'reel' | 'shoot'

export type Creative = {
  format: Format
  headline: string
  sub: string
  cta: string
  caption: string
  hashtags: string[]
  layout: 'bold' | 'split' | 'minimal' | 'festive' | 'photo'
  slides?: { title: string; body: string }[]
  scenes?: { t: string; text: string; motion: string }[]
  brief?: ShootBrief
  postTime: string
  rationale: string[]
  files?: string[]
  source: 'claude' | 'demo'
}

export type ShootBrief = {
  concept: string
  hook: { line: string; onScreen: string; visual: string }
  beats: { time: string; action: string; say: string }[]
  shots: string[]
  audio: string
  length: string
  props: string[]
}

let serverUp: boolean | null = null

/** engine/out/x/post.png → URL served by the local server */
export const fileUrl = (f: string) => '/api/out/' + f.replace(/\\/g, '/').replace(/^.*engine\/out\//, '')

/** Uploads a file to engine/uploads/ via the local server and returns its repo-relative path. */
export async function uploadFile(file: File): Promise<string> {
  const r = await fetch('/api/upload?name=' + encodeURIComponent(file.name), { method: 'POST', headers: { 'x-rypl': '1' }, body: file })
  if (!r.ok) throw new Error('Upload failed — is the RYPL server running?')
  return (await r.json()).path
}

/** engine/uploads/123-logo.png → URL the browser can show */
export const uploadUrl = (p: string) => '/api/uploads/' + p.split('/').pop()

// When the server is up, surface Claude's own message (e.g. "ffmpeg not installed") instead of silently showing demo data.
// x-rypl marks the request as coming from the app — the server rejects writes without it.
async function callServer<T>(url: string, body?: unknown, method = 'POST'): Promise<T> {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json', 'x-rypl': '1' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await r.json().catch(() => ({ error: `Server error ${r.status}` }))
  if (!r.ok) throw new Error(data.error ?? `Server error ${r.status}`)
  return data
}

// ---------- Live Instagram data (server/instagram.mjs) ----------
export type IgMedia = {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_product_type: 'FEED' | 'REELS' | 'STORY'
  permalink: string
  timestamp: string
  like_count?: number
  comments_count?: number
  thumbnail_url?: string
  media_url?: string
  /** views, reach, saved, shares, total_interactions; reels add ig_reels_avg_watch_time (ms) */
  metrics: Record<string, number | undefined>
}
export type IgDashboard = {
  account: { username: string; name?: string; profile_picture_url?: string; followers_count: number; follows_count?: number; media_count: number }
  totals: Record<string, number>
  prev: Record<string, number>
  series: { date: string; reach: number }[]
  media: IgMedia[]
  fetchedAt: string
}
export type IgComment = { id: string; username: string; text: string; timestamp: string; post: { id: string; permalink: string; caption: string } }
export type IgLead = { username: string; latest: IgComment; comments: IgComment[] }

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  const data = await r.json().catch(() => ({ error: `Server error ${r.status}` }))
  if (!r.ok) throw new Error(data.error ?? `Server error ${r.status}`)
  return data
}
export const igDashboard = () => getJson<IgDashboard>('/api/instagram/dashboard')
export const igLeads = () => getJson<IgLead[]>('/api/instagram/leads')

// ---------- Content plan + autopilot (server/autopilot.mjs) ----------
export type PlanStatus = 'Planned' | 'Generating' | 'In review' | 'Approved' | 'Posted' | 'Failed' | 'Skipped'
export type PlanItem = {
  id?: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  format: Format
  title: string
  angle?: string
  occasion?: string
  subBrandId?: string
  /** Reels only: add an AI voiceover (OpenAI text-to-speech). */
  voiceover?: boolean
  status: PlanStatus
  result?: Omit<Creative, 'source'>
  error?: string
  source?: 'auto-plan' | 'manual'
  generatedAt?: string
  updatedAt?: string
  permalink?: string
  postedAt?: string
  editedAt?: string
  /** Which laptop is/was creating it (shared workspace). */
  generatingOn?: string
}
export type AutopilotSettings = { enabled: boolean; leadDays: number; hour: number; autoPlan: boolean; autoPublish: boolean; focus: string; lastAutoPlan: string | null; lastTick: string | null }
/** Live progress of one generation (server/index.mjs → progress). */
export type Progress = {
  format: Format
  startedAt: string
  stage: number // index into PROGRESS_STAGES
  label: string
  lastStepAt: string
  steps: { at: string; label: string }[]
  done?: boolean
  error?: string
}
export const PROGRESS_STAGES = ['Starting', 'Brand Brain', 'Designing', 'AI picture', 'Writing design', 'Rendering', 'Checking', 'Done'] as const
export const PROGRESS_PCT = [3, 12, 28, 42, 58, 76, 92, 100]
export const getProgress = (id: string) => getJson<Progress | null>('/api/progress?id=' + encodeURIComponent(id))

export type PlanState = { items: PlanItem[]; settings: AutopilotSettings; queue: { busy: string | null; queued: string[] }; canPublish: boolean; progress?: Record<string, Progress> }
export const publishPlanItem = (id: string) => callServer<PlanItem>('/api/plan/publish', { id })

// ---------- Editing a finished creative ----------
export type VoiceSpec = { voice: string; style: string; lines: { t: number; text: string }[] }
export type Editable = { kind: 'post' | 'reel'; texts: { id: string; part: string; text: string }[]; images: { id: string; part: string; path: string }[]; voice?: VoiceSpec | null }
export const getEditable = (id: string) => getJson<Editable>('/api/plan/editable?id=' + encodeURIComponent(id))
/** Direct edits — re-renders without Claude. */
export const editPlanItem = (body: { id: string; texts?: { id: string; text: string }[]; images?: { id: string; path: string }[]; voice?: VoiceSpec; caption?: string; hashtags?: string[] }) =>
  callServer<PlanItem>('/api/plan/edit', body)
/** "Ask AI to change…" — Claude edits just that part and re-renders. */
export const revisePlanItem = (id: string, instruction: string) => callServer<PlanItem>('/api/plan/revise', { id, instruction })
/** Image URL for an engine/ path (renders or uploads). */
export const assetUrl = (p: string) => (p.includes('engine/uploads/') ? uploadUrl(p) : fileUrl(p))

export const getPlan = () => getJson<PlanState>('/api/plan')
export const savePlanItem = (item: PlanItem) => callServer<PlanItem>('/api/plan', item)
export const deletePlanItem = (id: string) => callServer('/api/plan?id=' + encodeURIComponent(id), undefined, 'DELETE')
export const generatePlanItem = (id: string) => callServer('/api/plan/generate', { id })
export const autoPlanWeek = (from: string, focus?: string) => callServer<{ added: PlanItem[] }>('/api/plan/auto-week', { from, focus })
export const saveAutopilot = (s: Partial<AutopilotSettings>) => callServer<AutopilotSettings>('/api/autopilot', s)
export const saveBrandProfile = (b: Brand) => callServer('/api/brand', b)
export const replanWeek = (from: string, focus?: string) => callServer<{ removed: number; added: PlanItem[] }>('/api/plan/replan', { from, focus })

/** What /learn-brand proposes after reading the website. Nothing is applied until the user confirms. */
export type LearnedBrand = Partial<Omit<Brand, 'subBrands'>> & {
  subBrands?: { name: string; tagline?: string; about?: string; services?: string[]; audience?: string; cta?: string }[]
  sources?: string[]
  notes?: string
}
export const learnBrand = (url: string) => callServer<LearnedBrand>('/api/brand/learn', { url })

// ---------- Custom actions (CRM, webhooks, any REST API) ----------
export type CustomAction = {
  id?: string
  name: string
  description?: string
  method: 'POST' | 'GET' | 'PUT' | 'PATCH'
  url: string
  headers: { key: string; value: string }[]
  body: string
}
export type ActionResult = { ok: boolean; status: number; ms: number; body: string }

export const listActions = async (): Promise<CustomAction[]> => {
  const r = await fetch('/api/actions')
  if (!r.ok) throw new Error('Start the RYPL server (npm run dev) to manage actions.')
  return r.json()
}
export const saveAction = (a: CustomAction) => callServer<CustomAction>('/api/actions', a)
export const deleteAction = (id: string) => callServer('/api/actions?id=' + encodeURIComponent(id), undefined, 'DELETE')
export const testAction = (id: string) => callServer<ActionResult>('/api/actions/run', { id })

export async function serverStatus(): Promise<boolean> {
  if (serverUp !== null) return serverUp
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1200)
    const r = await fetch('/api/health', { signal: ctrl.signal })
    clearTimeout(t)
    serverUp = r.ok
  } catch {
    serverUp = false
  }
  return serverUp
}

/** jobId lets the caller poll getProgress(jobId) while this runs. */
export async function generate(input: { format: Format; topic: string; occasion?: string; brand: Brand & { parent?: string }; assets?: string[]; voiceover?: boolean; jobId?: string }): Promise<Creative> {
  if (await serverStatus()) return { ...(await callServer<Creative>('/api/generate', input)), source: 'claude' }
  await new Promise((res) => setTimeout(res, 1400))
  return demoGenerate(input)
}

const pick = <T,>(arr: T[], s: string) => arr[Math.abs([...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % arr.length]

function demoGenerate({ format, topic, occasion, brand }: { format: Format; topic: string; occasion?: string; brand: Brand }): Creative {
  const t = topic.trim() || 'missed leads'
  const key = t + (occasion ?? '') + format
  const festive = !!occasion
  const hooks = [
    `Still replying to "${t}" DMs at midnight?`,
    `Nobody talks about ${t}. So we will.`,
    `${t[0].toUpperCase() + t.slice(1)}: the silent business killer.`,
    `What if ${t} handled itself?`,
  ]
  const headline = festive ? `Happy ${occasion}` : pick(hooks, key)
  const sub = festive
    ? `This ${occasion}, let AI take the night shift — so you can be with family.`
    : `${brand.name} turns ${t} into booked customers. 24/7. No breaks.`
  const tags = ['#AI', '#SmallBusiness', '#IndianStartups', '#Automation', '#' + brand.name, ...(occasion ? ['#' + occasion.replace(/[^a-z]/gi, '')] : []), '#GrowthHacks']

  const base: Creative = {
    format,
    headline,
    sub,
    cta: brand.cta,
    caption: `${headline}\n\n${sub}\n\nRecipto answers WhatsApp, Instagram and calls in seconds — trained on YOUR business.\n\n👉 ${brand.cta}`,
    hashtags: tags,
    layout: festive ? 'festive' : pick(['bold', 'split', 'minimal'] as const, key),
    postTime: pick(['Wed · 8:00 PM', 'Fri · 8:00 PM', 'Tue · 5:00 PM'], key),
    rationale: [
      'Pain-point question hook (playbook rule #1, +38% watch time)',
      'Outcome shown before explanation',
      festive ? `Rides ${occasion} search & feed surge` : 'Matches your top-performing theme: missed leads',
    ],
    source: 'demo',
  }

  if (format === 'carousel') {
    base.slides = [
      { title: headline, body: 'Swipe →' },
      { title: 'The problem', body: `62% of enquiries arrive after business hours. Most go unanswered.` },
      { title: 'The fix', body: 'An AI receptionist trained on your services, prices and FAQs.' },
      { title: 'The result', body: 'Replies in 3 seconds. Leads booked while you sleep.' },
      { title: 'Try it', body: brand.cta },
    ]
  }
  if (format === 'reel') {
    base.scenes = [
      { t: '0.0s', text: headline, motion: 'Kinetic type slam + ripple burst' },
      { t: '1.5s', text: '11:47 PM — "Hi, what are your prices?"', motion: 'Phone mock slides up, notification ping' },
      { t: '3.0s', text: 'Replied in 3 seconds ⚡', motion: 'Counter ticks 0→3s, volt flash' },
      { t: '5.5s', text: 'Appointment booked ✓', motion: 'Calendar card flips in' },
      { t: '8.0s', text: brand.cta, motion: 'Logo ripple, loop back to hook' },
    ]
  }
  if (format === 'shoot') {
    base.brief = {
      concept: festive ? `${occasion}: "The night shift" — owner celebrates while AI handles customers` : `"Caught in the act" — ${t}, dramatised`,
      hook: {
        line: festive ? `It's ${occasion}. Who's answering your customers right now?` : `Be honest — how many DMs did you ignore today?`,
        onScreen: festive ? `${occasion} night. 47 unread DMs.` : 'POV: 47 unread DMs',
        visual: 'Tight close-up of phone buzzing face-down on table, then snap-zoom to your face',
      },
      beats: [
        { time: '0–2s', action: 'Phone buzzing, notifications stacking', say: 'Hook line (to camera, deadpan)' },
        { time: '2–5s', action: 'Flip phone: Recipto already replied to all', say: '"…oh. It already did."' },
        { time: '5–10s', action: 'Screen-record scroll of AI replies & bookings', say: 'VO: "Trained on our business. Never sleeps."' },
        { time: '10–14s', action: 'You relaxing / celebrating, phone aside', say: brand.cta },
      ],
      shots: ['Macro of buzzing phone (handheld)', 'Snap-zoom face reaction (phone on tripod, 0.5×)', 'Clean screen recording of WhatsApp replies', 'Wide lifestyle shot — warm lights'],
      audio: festive ? 'Trending festive sound at low volume + your VO' : 'Trending suspense → drop sound; drop lands on "It already did."',
      length: '12–15s',
      props: festive ? ['Diyas / fairy lights', 'Sweets box', 'Phone with demo chats'] : ['Phone with demo chats', 'Coffee mug', 'Desk lamp'],
    }
  }
  return base
}

// ---------- Reel Lab ----------
export type ReelAnalysis = {
  title: string
  score: number
  curve: { s: number; you: number; viral: number }[]
  drops: { s: number; why: string }[]
  metrics: { label: string; value: string; verdict: 'good' | 'ok' | 'bad' }[]
  fixes: string[]
  source: 'claude' | 'demo'
}

export async function analyzeReel(url: string): Promise<ReelAnalysis> {
  if (await serverStatus()) return { ...(await callServer<ReelAnalysis>('/api/analyze', { url })), source: 'claude' }
  await new Promise((res) => setTimeout(res, 1800))
  const curve = Array.from({ length: 31 }, (_, i) => {
    const s = i * 0.5
    const viral = 100 * Math.exp(-s / 22) - (s < 2 ? s * 4 : 8)
    let you = 100 * Math.exp(-s / 9) - (s > 2.5 ? 18 : s * 5)
    if (s > 3 && s < 5) you -= 6
    if (s >= 9) you -= 4
    return { s, viral: Math.max(8, +viral.toFixed(1)), you: Math.max(4, +you.toFixed(1)) }
  })
  return {
    title: url.includes('instagram') ? 'Reel · ' + url.split('/').filter(Boolean).pop() : url || 'Uploaded reel',
    score: 63,
    curve,
    drops: [
      { s: 2.5, why: 'Hook is a logo intro — no pattern interrupt. 18% leave here.' },
      { s: 4, why: 'Talking head with no cut for 3.2s; energy dips.' },
      { s: 9, why: 'CTA arrives before payoff; viewers feel it is “over”.' },
    ],
    metrics: [
      { label: 'Hook strength', value: '4.1/10', verdict: 'bad' },
      { label: 'Cuts / 5s', value: '2', verdict: 'bad' },
      { label: 'On-screen text', value: 'Yes · 72% of frames', verdict: 'good' },
      { label: 'Payoff time', value: '8.4s', verdict: 'ok' },
      { label: 'Loopability', value: 'Low', verdict: 'bad' },
      { label: 'Audio', value: 'Original VO', verdict: 'ok' },
    ],
    fixes: [
      'Cut the 2s logo intro. Open on the most surprising frame (the 3am notification).',
      'Add a cut every ~1s in the first 5s — B-roll of phone, face, screen.',
      'Move the result (“booked ✓”) to 3s; explain after.',
      'Put CTA in the last 1.5s and end on a frame that loops into the first.',
      'Add bold captions — 85% watch muted.',
    ],
    source: 'demo',
  }
}
