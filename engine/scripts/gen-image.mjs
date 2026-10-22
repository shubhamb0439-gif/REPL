#!/usr/bin/env node
// Usage: node engine/scripts/gen-image.mjs --out engine/out/<slug>/hero.png [--size portrait|landscape|square] [--quality low|medium|high] "<prompt>"
//        node engine/scripts/gen-image.mjs --check      (exit 0 if AI images are configured)
// Generates ONE picture with OpenAI's image model for use inside a design (background / hero visual).
// The design itself — text and the real logo — is still done in HTML, so keep text and logos OUT of the prompt.
// Needs OPENAI_API_KEY (server/.env). Model/quality via OPENAI_IMAGE_MODEL / OPENAI_IMAGE_QUALITY.
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args.splice(i, 2)[1] : undefined
}
const key = process.env.OPENAI_API_KEY?.trim()
if (args.includes('--check')) {
  console.log(key ? 'AI images: configured' : 'AI images: not configured (no OPENAI_API_KEY)')
  process.exit(key ? 0 : 1)
}
const out = opt('out')
const size = { portrait: '1024x1536', landscape: '1536x1024', square: '1024x1024' }[opt('size') ?? 'portrait'] ?? '1024x1536'
const quality = opt('quality') ?? process.env.OPENAI_IMAGE_QUALITY ?? 'medium'
const prompt = args.join(' ').trim()
if (!key) {
  console.error('AI images are not configured (OPENAI_API_KEY missing) — design without a generated image.')
  process.exit(1)
}
if (!out || !prompt) {
  console.error('Usage: gen-image.mjs --out <path.png> [--size portrait|landscape|square] "<prompt>"')
  process.exit(1)
}
if (!path.resolve(out).startsWith(path.resolve('engine'))) {
  console.error('--out must be inside engine/')
  process.exit(1)
}

// Belt and braces: image models garble text and redraw logos, so always ask for none.
const full = `${prompt}\n\nNo text, no letters, no numbers, no words, no logos, no watermarks, no UI labels.`
const started = Date.now()
const r = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1', prompt: full, size, quality, n: 1 }),
  signal: AbortSignal.timeout(180_000),
}).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: e.message } }) }))
const j = await r.json().catch(() => ({}))
if (!r.ok) {
  const msg = String(j.error?.message ?? 'unknown error').replace(/sk-[\w*.-]+/g, 'sk-…') // never echo keys, even masked
  console.error(`Image generation failed (${r.status}): ${msg} — design without it.`)
  process.exit(1)
}
const b64 = j.data?.[0]?.b64_json
let bytes
if (b64) bytes = Buffer.from(b64, 'base64')
else if (j.data?.[0]?.url) bytes = Buffer.from(await (await fetch(j.data[0].url)).arrayBuffer())
else {
  console.error('Image generation returned no image — design without it.')
  process.exit(1)
}
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, bytes)
console.log(JSON.stringify({ image: out.replace(/\\/g, '/'), size, quality, seconds: Math.round((Date.now() - started) / 1000) }))
