#!/usr/bin/env node
// Usage: node engine/scripts/make-music.mjs <score.json> <out.wav>
// A tiny synthesizer: turns a score Claude writes into an original, royalty-free music bed for a reel.
//
// score: {
//   "duration": 12,                 // seconds (match the reel)
//   "bpm": 120, "key": "A minor",   // key is informational; chords define the harmony
//   "style": "house" | "trap" | "lofi" | "cinematic" | "pop" | "ambient",   // sets default patterns + sounds
//   "chords": ["Am", "F", "C", "G"], // one per bar, loops. Supports C, Cm, C7, Cmaj7, Cm7, Csus2, Csus4, Cdim, C#m, Bb…
//   "drums"?: { "kick": "x...x...x...x...", "snare": "....x.......x...", "hat": "..x...x...x...x.", "clap": "" },  // 16 steps/bar
//   "layers"?: { "pad": true, "bass": true, "arp": true, "drums": true, "lead": false },
//   "intro"?: 1,                    // bars with drums muted at the start (build-up)
//   "hits"?: [1.5, 4.0, 9.5],       // seconds: impact + riser lands here (sync to scene cuts)
//   "energy"?: 0.8                  // 0–1 overall intensity
// }
import fs from 'node:fs'

const [scorePath, outPath] = process.argv.slice(2)
if (!scorePath || !outPath) {
  console.error('Usage: make-music.mjs <score.json> <out.wav>')
  process.exit(1)
}
const score = JSON.parse(fs.readFileSync(scorePath, 'utf8'))
const SR = 44100
const dur = Math.min(Math.max(Number(score.duration) || 12, 2), 90)
const N = Math.ceil(dur * SR)
const bpm = Math.min(Math.max(Number(score.bpm) || 120, 60), 180)
const beat = 60 / bpm
const step = beat / 4
const bar = beat * 4
const energy = Math.min(Math.max(score.energy ?? 0.8, 0), 1)

const STYLES = {
  house: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', clap: '....x.......x...', bass: 'offbeat', arp: true, pad: true, swing: 0 },
  trap: { kick: 'x.......x.x.....', snare: '........x.......', hat: 'x.x.x.x.xxx.x.xx', clap: '', bass: 'kick', arp: false, pad: true, swing: 0 },
  lofi: { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', clap: '', bass: 'roots', arp: false, pad: true, swing: 0.12 },
  pop: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', clap: '', bass: 'eighths', arp: true, pad: true, swing: 0 },
  cinematic: { kick: 'x.......x.......', snare: '............x...', hat: '', clap: '', bass: 'roots', arp: true, pad: true, swing: 0 },
  ambient: { kick: '', snare: '', hat: '', clap: '', bass: 'roots', arp: true, pad: true, swing: 0 },
}
const st = STYLES[score.style] ?? STYLES.house
const drums = { kick: st.kick, snare: st.snare, hat: st.hat, clap: st.clap, ...(score.drums ?? {}) }
const layers = { pad: st.pad, bass: true, arp: st.arp, drums: true, lead: false, ...(score.layers ?? {}) }
const introBars = score.intro ?? 0

// ---------- harmony ----------
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14] }
function chord(name) {
  const m = String(name).match(/^([A-G][#b]?)(.*)$/)
  const root = NOTE[m?.[1]] ?? 9
  const ints = QUAL[m?.[2] ?? ''] ?? QUAL[m?.[2]?.startsWith('m') ? 'm' : '']
  return { root, notes: ints.map((i) => root + i) }
}
const chords = (score.chords?.length ? score.chords : ['Am', 'F', 'C', 'G']).map(chord)
const chordAt = (t) => chords[Math.floor(t / bar) % chords.length]
const hz = (semi, octave) => 440 * 2 ** ((semi - 9) / 12 + (octave - 4))

// ---------- buffers ----------
const L = new Float32Array(N)
const R = new Float32Array(N)
const send = new Float32Array(N) // reverb send (mono)
const duck = new Float32Array(N).fill(1) // sidechain from kick
const add = (i, v, pan = 0, rev = 0) => {
  if (i < 0 || i >= N) return
  L[i] += v * (1 - Math.max(pan, 0))
  R[i] += v * (1 + Math.min(pan, 0))
  if (rev) send[i] += v * rev
}
let seed = 12345
const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5))
const tri = (ph) => 4 * Math.abs(ph - Math.floor(ph + 0.5)) - 1

// ---------- drums ----------
function kick(t0, amp = 1) {
  const s = Math.floor(t0 * SR)
  let ph = 0
  for (let i = 0; i < SR * 0.45; i++) {
    const t = i / SR
    const f = 45 + 110 * Math.exp(-t * 28)
    ph += f / SR
    const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7) * 0.9 * amp + (i < 200 ? noise() * 0.15 * amp : 0)
    add(s + i, v)
  }
  for (let i = 0; i < SR * 0.3 && s + i < N; i++) if (s + i >= 0) duck[s + i] = Math.min(duck[s + i], 0.35 + 0.65 * (i / (SR * 0.3)) ** 0.6)
}
function snare(t0, amp = 1, clap = false) {
  const s = Math.floor(t0 * SR)
  let lp = 0
  for (let i = 0; i < SR * 0.3; i++) {
    const t = i / SR
    const n = noise()
    lp += 0.45 * (n - lp)
    const body = clap ? 0 : Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 30) * 0.4
    const burst = clap ? (t < 0.03 ? (Math.floor(t * 100) % 1 === 0 ? 1 : 0.6) : 1) : 1
    add(s + i, ((n - lp) * Math.exp(-t * (clap ? 14 : 18)) * 0.55 * burst + body) * amp, clap ? 0.15 : -0.05, 0.25)
  }
}
function hat(t0, amp = 1, pan = 0.25) {
  const s = Math.floor(t0 * SR)
  let prev = 0
  for (let i = 0; i < SR * 0.06; i++) {
    const n = noise()
    const hp = n - prev
    prev = n
    add(s + i, hp * Math.exp(-(i / SR) * 70) * 0.18 * amp, pan)
  }
}

// ---------- tonal voices ----------
function padChord(t0, len, c) {
  const s = Math.floor(t0 * SR)
  const n = Math.floor(len * SR)
  const voices = c.notes.slice(0, 4).flatMap((semi) => [-0.08, 0.08].map((det) => ({ f: hz(semi, 3) * 2 ** (det / 12), ph: Math.random() })))
  let lpL = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const env = Math.min(1, t / 0.25) * Math.min(1, (len - t) / 0.3)
    let v = 0
    for (const o of voices) {
      o.ph += o.f / SR
      v += saw(o.ph)
    }
    lpL += 0.06 * (v / voices.length - lpL) // warm low-pass
    add(s + i, lpL * env * 0.32, 0, 0.5)
  }
}
function bassNote(t0, len, semi) {
  const s = Math.floor(t0 * SR)
  const f = hz(semi, 2)
  let ph = 0
  let lp = 0
  for (let i = 0; i < len * SR; i++) {
    const t = i / SR
    ph += f / SR
    const raw = Math.sin(2 * Math.PI * ph) * 0.8 + saw(ph) * 0.35
    lp += 0.12 * (raw - lp)
    const env = Math.min(1, t / 0.005) * Math.exp(-t * 2.5) * Math.min(1, (len - t) / 0.02)
    add(s + i, lp * env * 0.55)
  }
}
function pluck(t0, semi, octave, amp, pan) {
  const s = Math.floor(t0 * SR)
  const f = hz(semi, octave)
  let ph = 0
  for (let i = 0; i < SR * 0.35; i++) {
    const t = i / SR
    ph += f / SR
    add(s + i, (tri(ph) * 0.7 + Math.sin(2 * Math.PI * ph * 2) * 0.2) * Math.exp(-t * 9) * amp, pan, 0.35)
  }
}
function impact(t0) {
  // riser into the hit, then a sub boom
  const rs = Math.floor((t0 - 1.2) * SR)
  let lp = 0
  for (let i = 0; i < SR * 1.2; i++) {
    const t = i / (SR * 1.2)
    lp += (0.02 + t * 0.5) * (noise() - lp)
    add(rs + i, lp * t * t * 0.35 * energy, 0, 0.3)
  }
  const s = Math.floor(t0 * SR)
  let ph = 0
  for (let i = 0; i < SR * 1.0; i++) {
    const t = i / SR
    ph += (40 + 60 * Math.exp(-t * 10)) / SR
    add(s + i, Math.sin(2 * Math.PI * ph) * Math.exp(-t * 3) * 0.7 * energy)
  }
}

// ---------- arrange ----------
const steps = Math.ceil(dur / step)
const swing = (k) => (k % 2 === 1 ? st.swing * step : 0)
for (let k = 0; k < steps; k++) {
  const t = k * step + swing(k)
  const barIdx = Math.floor((k * step) / bar)
  const si = k % 16
  const c = chordAt(k * step)
  const drumsOn = layers.drums && barIdx >= introBars
  if (drumsOn) {
    if (drums.kick?.[si] === 'x') kick(t, 0.9 + 0.1 * energy)
    if (drums.snare?.[si] === 'x') snare(t, 0.8)
    if (drums.clap?.[si] === 'x') snare(t, 0.6, true)
    if (drums.hat?.[si] === 'x') hat(t, si % 4 === 2 ? 1 : 0.6, si % 2 ? 0.3 : -0.2)
  }
  if (si === 0 && layers.pad) padChord(k * step, Math.min(bar, dur - k * step), c)
  if (layers.bass && barIdx >= introBars) {
    const mode = st.bass
    const root = c.root
    if (mode === 'offbeat' && si % 4 === 2) bassNote(t, step * 1.6, root)
    else if (mode === 'eighths' && si % 2 === 0) bassNote(t, step * 1.8, si % 8 === 6 ? root + 7 : root)
    else if (mode === 'kick' && drums.kick?.[si] === 'x') bassNote(t, step * 3.5, root)
    else if (mode === 'roots' && si % 8 === 0) bassNote(t, beat * 1.9, root)
  }
  if (layers.arp && si % 2 === 0) {
    const tones = c.notes
    const n = tones[(k / 2) % tones.length | 0]
    pluck(t, n, 5, 0.16 + 0.06 * energy, (k / 2) % 2 ? 0.45 : -0.45)
  }
  if (layers.lead && si % 4 === 0 && barIdx % 2 === 1) pluck(t, c.notes[(si / 4) % c.notes.length] + 12, 5, 0.22, 0)
}
for (const h of score.hits ?? []) if (h > 0.3 && h < dur) impact(h)

// ---------- sidechain, reverb, master ----------
for (let i = 0; i < N; i++) {
  // pads/arps/bass are ducked by the kick; drums are added separately so ducking the whole mix lightly is fine
  L[i] *= 0.55 + 0.45 * duck[i]
  R[i] *= 0.55 + 0.45 * duck[i]
}
// Schroeder-style reverb on the send
const combs = [1557, 1617, 1491, 1422].map((d) => ({ d, buf: new Float32Array(d), i: 0 }))
const aps = [225, 556].map((d) => ({ d, buf: new Float32Array(d), i: 0 }))
for (let i = 0; i < N; i++) {
  let x = send[i] * 0.25
  let y = 0
  for (const c of combs) {
    const out = c.buf[c.i]
    c.buf[c.i] = x + out * 0.82
    c.i = (c.i + 1) % c.d
    y += out
  }
  for (const a of aps) {
    const out = a.buf[a.i]
    const v = -y + out
    a.buf[a.i] = y + out * 0.5
    a.i = (a.i + 1) % a.d
    y = v
  }
  L[i] += y * 0.35
  R[i] += y * 0.33
}
let peak = 1e-9
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 1.2)
  R[i] = Math.tanh(R[i] * 1.2)
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
}
const gain = 0.89 / peak // ≈ -1 dBFS
const fadeIn = SR * 0.03
const fadeOut = SR * Math.min(1.5, dur / 4)
const buf = Buffer.alloc(44 + N * 4)
buf.write('RIFF', 0)
buf.writeUInt32LE(36 + N * 4, 4)
buf.write('WAVEfmt ', 8)
buf.writeUInt32LE(16, 16)
buf.writeUInt16LE(1, 20)
buf.writeUInt16LE(2, 22)
buf.writeUInt32LE(SR, 24)
buf.writeUInt32LE(SR * 4, 28)
buf.writeUInt16LE(4, 32)
buf.writeUInt16LE(16, 34)
buf.write('data', 36)
buf.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) {
  const env = Math.min(1, i / fadeIn) * Math.min(1, (N - i) / fadeOut)
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain * env)) * 32767), 44 + i * 4)
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain * env)) * 32767), 46 + i * 4)
}
fs.writeFileSync(outPath, buf)
console.log(JSON.stringify({ wav: outPath, seconds: dur, bpm, style: score.style ?? 'house' }))
