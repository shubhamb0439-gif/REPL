// Edit a finished creative without recreating it: change the text on the design, swap pictures, re-render.
// Works on the spec Claude wrote (engine/out/<slug>/spec.json for posts/carousels, reel.json for reels).
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'engine/out')

/** engine/out/<slug>/ folder of a plan item's result. */
export function creativeDir(item) {
  const f = item.result?.files?.[0]
  if (!f) throw new Error('Nothing rendered yet — create it first.')
  const dir = path.dirname(path.resolve(ROOT, f.replace(/\\/g, '/')))
  if (!dir.startsWith(OUT) || !fs.existsSync(dir)) throw new Error('Creative files not found')
  return dir
}

function loadSpec(dir) {
  for (const name of ['reel.json', 'spec.json']) {
    const file = path.join(dir, name)
    if (fs.existsSync(file)) return { file, kind: name === 'reel.json' ? 'reel' : 'post', spec: JSON.parse(fs.readFileSync(file, 'utf8')) }
  }
  throw new Error('This creative has no editable design file (it was made with an older template). Use "Ask AI to change" or Regenerate.')
}

// The HTML parts of a spec: one for a post or reel, one per carousel slide.
function parts(kind, spec) {
  if (kind === 'post' && spec.format === 'carousel' && Array.isArray(spec.slides))
    return spec.slides.map((s, i) => ({ label: `Slide ${i + 1}`, get: () => s.html ?? '', set: (v) => (s.html = v) })).filter((p) => p.get())
  return spec.html ? [{ label: kind === 'reel' ? 'Reel' : 'Post', get: () => spec.html, set: (v) => (spec.html = v) }] : []
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rarr: '→', larr: '←', middot: '·', bull: '•', copy: '©', reg: '®', trade: '™', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m))
const encode = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Visible text segments of an HTML string (skips <style>/<script>), with their positions.
function textNodes(html) {
  const skip = []
  for (const m of html.matchAll(/<(style|script)\b[\s\S]*?<\/\1>/gi)) skip.push([m.index, m.index + m[0].length])
  const out = []
  for (const m of html.matchAll(/>([^<>]+)</g)) {
    const start = m.index + 1
    if (!m[1].trim() || skip.some(([a, b]) => start >= a && start < b)) continue
    out.push({ start, end: start + m[1].length, raw: m[1] })
  }
  return out
}

/** Editable bits: every text on the design + every picture placeholder. */
export function getEditable(item) {
  const dir = creativeDir(item)
  const { kind, spec } = loadSpec(dir)
  const texts = []
  const images = []
  parts(kind, spec).forEach((p, pi) => {
    const html = p.get()
    textNodes(html).forEach((n, ni) => texts.push({ id: `${pi}:${ni}`, part: p.label, text: decode(n.raw).trim() }))
    ;[...html.matchAll(/\{\{IMG:([^}]+)\}\}/g)].forEach((m, ii) => images.push({ id: `${pi}:${ii}`, part: p.label, path: m[1].trim() }))
  })
  // Reels with a voiceover: the spoken lines, voice and delivery style (voice.json, made by make-voice.mjs).
  const vf = path.join(dir, 'voice.json')
  const voice = kind === 'reel' && fs.existsSync(vf) ? JSON.parse(fs.readFileSync(vf, 'utf8')) : null
  return { kind, texts, images, voice: voice && { voice: voice.voice ?? 'ash', style: voice.style ?? '', lines: (voice.lines ?? []).map((l) => ({ t: l.t, text: l.text })) } }
}

function runScript(name, arg) {
  return new Promise((resolve, reject) =>
    execFile(process.execPath, [path.join(ROOT, 'engine/scripts', name), arg], { cwd: ROOT, env: process.env, timeout: 120_000 }, (err, stdout, stderr) =>
      err ? reject(new Error(`${name} failed: ` + (stderr || err.message).slice(0, 400))) : resolve(stdout),
    ),
  )
}

function render(kind, file) {
  const script = path.join(ROOT, 'engine/scripts', kind === 'reel' ? 'render-reel.mjs' : 'render-post.mjs')
  return new Promise((resolve, reject) =>
    execFile(process.execPath, [script, path.relative(ROOT, file)], { cwd: ROOT, env: process.env, timeout: 15 * 60_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? reject(new Error('Re-render failed: ' + (stderr || err.message).slice(0, 400))) : resolve(stdout),
    ),
  )
}

/** Apply text/picture edits to the spec and re-render. Returns the (same) file list. */
export async function applyEdits(item, { texts = [], images = [], voice }) {
  const dir = creativeDir(item)
  const { file, kind, spec } = loadSpec(dir)
  const ps = parts(kind, spec)
  ps.forEach((p, pi) => {
    let html = p.get()
    // Replace from the end so earlier positions stay valid.
    const nodes = textNodes(html)
    for (let ni = nodes.length - 1; ni >= 0; ni--) {
      const e = texts.find((t) => t.id === `${pi}:${ni}`)
      if (!e) continue
      const n = nodes[ni]
      const lead = n.raw.match(/^\s*/)[0]
      const trail = n.raw.match(/\s*$/)[0]
      html = html.slice(0, n.start) + lead + encode(String(e.text)) + trail + html.slice(n.end)
    }
    let ii = 0
    html = html.replace(/\{\{IMG:([^}]+)\}\}/g, (m) => {
      const e = images.find((x) => x.id === `${pi}:${ii++}`)
      return e && /^engine\/(uploads|out)\/[\w./-]+$/.test(e.path) && !e.path.includes('..') ? `{{IMG:${e.path}}}` : m
    })
    p.set(html)
  })
  // Voiceover edits: rewrite voice.json, re-record with OpenAI, then the reel re-renders with the new voice.
  if (voice && kind === 'reel') {
    const vf = path.join(dir, 'voice.json')
    const cur = fs.existsSync(vf) ? JSON.parse(fs.readFileSync(vf, 'utf8')) : { lines: [] }
    const next = {
      ...cur,
      ...(voice.voice ? { voice: voice.voice } : {}),
      ...(voice.style !== undefined ? { style: voice.style } : {}),
      lines: Array.isArray(voice.lines) ? voice.lines.filter((l) => String(l.text ?? '').trim()).map((l) => ({ t: Number(l.t) || 0, text: String(l.text).trim() })) : cur.lines,
    }
    fs.writeFileSync(vf, JSON.stringify(next, null, 2))
    const timing = JSON.parse(await runScript('make-voice.mjs', path.relative(ROOT, vf)))
    // Make sure the reel is long enough for the (possibly longer) voice, and uses it.
    spec.voiceover = true
    spec.duration = Math.max(Number(spec.duration) || 0, Math.ceil(timing.seconds + 0.8))
  }
  fs.writeFileSync(file, JSON.stringify(spec, null, 2))
  await render(kind, file)
  return item.result.files
}
