#!/usr/bin/env node
// Usage: node engine/scripts/make-voice.mjs engine/out/<slug>/voice.json
// Voiceover for a reel with OpenAI text-to-speech. Writes voice.wav next to the json and prints the real timing of
// every line, so the animation can be synced to the voice. Needs OPENAI_API_KEY.
//
// voice.json: {
//   "voice": "ash",                       // alloy ash ballad coral echo fable nova onyx sage shimmer verse
//   "style": "Warm, confident, friendly. Indian English accent. Medium pace.",   // delivery instructions
//   "lines": [{ "t": 0.3, "text": "It's 11:47 PM." }, { "t": 2.5, "text": "A customer messages you…" }]
// }
// Lines start at `t` seconds; if a line would overlap the previous one it is pushed later (reported in the output).
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2]
if (!file) {
  console.error('Usage: make-voice.mjs <voice.json>')
  process.exit(1)
}
const key = process.env.OPENAI_API_KEY?.trim()
if (!key) {
  console.error('Voiceover needs OPENAI_API_KEY — make the reel without voice.')
  process.exit(1)
}
const spec = JSON.parse(fs.readFileSync(file, 'utf8'))
const model = process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts'
const voice = spec.voice ?? process.env.OPENAI_TTS_VOICE ?? 'ash'
const SR = 24000 // OpenAI "pcm" output: 24 kHz, 16-bit signed little-endian, mono

async function speak(text) {
  const body = { model, voice, input: text, response_format: 'pcm' }
  if (spec.style && model.startsWith('gpt-4o')) body.instructions = spec.style
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw new Error(`TTS failed (${r.status}): ${String(j.error?.message ?? '').replace(/sk-[\w*.-]+/g, 'sk-…')}`)
  }
  const buf = Buffer.from(await r.arrayBuffer())
  const pcm = new Float32Array(Math.floor(buf.length / 2))
  for (let i = 0; i < pcm.length; i++) pcm[i] = buf.readInt16LE(i * 2) / 32768
  // Trim leading/trailing silence so `t` is when the words actually start.
  let a = 0
  let b = pcm.length - 1
  while (a < b && Math.abs(pcm[a]) < 0.01) a++
  while (b > a && Math.abs(pcm[b]) < 0.01) b--
  return pcm.subarray(Math.max(0, a - SR * 0.02), Math.min(pcm.length, b + SR * 0.08))
}

const lines = (spec.lines ?? []).filter((l) => l.text?.trim())
if (!lines.length) {
  console.error('voice.json has no lines')
  process.exit(1)
}
// Generate all lines in parallel (each is a short request).
const clips = await Promise.all(lines.map((l) => speak(l.text.trim())))
const timing = []
let cursor = 0
for (const [i, l] of lines.entries()) {
  const want = Math.max(0, Number(l.t) || 0)
  const start = Math.max(want, cursor)
  const dur = clips[i].length / SR
  timing.push({ t: +start.toFixed(2), end: +(start + dur).toFixed(2), seconds: +dur.toFixed(2), text: l.text, ...(start > want + 0.01 ? { shiftedBy: +(start - want).toFixed(2) } : {}) })
  cursor = start + dur + 0.15
}
const total = Math.ceil((timing.at(-1).end + 0.3) * SR)
const mix = new Float32Array(total)
timing.forEach((t, i) => mix.set(clips[i], Math.round(t.t * SR)))

const out = path.join(path.dirname(file), 'voice.wav')
const wav = Buffer.alloc(44 + total * 2)
wav.write('RIFF', 0)
wav.writeUInt32LE(36 + total * 2, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(SR, 24)
wav.writeUInt32LE(SR * 2, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(total * 2, 40)
for (let i = 0; i < total; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767), 44 + i * 2)
fs.writeFileSync(out, wav)
console.log(JSON.stringify({ voice: out.replace(/\\/g, '/'), seconds: +(total / SR).toFixed(2), lines: timing }, null, 1))
