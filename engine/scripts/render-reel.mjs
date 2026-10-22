#!/usr/bin/env node
// Usage: node engine/scripts/render-reel.mjs engine/out/<slug>/reel.json
// Renders a custom motion-graphics reel to engine/out/<slug>/reel.mp4 (1080×1920, 30 fps, H.264).
//
// reel.json: { "duration": 12, "fps"?: 30, "fonts"?: ["Space Grotesk"], "html": "<div>…</div>", "script": "…" }
//   html   — the stage markup. {{LOGO}} → clean brand logo, {{IMG:engine/uploads/x.jpg}} → that image.
//   script — JS that builds a paused GSAP timeline: `window.tl = gsap.timeline({ paused: true }); tl.from(...)`
// Every frame is rendered by tl.seek(t) + screenshot, then ffmpeg encodes the frames. Needs ffmpeg on PATH.
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logoDataUri } from './logo.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const specPath = process.argv[2]
if (!specPath) {
  console.error('Usage: render-reel.mjs <reel.json>')
  process.exit(1)
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'))
const style = JSON.parse(fs.readFileSync(path.join(here, '../brand/style.json'), 'utf8'))
const c = { ...style.colors, ...(spec.colors ?? {}) }
const fps = spec.fps ?? 30
const LOGO_H = { small: 90, medium: 120, large: 160 }[spec.logoSize ?? style.logoSize ?? 'large'] ?? 160
const duration = Math.min(Math.max(Number(spec.duration) || 12, 3), 90)
const outDir = path.dirname(specPath)

const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
const img = (p) => {
  const f = path.isAbsolute(p) ? p : path.resolve(here, '../..', p)
  return fs.existsSync(f) ? `data:${mime[path.extname(f).toLowerCase()] ?? 'image/png'};base64,${fs.readFileSync(f).toString('base64')}` : ''
}
const logo = await logoDataUri(spec.logo ?? style.logo)
const fill = (s) => String(s ?? '').replaceAll('{{LOGO}}', logo).replace(/\{\{IMG:([^}]+)\}\}/g, (_, p) => img(p.trim()))
const fonts = (spec.fonts ?? []).map((f) => `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />`).join('')
const html = fs
  .readFileSync(path.join(here, '../templates/reel.html'), 'utf8')
  .replace('{{HEAD}}', fonts)
  .replace('{{LOGOH}}', LOGO_H)
  .replace('{{PRIMARY}}', c.primary)
  .replace('{{SECONDARY}}', c.secondary)
  .replace('{{ACCENT}}', c.accent)
  .replace('{{BG}}', c.bg)
  .replace('{{BODY}}', () => fill(spec.html))
  .replace('{{SCRIPT}}', () => fill(spec.script))

const framesDir = path.join(outDir, 'frames')
fs.rmSync(framesDir, { recursive: true, force: true })
fs.mkdirSync(framesDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.setContent(html, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
const ok = await page.evaluate(() => !!(window.tl && typeof window.tl.seek === 'function'))
if (!ok) {
  await browser.close()
  console.error('Reel script must set window.tl to a paused GSAP timeline.' + (errors.length ? '\nPage errors: ' + errors.join(' | ') : ''))
  process.exit(1)
}
const total = Math.round(duration * fps)
for (let f = 0; f < total; f++) {
  await page.evaluate((t) => void window.tl.seek(t, false), f / fps)
  await page.screenshot({ path: path.join(framesDir, `f_${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
}
// A poster frame (~1.5s in) for previews and the Instagram cover.
await page.evaluate((t) => void window.tl.seek(t, false), Math.min(1.5, duration / 2))
await page.screenshot({ path: path.join(outDir, 'cover.jpg'), type: 'jpeg', quality: 92 })
await browser.close()

// Original music bed: spec.music is a score for make-music.mjs (omit or set false for a silent reel).
let music = null
if (spec.music) {
  const scoreFile = path.join(outDir, 'music.score.json')
  fs.writeFileSync(scoreFile, JSON.stringify({ ...spec.music, duration }, null, 2))
  music = path.join(outDir, 'music.wav')
  execFileSync(process.execPath, [path.join(here, 'make-music.mjs'), scoreFile, music])
}

// Voiceover: spec.voiceover → voice.wav made earlier by make-voice.mjs (so the animation could be timed to it).
const voiceFile = path.join(outDir, 'voice.wav')
const voice = spec.voiceover && fs.existsSync(voiceFile) ? voiceFile : null
if (spec.voiceover && !voice) console.error('voiceover requested but voice.wav is missing — run make-voice.mjs first; rendering without voice')

const out = path.join(outDir, 'reel.mp4')
const args = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(framesDir, 'f_%05d.jpg')]
const vo = (i) => `[${i}:a]aresample=44100,aformat=channel_layouts=stereo,volume=1.8` // TTS comes in quieter than the music bed
if (music && voice) {
  // Music ducks under the voice (sidechain), then both are mixed and limited.
  args.push('-i', music, '-i', voice, '-filter_complex',
    `${vo(2)},apad,asplit=2[v1][v2];[1:a][v1]sidechaincompress=threshold=0.02:ratio=12:attack=10:release=400[m];[m][v2]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]`,
    '-map', '0:v', '-map', '[a]')
} else if (voice) {
  args.push('-i', voice, '-filter_complex', `${vo(1)},apad[a]`, '-map', '0:v', '-map', '[a]')
} else if (music) {
  args.push('-i', music)
}
if (music || voice) args.push('-c:a', 'aac', '-b:a', '192k')
args.push('-t', String(duration), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', out)
execFileSync('ffmpeg', args)
fs.rmSync(framesDir, { recursive: true, force: true })
console.log(JSON.stringify({ files: [out, path.join(outDir, "cover.jpg")], frames: total, music: !!music, voiceover: !!voice, errors }))
