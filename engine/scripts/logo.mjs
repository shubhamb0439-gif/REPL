#!/usr/bin/env node
// Usage: node engine/scripts/logo.mjs [logo path]   (default: style.json → logo)
// Makes an uploaded logo usable on any background: removes a solid background colour (e.g. "logo on black"),
// crops the empty margin, and saves engine/brand/logo-clean.png. Prints the clean path.
// Also exported as cleanLogo() for the renderers. Cached: re-runs only when the source logo changes.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '../..')
const OUT = path.join(ROOT, 'engine/brand/logo-clean.png')
const META = OUT + '.json'

export async function cleanLogo(src) {
  if (!src) return null
  const file = path.isAbsolute(src) ? src : path.join(ROOT, src)
  if (!fs.existsSync(file)) return null
  const key = `${file}:${fs.statSync(file).mtimeMs}`
  try {
    if (fs.existsSync(OUT) && JSON.parse(fs.readFileSync(META, 'utf8')).key === key) return OUT
  } catch {
    /* rebuild */
  }
  const ext = path.extname(file).toLowerCase()
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[ext] ?? 'image/png'
  const dataUri = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`

  const browser = await chromium.launch()
  const page = await browser.newPage()
  const png = await page.evaluate(async (uri) => {
    const img = new Image()
    img.src = uri
    await img.decode()
    const w = img.naturalWidth || 1200
    const h = img.naturalHeight || 600
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)
    const d = ctx.getImageData(0, 0, w, h)
    const px = d.data
    // Background = the colour shared by the four corners (only if they agree and are opaque).
    const at = (x, y) => (y * w + x) * 4
    const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)].map((i) => [px[i], px[i + 1], px[i + 2], px[i + 3]])
    const close = (a, b, t) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= t
    const bg = corners.every((k) => k[3] > 250 && close(k, corners[0], 30)) ? corners[0] : null
    if (bg) {
      for (let i = 0; i < px.length; i += 4) {
        const dist = Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2])
        if (dist < 40) px[i + 3] = 0
        else if (dist < 120) px[i + 3] = Math.round((px[i + 3] * (dist - 40)) / 80) // soft edge, no halo
      }
      ctx.putImageData(d, 0, 0)
    }
    // Crop to visible pixels.
    let x0 = w, y0 = h, x1 = 0, y1 = 0
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (px[at(x, y) + 3] > 10) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    if (x1 <= x0 || y1 <= y0) return c.toDataURL('image/png')
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02)
    const cw = x1 - x0 + 1 + pad * 2
    const ch = y1 - y0 + 1 + pad * 2
    const o = document.createElement('canvas')
    o.width = cw
    o.height = ch
    o.getContext('2d').drawImage(c, x0 - pad, y0 - pad, cw, ch, 0, 0, cw, ch)
    return o.toDataURL('image/png')
  }, dataUri)
  await browser.close()
  fs.writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'))
  fs.writeFileSync(META, JSON.stringify({ key, source: src }))
  return OUT
}

/** Clean logo as a data URI (for HTML templates / Remotion props), or '' if there is no logo. */
export async function logoDataUri(src) {
  const f = await cleanLogo(src)
  return f ? `data:image/png;base64,${fs.readFileSync(f).toString('base64')}` : ''
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const style = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/brand/style.json'), 'utf8'))
  const out = await cleanLogo(process.argv[2] ?? style.logo)
  console.log(out ? path.relative(process.cwd(), out).replace(/\\/g, '/') : 'no logo set')
}
