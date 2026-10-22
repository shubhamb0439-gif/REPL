#!/usr/bin/env node
// Usage: node engine/scripts/render-post.mjs engine/out/<slug>/spec.json
// Renders a post (1080×1350) or carousel slides to PNG next to the spec.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logoDataUri } from './logo.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const specPath = process.argv[2]
if (!specPath) {
  console.error('Usage: render-post.mjs <spec.json>')
  process.exit(1)
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'))
const style = JSON.parse(fs.readFileSync(path.join(here, '../brand/style.json'), 'utf8'))
const brandName = spec.brandName ?? (fs.readFileSync(path.join(here, '../brand/brand.md'), 'utf8').match(/^# Brand Brain — (.+)$/m)?.[1] ?? 'Brand')
const handle = spec.handle ?? '@handle'
const c = { ...style.colors, ...(spec.colors ?? {}) }
const [W, H] = style.sizes.post
const esc = (s = '') => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m])
// Uploaded images (e.g. engine/uploads/123-photo.jpg) are inlined as data URIs so the page needs no file access.
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' }
const img = (p) => {
  if (!p) return ''
  const f = path.isAbsolute(p) ? p : path.resolve(here, '../..', p)
  if (!fs.existsSync(f)) {
    console.error(`image not found: ${p}`)
    return ''
  }
  return `data:${mime[path.extname(f).toLowerCase()] ?? 'image/png'};base64,${fs.readFileSync(f).toString('base64')}`
}
// Full-bleed photo with a dark gradient so text on top stays readable.
const photoBg = (src, shade = 0.75) =>
  src ? `<div style="position:absolute;inset:0;background:url('${src}') center/cover"></div><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,${shade * 0.4}) 0%,rgba(0,0,0,${shade}) 100%)"></div>` : ''

const rings = (color, css) =>
  `<svg class="rings" style="${css}" viewBox="0 0 200 200">${[30, 55, 80, 100]
    .map((r, i) => `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${color}" stroke-opacity="${0.5 - i * 0.1}" stroke-width="1.2"/>`)
    .join('')}</svg>`
// Uploaded logo (Brand Brain → style.json "logo") replaces the dot + name wordmark.
const logo = await logoDataUri(spec.logo ?? style.logo) // background removed + cropped
// Logo height on a 1080px-wide post, from Brand Brain → Logo size (wide wordmarks need the bigger sizes).
const LOGO_H = { small: 72, medium: 100, large: 132 }[spec.logoSize ?? style.logoSize ?? 'large'] ?? 132
const brand = logo
  ? `<div class="brand"><img class="logo" src="${logo}" alt="" /></div>`
  : `<div class="brand"><span class="dot"></span>${esc(brandName)}</div>`

const layouts = {
  bold: (s) => `<div class="frame" style="background:${c.primary};padding:80px;display:flex;flex-direction:column;justify-content:space-between;color:${c.bg}">
    ${rings(c.bg, 'right:-380px;bottom:-380px;width:900px;height:900px')}
    ${logo ? `<div style="position:relative">${brand}</div>` : `<div class="brand" style="color:${c.bg}">${esc(brandName)}</div>`}
    <h1 class="display" style="font-size:96px;line-height:.95;font-weight:900;text-transform:uppercase;position:relative">${esc(s.headline)}</h1>
    <p style="font-size:36px;font-weight:600;max-width:75%;opacity:.8;position:relative">${esc(s.sub)}</p></div>`,
  photo: (s) => `<div class="frame" style="padding:80px;display:flex;flex-direction:column;justify-content:space-between">
    ${photoBg(img(s.image))}
    <div style="position:relative">${brand}</div>
    <div style="position:relative">
      <h1 class="display" style="font-size:84px;line-height:1.02;font-weight:900">${esc(s.headline)}</h1>
      <p style="font-size:36px;margin-top:32px;opacity:.85">${esc(s.sub)}</p>
      <span class="pill" style="margin-top:44px;background:${c.primary};color:${c.bg}">${esc(s.cta)}</span></div></div>`,
  split: (s) => `<div class="frame" style="display:grid;grid-template-rows:1.3fr 1fr">
    <div style="position:relative;overflow:hidden;padding:80px;background:linear-gradient(135deg,${c.secondary},${c.bg})">
      ${s.image ? photoBg(img(s.image), 0.55) : rings(c.primary, 'right:-180px;top:-180px;width:720px;height:720px')}<div style="position:relative">${brand}</div>
      <h1 class="display" style="margin-top:70px;font-size:80px;line-height:1.02;font-weight:900;position:relative">${esc(s.headline)}</h1></div>
    <div style="padding:80px;display:flex;flex-direction:column;justify-content:space-between">
      <p style="font-size:40px;line-height:1.3;opacity:.75">${esc(s.sub)}</p>
      <span class="pill" style="background:${c.primary};color:${c.bg};align-self:flex-start">${esc(s.cta)}</span></div></div>`,
  minimal: (s) => `<div class="frame" style="padding:90px;display:flex;flex-direction:column;justify-content:space-between">
    ${brand}
    <div><div style="width:140px;height:10px;border-radius:6px;background:linear-gradient(90deg,${c.primary},${c.accent});margin-bottom:44px"></div>
    <h1 class="display" style="font-size:86px;line-height:1.05;font-weight:800">${esc(s.headline)}</h1>
    <p style="font-size:38px;margin-top:40px;opacity:.6">${esc(s.sub)}</p></div>
    <div style="display:flex;justify-content:space-between;font-size:30px"><b style="color:${c.primary}">${esc(s.cta)}</b><span style="opacity:.4">${esc(handle)}</span></div></div>`,
  festive: (s) => `<div class="frame" style="background:radial-gradient(circle at 50% 35%,#3b1d00 0%,${c.bg} 70%);display:flex;align-items:center;justify-content:center;text-align:center;padding:90px">
    ${rings('#FFB547', 'left:50%;top:30%;width:1000px;height:1000px;transform:translate(-50%,-50%)')}
    ${Array.from({ length: 30 }, (_, i) => `<span style="position:absolute;left:${(i * 37) % 100}%;top:${(i * 53) % 100}%;width:6px;height:6px;border-radius:50%;background:#FFD27A;box-shadow:0 0 16px #FFB547;opacity:${0.3 + ((i * 7) % 10) / 15}"></span>`).join('')}
    <div style="position:relative"><div style="width:110px;height:110px;margin:0 auto 50px;border-radius:50%;background:radial-gradient(circle,#FFE08A,#FF8A00 60%,transparent 70%);box-shadow:0 0 120px #FF8A00"></div>
    <h1 class="display" style="font-size:100px;font-weight:900;color:#FDE68A;line-height:1">${esc(s.headline)}</h1>
    <p style="font-size:38px;margin:44px auto 0;max-width:85%;opacity:.75">${esc(s.sub)}</p>
    <div style="margin-top:60px;display:flex;justify-content:center">${brand}</div></div></div>`,
}

const slideHtml = (slide, i, n) => `<div class="frame" style="padding:90px;display:flex;flex-direction:column;justify-content:space-between;${i === 0 ? `background:linear-gradient(150deg,${c.secondary},${c.bg} 70%)` : ''}">
  ${photoBg(img(slide.image))}
  <div style="position:relative;display:flex;justify-content:space-between;align-items:center">${brand}<span style="font-size:28px;opacity:.4">${i + 1}/${n}</span></div>
  <div style="position:relative">${i ? `<div style="font-size:30px;color:${c.primary};margin-bottom:24px">0${i}</div>` : ''}
  <h1 class="display" style="font-size:${i ? 72 : 92}px;line-height:1.02;font-weight:900">${esc(slide.title)}</h1>
  <p style="font-size:40px;margin-top:40px;opacity:.65">${esc(slide.body)}</p></div>
  <div style="position:relative;display:flex;gap:10px">${Array.from({ length: n }, (_, j) => `<span style="flex:1;height:8px;border-radius:6px;background:${j <= i ? c.primary : 'rgba(255,255,255,.12)'}"></span>`).join('')}</div></div>`

// Custom designs: spec.html (post) or slides[i].html — Claude's own HTML/CSS for that creative.
// Placeholders: {{LOGO}} → clean logo data URI, {{IMG:engine/uploads/x.jpg}} → image data URI.
const custom = (html) => String(html).replaceAll('{{LOGO}}', logo).replace(/{{IMG:([^}]+)}}/g, (_, p) => img(p.trim()))
const fonts = (spec.fonts ?? []).map((f) => `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />`).join('')

const tpl = fs.readFileSync(path.join(here, '../templates/post.html'), 'utf8')
const page = (body) =>
  tpl.replace('{{HEAD}}', fonts).replace('{{LOGOH}}', LOGO_H).replaceAll('{{W}}', W).replaceAll('{{H}}', H).replace('{{PRIMARY}}', c.primary).replace('{{SECONDARY}}', c.secondary).replace('{{ACCENT}}', c.accent).replace('{{BG}}', c.bg).replace('{{BODY}}', body)

const outDir = path.dirname(specPath)
const browser = await chromium.launch()
const p = await browser.newPage({ viewport: { width: W, height: H } })
const files = []
const shot = async (html, name) => {
  await p.setContent(page(html), { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready)
  const f = path.join(outDir, name)
  await p.screenshot({ path: f })
  files.push(f)
}
if (spec.format === 'carousel' && spec.slides?.length) {
  for (const [i, s] of spec.slides.entries())
    await shot(s.html ? `<div class="frame">${custom(s.html)}</div>` : slideHtml(s, i, spec.slides.length), `slide-${i + 1}.png`)
} else {
  await shot(spec.html ? `<div class="frame">${custom(spec.html)}</div>` : (layouts[spec.layout] ?? layouts.bold)(spec), 'post.png')
}
await browser.close()
console.log(JSON.stringify({ files }))
