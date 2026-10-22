// RYPL local server — zero dependencies (Node 20+).
// Runs Claude Code headless (`claude -p`) against this project, and talks to Instagram.
//
//   node index.mjs        (or: npm run dev from the repo root)
//
import './env.mjs'
import http from 'node:http'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ig from './instagram.mjs'
import * as autopilot from './autopilot.mjs'
import * as publisher from './publish.mjs'
import * as editor from './editor.mjs'
import { salvageJson } from './json-salvage.mjs'
import * as cloud from './cloud.mjs'
import pathMod from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT ?? 8787)
const ENGINE = process.env.RYPL_ENGINE ?? 'claude-code' // 'claude-code' | 'api'
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude'
const TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS ?? 900_000) // 15 min
// Effort controls how long Claude thinks before acting. 'medium' keeps creative jobs to a few minutes; raise it in .env if quality suffers.
const EFFORT = process.env.CLAUDE_EFFORT ?? 'medium'
// Posts, carousels and shoot briefs don't need long deliberation — low effort keeps them to a couple of minutes.
const POST_EFFORT = process.env.CLAUDE_POST_EFFORT ?? 'low'
const REEL_TIMEOUT_MS = Number(process.env.CLAUDE_REEL_TIMEOUT_MS ?? 1_800_000) // 30 min
// Sonnet is several times faster than Opus for these short creative jobs. Set CLAUDE_MODEL= (empty) to use your CLI default.
const MODEL = process.env.CLAUDE_MODEL ?? 'sonnet'
const UPLOADS = path.join(ROOT, 'engine/uploads')

// ---------- Claude Code runner ----------
function runClaude(prompt, { timeoutMs = TIMEOUT_MS, effort = EFFORT, onStep } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      // stream-json lets us log each step as it happens instead of waiting blind.
      '--output-format', 'stream-json', '--verbose',
      ...(MODEL ? ['--model', MODEL] : []),
      ...(effort ? ['--effort', effort] : []),
      // Let Claude write into engine/ and run the render scripts without asking.
      '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch',
      'Bash(node engine/scripts/*)', 'Bash(bash engine/scripts/*)', 'Bash(cd engine/remotion*)', 'Bash(npx remotion*)', 'Bash(mkdir*)', 'Bash(ls*)',
    ]
    const started = Date.now()
    const log = (msg) => console.log(`  [claude ${((Date.now() - started) / 1000).toFixed(0)}s] ${msg}`)
    log(`start: ${prompt.slice(0, 120)}`)
    const child = spawn(CLAUDE_BIN, args, { cwd: ROOT, env: process.env })
    let buf = ''
    let err = ''
    let result = null
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Took longer than ${Math.round(timeoutMs / 60000)} min and was stopped — try "Create now" again.`))
    }, timeoutMs)
    child.stdout.on('data', (d) => {
      buf += d
      const lines = buf.split('\n')
      buf = lines.pop()
      for (const line of lines) {
        if (!line.trim()) continue
        let ev
        try {
          ev = JSON.parse(line)
        } catch {
          continue
        }
        if (ev.type === 'assistant') {
          for (const b of ev.message?.content ?? []) {
            if (b.type === 'tool_use') {
              log(`${b.name} ${JSON.stringify(b.input.command ?? b.input.file_path ?? b.input.pattern ?? '').slice(0, 100)}`)
              onStep?.(b.name, b.input ?? {})
            }
          }
        }
        if (ev.type === 'result') result = ev
      }
    })
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(new Error(`Could not start "${CLAUDE_BIN}". Is Claude Code installed and logged in? ${e.message}`))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (!result) return reject(new Error(err || `claude exited with ${code}`))
      log(`done (${result.num_turns} turns)`)
      if (result.is_error) return reject(new Error(String(result.result ?? 'Claude reported an error')))
      try {
        resolve(extractJson(result.result))
      } catch {
        // Claude answered in prose (e.g. "ffmpeg not installed") — pass that message to the app.
        reject(new Error(String(result.result).slice(0, 800)))
      }
    })
  })
}

// Only pass through files that were uploaded via /api/upload.
const safeAssets = (list) =>
  (Array.isArray(list) ? list : []).filter((p) => typeof p === 'string' && /^engine\/uploads\/[\w.-]+$/.test(p))

// Claude is told to answer with bare JSON, but be forgiving about fences/prose.
function extractJson(text) {
  const t = String(text).trim()
  try {
    return JSON.parse(t)
  } catch {
    const m = t.match(/```(?:json)?\s*([\s\S]*?)```/) ?? t.match(/(\{[\s\S]*\})/)
    if (m) {
      try {
        return JSON.parse(m[1])
      } catch {
        /* fall through to salvage */
      }
    }
    // e.g. a caption with an unescaped "quote" — recover the fields instead of failing a finished creative.
    const s = salvageJson(t)
    if (s) return s
    throw new Error('No JSON in response')
  }
}

// Keep the Brand Brain files in sync with the app's Brand Brain page.
function syncBrand(brand) {
  if (!brand) return
  const style = path.join(ROOT, 'engine/brand/style.json')
  const s = JSON.parse(fs.readFileSync(style, 'utf8'))
  s.colors = { ...s.colors, ...brand.colors }
  s.logo = safeAssets([brand.logo])[0] ?? null
  s.logoSize = ['small', 'medium', 'large'].includes(brand.logoSize) ? brand.logoSize : 'large'
  fs.writeFileSync(style, JSON.stringify(s, null, 2))
  const files = (brand.guideFiles ?? []).filter((f) => safeAssets([f.path]).length)
  const md = `# Brand Brain — ${brand.name}

> Synced from the RYPL app. Claude reads this file before creating ANY content.
${brand.parent ? `\n**Sub-brand of ${brand.parent}.** Create content as ${brand.name}; mention ${brand.parent} only lightly (e.g. "by ${brand.parent}") if at all.\n` : ''}
## Logo
${s.logo ? `\`${s.logo}\` — the renderer places it automatically (style.json → logo). Don't redraw or recolour it.` : 'No logo uploaded — the renderer uses the brand name as a wordmark.'}

## Brand guidelines
${brand.guidelines?.trim() || '_None written yet._'}
${files.length ? `\nGuideline files — Read these before creating and follow them over generic rules:\n${files.map((f) => `- \`${f.path}\` (${f.name})`).join('\n')}\n` : ''}
## Who we are
${brand.about}

## Products / services
${brand.services.map((x) => `- ${x}`).join('\n')}

## Audience
${brand.audience}

## Tagline
${brand.tagline}

## Tone of voice
${brand.tone.join(' · ')}

## Never
${brand.avoid.map((x) => `- ${x}`).join('\n')}

## Default CTA
${brand.cta}

## Handle
${brand.handle}
`
  fs.writeFileSync(path.join(ROOT, 'engine/brand/brand.md'), md)
}

const aiImages = () => !!process.env.OPENAI_API_KEY?.trim() && process.env.RYPL_AI_IMAGES !== 'off'
const planItem = (id) => {
  const it = autopilot.listPlan().find((x) => x.id === id)
  if (!it) throw new Error('Plan item not found')
  return it
}
const commandFor = { post: 'make-post', carousel: 'make-post', reel: 'make-reel', shoot: 'shoot-brief' }

// ---------- Live progress (what Claude is doing right now), keyed by job id ----------
// Stages match web/src/engine.ts PROGRESS_STAGES.
const progress = new Map()
function stepFor(tool, input) {
  const f = String(input.file_path ?? '').split(String.fromCharCode(92)).join('/')
  const c = String(input.command ?? '')
  const name = f.split('/').pop()
  if (tool === 'Read') {
    if (f.includes('engine/brand/')) return [1, 'Reading your Brand Brain']
    if (f.includes('engine/uploads/')) return [1, 'Studying your images & guidelines']
    if (f.includes('engine/out/') && /[.](png|jpe?g)$/i.test(f)) return [6, 'Checking the result']
    return [1, 'Reading ' + name]
  }
  if (tool === 'Bash') {
    if (c.includes('gen-image')) return [3, 'Generating an AI picture (OpenAI)']
    if (c.includes('make-voice')) return [3, 'Recording the voiceover (OpenAI)']
    if (c.includes('render-reel')) return [5, 'Rendering video frames + composing music']
    if (c.includes('render-post')) return [5, 'Rendering the design']
    if (c.includes('fetch-site')) return [1, 'Reading the website']
    if (c.startsWith('ls') && c.includes('engine/out')) return [2, 'Checking recent posts, then designing the concept']
    if (c.includes('mkdir')) return [4, 'Writing the design — the longest step']
    return null
  }
  if (tool === 'Write' || tool === 'Edit') {
    if (name === 'spec.json' || name === 'reel.json') return [4, 'Writing the design' + (name === 'reel.json' ? ' + animation + music score' : '')]
    return [4, 'Writing ' + name]
  }
  return null
}
function track(jobId, format) {
  if (!jobId) return { onStep: undefined, finish: () => {} }
  const now = () => new Date().toISOString()
  const p = { format, startedAt: now(), stage: 0, label: 'Starting Claude…', lastStepAt: now(), steps: [{ at: now(), label: 'Starting Claude' }] }
  progress.set(jobId, p)
  return {
    onStep: (tool, input) => {
      const s = stepFor(tool, input)
      if (!s) return
      const [stage, label] = s
      p.lastStepAt = now()
      if (p.steps.at(-1)?.label !== label) p.steps.push({ at: p.lastStepAt, label })
      if (stage >= p.stage) [p.stage, p.label] = [stage, label]
    },
    finish: (err) => {
      p.done = true
      p.stage = err ? p.stage : 7
      p.label = err ? 'Stopped: ' + String(err.message ?? err).slice(0, 120) : 'Done'
      if (err) p.error = String(err.message ?? err).slice(0, 300)
      setTimeout(() => progress.get(jobId) === p && progress.delete(jobId), 10 * 60_000)
    },
  }
}

// Shared workspace: files another laptop uploaded (logo, guideline files, picked images) must be on this disk
// before Claude/the renderer can use them; finished creatives are uploaded so the other laptop can see them.
const absOf = (rel) => path.resolve(ROOT, String(rel).replace(/\\/g, '/'))
async function ensureInputs(brand, assets) {
  if (!cloud.enabled()) return
  const rels = [brand?.logo, ...(brand?.guideFiles ?? []).map((f) => f.path), ...(assets ?? [])].filter(Boolean)
  for (const r of safeAssets(rels)) await cloud.ensureLocal(absOf(r))
}
const creativeFolder = (files) => (files?.[0] ? path.dirname(absOf(files[0])) : null)
async function shareCreative(files) {
  const dir = creativeFolder(files)
  if (cloud.enabled() && dir) await cloud.uploadDir(dir)
}
async function hydrateCreative(item) {
  const dir = creativeFolder(item?.result?.files)
  if (cloud.enabled() && dir) await cloud.hydrateDir(dir).catch((e) => console.error('  [cloud] download failed:', e.message.slice(0, 120)))
}

async function generateCreative({ format = 'post', topic = '', occasion, brand, assets, voiceover, jobId }) {
  const t = track(jobId, format)
  try {
    await ensureInputs(brand, assets)
    const out = await runCreative({ format, topic, occasion, brand, assets, voiceover, onStep: t.onStep })
    await shareCreative(out.files)
    t.finish()
    return out
  } catch (e) {
    t.finish(e)
    throw e
  }
}

function runCreative({ format = 'post', topic = '', occasion, brand, assets, voiceover, onStep }) {
  syncBrand(brand)
  const cmd = commandFor[format] ?? 'make-post'
  const files = safeAssets(assets)
  const flags = [
    occasion ? `--occasion "${occasion}"` : '',
    format === 'carousel' ? '--carousel' : '',
    files.length ? `--assets "${files.join(',')}"` : '',
    // OpenAI image generation is available — Claude may add ONE generated picture where it helps (gen-image.mjs).
    aiImages() && format !== 'shoot' ? '--ai-images' : '',
    voiceover && format === 'reel' ? '--voiceover' : '',
  ].join(' ')
  // Motion reels write + render a custom animation (and music) — give them longer than posts.
  const reel = format === 'reel'
  return runClaude(`/${cmd} ${topic} ${flags}`.trim(), { timeoutMs: reel ? REEL_TIMEOUT_MS : TIMEOUT_MS, effort: reel ? EFFORT : POST_EFFORT, onStep })
}

// The app saves the full brand profile here (see POST /api/brand) so scheduled jobs know the brand + sub-brands.
const BRAND_FILE = path.join(ROOT, 'engine/brand/brand.json')
const loadBrandProfile = () => {
  try {
    return JSON.parse(fs.readFileSync(BRAND_FILE, 'utf8'))
  } catch {
    return null
  }
}
const resolveBrand = (b, subId) => {
  const sub = subId && b?.subBrands?.find((s) => s.id === subId)
  return sub ? { ...sub, parent: b.name } : b
}

// ---------- Custom actions (CRM / webhooks / any REST API) ----------
// Stored server-side so API keys never live in the browser. server/actions.json is gitignored.
const ACTIONS_FILE = path.join(ROOT, 'server/actions.json')
const loadActions = () => {
  try {
    return JSON.parse(fs.readFileSync(ACTIONS_FILE, 'utf8'))
  } catch {
    return []
  }
}
const saveActions = (a) => fs.writeFileSync(ACTIONS_FILE, JSON.stringify(a, null, 2))

// {{lead.name}} → vars.lead.name. Values are JSON-escaped when the template is JSON.
const fill = (tpl, vars, json) =>
  String(tpl ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = key.split('.').reduce((o, k) => o?.[k], vars) ?? ''
    return json ? JSON.stringify(String(v)).slice(1, -1) : String(v)
  })

async function runAction(action, vars) {
  const url = fill(action.url, vars, false)
  if (!/^https?:\/\//.test(url)) throw new Error('Action URL must start with http:// or https://')
  const headers = Object.fromEntries((action.headers ?? []).filter((h) => h.key).map((h) => [h.key, fill(h.value, vars, false)]))
  const hasBody = action.method !== 'GET' && action.body?.trim()
  if (hasBody && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json'
  const started = Date.now()
  const r = await fetch(url, { method: action.method ?? 'POST', headers, body: hasBody ? fill(action.body, vars, true) : undefined, signal: AbortSignal.timeout(20_000) })
  const text = await r.text()
  return { ok: r.ok, status: r.status, ms: Date.now() - started, body: text.slice(0, 2000) }
}

const sampleVars = {
  lead: { name: 'Priya Sharma', handle: '@priya.clinic', phone: '+919800000000', email: 'priya@example.com', message: 'What is the price?', source: 'Instagram' },
  post: { caption: 'Sample caption', url: 'https://instagram.com/p/sample', format: 'post' },
  brand: { name: 'Your brand' },
}

// ---------- HTTP ----------
const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
const readBody = (req) =>
  new Promise((resolve, reject) => {
    // Collect raw bytes and decode once, so multi-byte characters (×, ₹, emoji) split across chunks survive.
    const chunks = []
    req.on('data', (d) => chunks.push(d))
    req.on('end', () => {
      const b = Buffer.concat(chunks).toString('utf8')
      try {
        resolve(b ? JSON.parse(b) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
  })

const routes = {
  'GET /api/health': async () => ({ ok: true, engine: ENGINE, instagram: ig.isConnected(), aiImages: aiImages(), publishing: publisher.isConfigured(), auth: cloud.enabled(), shared: cloud.enabled(), machine: cloud.machine }),

  // ----- Login (only when the Supabase shared workspace is configured) -----
  'POST /api/auth/login': async (req) => {
    const { email, password } = await readBody(req)
    if (!cloud.enabled()) throw new Error('Login is not set up (no Supabase keys in server/.env).')
    return cloud.signIn(email, password)
  },
  'POST /api/auth/refresh': async (req) => cloud.refresh((await readBody(req)).refresh_token),
  'GET /api/auth/me': async (req) => ({ email: req.user ?? null }),

  'POST /api/generate': async (req) => generateCreative(await readBody(req)),

  // ----- Brand profile (main + sub-brands), saved so autopilot can create content without the app open -----
  // Shared workspace: the brand lives in Supabase so both laptops create with the same brand.
  'GET /api/brand': async () => {
    if (!cloud.enabled()) return loadBrandProfile()
    const kv = await cloud.getKV('brand')
    if (kv?.data) fs.writeFileSync(BRAND_FILE, JSON.stringify(kv.data, null, 2))
    return kv?.data ?? loadBrandProfile()
  },
  // Read a website (+ IG captions) and propose a brand profile. The app shows it for review before applying.
  'POST /api/brand/learn': async (req) => {
    const { url = '' } = await readBody(req)
    const u = String(url).trim()
    if (!/^https?:\/\/[^\s"]+$/.test(u)) throw new Error('Enter a full website address, e.g. https://example.com')
    return runClaude(`/learn-brand ${u}`)
  },
  'POST /api/brand': async (req) => {
    const b = await readBody(req)
    if (cloud.enabled()) {
      // Never let an older copy (e.g. a laptop that hasn't synced yet) overwrite a newer shared brand.
      const cur = await cloud.getKV('brand')
      if (cur?.data?.updatedAt && (b.updatedAt ?? '') < cur.data.updatedAt) return { ok: true, stale: true }
      await cloud.setKV('brand', b)
    }
    fs.writeFileSync(BRAND_FILE, JSON.stringify(b, null, 2))
    return { ok: true }
  },

  // ----- Content plan + autopilot -----
  'GET /api/plan': async () => ({ items: autopilot.listPlan(), settings: autopilot.getSettings(), queue: autopilot.queueState(), canPublish: publisher.isConfigured() && ig.isConnected(), progress: Object.fromEntries(progress) }),
  'GET /api/progress': async (req) => progress.get(new URL(req.url, 'http://x').searchParams.get('id')) ?? null,
  'POST /api/plan': async (req) => autopilot.upsertItem(await readBody(req)),
  'DELETE /api/plan': async (req) => {
    autopilot.deleteItem(new URL(req.url, 'http://x').searchParams.get('id'))
    return { ok: true }
  },
  // Start generating one item now (returns immediately; poll GET /api/plan for status).
  'POST /api/plan/generate': async (req) => {
    autopilot.enqueue((await readBody(req)).id)
    return { ok: true }
  },
  // Throw away upcoming auto-planned items that haven't been approved, then plan the week again (e.g. after a brand change).
  'POST /api/plan/replan': async (req) => {
    const { from, focus } = await readBody(req)
    return { removed: autopilot.clearUpcoming(from), added: await autopilot.planWeek(from, focus) }
  },
  'POST /api/plan/publish': async (req) => autopilot.publishNow((await readBody(req)).id),

  // ----- Editing a finished creative -----
  'GET /api/plan/editable': async (req) => {
    const item = planItem(new URL(req.url, 'http://x').searchParams.get('id'))
    await hydrateCreative(item) // made on the other laptop? fetch its design files first
    return editor.getEditable(item)
  },
  // Direct edits: { id, texts?: [{id,text}], images?: [{id,path}], caption?, hashtags? } — re-renders without Claude.
  'POST /api/plan/edit': async (req) => {
    const { id, texts = [], images = [], voice, caption, hashtags } = await readBody(req)
    const item = planItem(id)
    if (texts.length || images.length || voice) {
      await hydrateCreative(item)
      for (const im of images) await cloud.ensureLocal(absOf(im.path))
      await editor.applyEdits(item, { texts, images, voice })
      await shareCreative(item.result.files)
    }
    return autopilot.upsertItem({
      ...item,
      result: { ...item.result, ...(caption !== undefined ? { caption } : {}), ...(Array.isArray(hashtags) ? { hashtags } : {}) },
      editedAt: new Date().toISOString(),
    })
  },
  // AI edit: { id, instruction } — Claude changes just that part and re-renders.
  'POST /api/plan/revise': async (req) => {
    const { id, instruction = '' } = await readBody(req)
    const item = planItem(id)
    if (!instruction.trim()) throw new Error('Say what to change')
    await hydrateCreative(item)
    const dir = pathMod.relative(ROOT, editor.creativeDir(item)).split(pathMod.sep).join('/')
    const t = track(item.id, item.format)
    const reel = item.format === 'reel'
    try {
      const oneLine = instruction.split(String.fromCharCode(10)).join(' ').split(String.fromCharCode(13)).join(' ')
      const out = await runClaude(`/revise-creative ${dir} ${oneLine}${aiImages() ? ' --ai-images' : ''}`, {
        timeoutMs: reel ? REEL_TIMEOUT_MS : TIMEOUT_MS,
        effort: reel ? EFFORT : POST_EFFORT,
        onStep: t.onStep,
      })
      await shareCreative(out.files?.length ? out.files : item.result.files)
      t.finish()
      return autopilot.upsertItem({
        ...item,
        result: { ...item.result, ...(out.files?.length ? { files: out.files } : {}), ...(out.caption ? { caption: out.caption } : {}), ...(out.hashtags?.length ? { hashtags: out.hashtags } : {}), ...(out.headline ? { headline: out.headline } : {}) },
        editedAt: new Date().toISOString(),
      })
    } catch (e) {
      t.finish(e)
      throw e
    }
  },
  'POST /api/plan/auto-week': async (req) => {
    const { from, focus } = await readBody(req)
    return { added: await autopilot.planWeek(from, focus) }
  },
  'POST /api/autopilot': async (req) => autopilot.saveSettings(await readBody(req)),
  'POST /api/autopilot/run': async () => {
    autopilot.runTickNow()
    return { ok: true }
  },

  // Raw file upload: POST /api/upload?name=photo.jpg  (body = file bytes) → { path }
  'POST /api/upload': async (req) => {
    const name = new URL(req.url, 'http://x').searchParams.get('name') ?? 'file'
    const safe = path.basename(name).replace(/[^\w.-]+/g, '-').slice(-80)
    fs.mkdirSync(UPLOADS, { recursive: true })
    const rel = `engine/uploads/${Date.now()}-${safe}`
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(path.join(ROOT, rel))
      req.pipe(ws)
      ws.on('finish', resolve)
      ws.on('error', reject)
    })
    await cloud.uploadFile(path.join(ROOT, rel)).catch((e) => console.error('  [cloud] upload failed:', e.message.slice(0, 120)))
    return { path: rel }
  },

  'POST /api/analyze': async (req) => {
    const { url = '' } = await readBody(req)
    const src = safeAssets([url])[0] ?? url
    return runClaude(`/analyze-reel "${src.replace(/"/g, '')}"`)
  },

  // ----- Custom actions -----
  'GET /api/actions': async () => loadActions(),
  'POST /api/actions': async (req) => {
    const a = await readBody(req)
    if (!a.name || !a.url) throw new Error('Name and URL are required')
    const all = loadActions()
    const item = { ...a, id: a.id ?? 'act_' + Date.now().toString(36) }
    const i = all.findIndex((x) => x.id === item.id)
    i >= 0 ? (all[i] = item) : all.push(item)
    saveActions(all)
    return item
  },
  'DELETE /api/actions': async (req) => {
    const id = new URL(req.url, 'http://x').searchParams.get('id')
    saveActions(loadActions().filter((x) => x.id !== id))
    return { ok: true }
  },
  // Test (sample data) or run (real vars) a saved action: { id, vars? }
  'POST /api/actions/run': async (req) => {
    const { id, vars } = await readBody(req)
    const action = loadActions().find((x) => x.id === id)
    if (!action) throw new Error('Action not found')
    return runAction(action, vars ?? sampleVars)
  },

  'POST /api/plan-week': async (req) => {
    const { focus = '' } = await readBody(req)
    return runClaude(`/plan-week ${focus}`)
  },

  // ----- Instagram -----
  'GET /api/instagram/login': async (_req, res) => {
    res.writeHead(302, { location: ig.authUrl() })
    res.end()
  },
  'GET /api/instagram/callback': async (req, res) => {
    const code = new URL(req.url, 'http://x').searchParams.get('code')
    await ig.exchangeCode(code)
    res.writeHead(302, { location: process.env.APP_URL ?? 'http://localhost:5173/#/settings' })
    res.end()
  },
  'GET /api/instagram/media': async () => ig.recentMediaWithInsights(),
  'GET /api/instagram/account': async () => ig.accountInsights(),
  'GET /api/instagram/dashboard': async () => ig.dashboard(),
  'GET /api/instagram/leads': async () => ig.commentLeads(),
  'POST /api/instagram/publish': async (req) => ig.publish(await readBody(req)),
}

http
  .createServer(async (req, res) => {
    // The app talks to us same-origin through the Vite proxy, so no CORS is granted. Every write must carry
    // x-rypl: 1 — a custom header other websites can't send cross-origin without a preflight we never approve.
    // This stops random pages in your browser from triggering Claude runs or reading saved API keys.
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      return res.end()
    }
    if (req.method !== 'GET' && req.headers['x-rypl'] !== '1') return json(res, 403, { error: 'forbidden' })
    const urlPath = req.url.split('?')[0]
    // Shared workspace: every API call needs a signed-in, allowed user. Media GETs (<img>/<video> can't send
    // headers), the health check, login and Instagram's OAuth redirect are the only exceptions.
    const open = urlPath === '/api/health' || urlPath.startsWith('/api/auth/login') || urlPath.startsWith('/api/auth/refresh') || urlPath.startsWith('/api/instagram/callback') || urlPath.startsWith('/api/instagram/login') || (req.method === 'GET' && (urlPath.startsWith('/api/out/') || urlPath.startsWith('/api/uploads/')))
    if (cloud.enabled() && !open) {
      req.user = await cloud.verify(String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''))
      if (!req.user) return json(res, 401, { error: 'Please sign in.' })
    }
    // Serve rendered creatives: GET /api/out/<slug>/post.png → engine/out/<slug>/post.png
    if (req.method === 'GET' && req.url.startsWith('/api/out/')) {
      const rel = decodeURIComponent(req.url.slice('/api/out/'.length).split('?')[0])
      const file = path.resolve(ROOT, 'engine/out', rel)
      if (!file.startsWith(path.resolve(ROOT, 'engine/out'))) return json(res, 404, { error: 'not found' })
      if (!fs.existsSync(file)) await cloud.ensureLocal(file) // made on the other laptop
      if (!fs.existsSync(file)) return json(res, 404, { error: 'not found' })
      const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' }[path.extname(file)] ?? 'application/octet-stream'
      res.writeHead(200, { 'content-type': type })
      return fs.createReadStream(file).pipe(res)
    }
    // Serve uploads (logos, guideline files) for previews: GET /api/uploads/<file>
    if (req.method === 'GET' && req.url.startsWith('/api/uploads/')) {
      const name = path.basename(decodeURIComponent(req.url.slice('/api/uploads/'.length).split('?')[0]))
      const file = path.join(UPLOADS, name)
      if (!fs.existsSync(file)) await cloud.ensureLocal(file)
      if (!fs.existsSync(file)) return json(res, 404, { error: 'not found' })
      const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.pdf': 'application/pdf', '.mp4': 'video/mp4' }[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
      res.writeHead(200, { 'content-type': type })
      return fs.createReadStream(file).pipe(res)
    }
    const key = `${req.method} ${req.url.split('?')[0]}`
    const handler = routes[key]
    if (!handler) return json(res, 404, { error: 'not found' })
    try {
      const out = await handler(req, res)
      if (!res.headersSent) json(res, 200, out)
    } catch (e) {
      console.error(key, e.message)
      if (!res.headersSent) json(res, 500, { error: e.message })
    }
  })
  .listen(PORT, () => console.log(`RYPL server → http://localhost:${PORT}  (engine: ${ENGINE})`))

autopilot.startAutopilot({
  generate: (item) =>
    generateCreative({
      jobId: item.id,
      format: item.format,
      topic: [item.title, item.angle && `(angle: ${item.angle})`].filter(Boolean).join(' '),
      occasion: item.occasion,
      brand: resolveBrand(loadBrandProfile(), item.subBrandId),
      assets: item.assets,
      voiceover: item.voiceover,
    }),
  publish: async (item) => {
    await hydrateCreative(item) // the renders may have been made on the other laptop
    return publisher.publishItem(item)
  },
  canPublish: () => publisher.isConfigured() && ig.isConnected(),
  // One-time upload of this laptop's existing calendar, brand, settings and creatives to a new Supabase project.
  seed: async (items) => {
    const mark = path.join(ROOT, 'server/.cloud-seeded.json')
    const done = fs.existsSync(mark) ? JSON.parse(fs.readFileSync(mark, 'utf8')) : {}
    if (done.url === process.env.SUPABASE_URL) return
    console.log(`  [cloud] first sync: uploading ${items.length} calendar items, brand and creatives…`)
    const remote = new Set((await cloud.fetchPlan()).map((x) => x.id))
    await cloud.pushPlan(items.filter((x) => !remote.has(x.id)))
    const brand = loadBrandProfile()
    if (brand && !(await cloud.getKV('brand'))) await cloud.setKV('brand', { ...brand, updatedAt: brand.updatedAt ?? new Date().toISOString() })
    if (!(await cloud.getKV('autopilot'))) await cloud.setKV('autopilot', autopilot.getSettings())
    fs.writeFileSync(mark, JSON.stringify({ url: process.env.SUPABASE_URL, at: new Date().toISOString() }))
    // Files can take a while — upload them in the background.
    ;(async () => {
      for (const r of safeAssets([brand?.logo, ...(brand?.guideFiles ?? []).map((f) => f.path)])) await cloud.uploadFile(absOf(r)).catch(() => {})
      for (const it of items) await shareCreative(it.result?.files).catch(() => {})
      console.log('  [cloud] first sync: files uploaded')
    })()
  },
  planWeek: ({ from, to, focus }) => runClaude(`/plan-week --from ${from} --to ${to} ${focus ?? ''}`.trim()),
})
