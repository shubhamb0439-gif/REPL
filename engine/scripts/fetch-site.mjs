#!/usr/bin/env node
// Usage: node engine/scripts/fetch-site.mjs <url>
// Renders a website in a real browser (so JavaScript / React / 3D sites work), follows up to 4 key internal pages,
// and prints JSON: { pages: [{ url, title, description, text }], colors: [{ hex, count, where }] }.
// Used by /learn-brand — plain HTTP fetches only see an empty shell on modern JS sites.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const start = process.argv[2]
if (!/^https?:\/\//.test(start ?? '')) {
  console.error('Usage: fetch-site.mjs <https://…>')
  process.exit(1)
}
const origin = new URL(start).origin
const KEY = /about|service|product|solution|work|pricing|plan|feature|contact|team|story|portfolio|case/i

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' })

async function read(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(1500) // let client-side rendering / intro animations settle
  // Scroll through so lazy sections render.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 800) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  return page.evaluate(() => {
    const meta = (n) => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content ?? ''
    const text = (document.body?.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim()
    const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, label: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 60) }))
    // Colours actually used on prominent elements.
    const toHex = (c) => {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
      if (!m || (m[4] !== undefined && +m[4] < 0.5)) return null
      return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('')
    }
    const tally = {}
    const add = (c, where) => {
      const h = toHex(c)
      if (!h) return
      tally[h] ??= { hex: h, count: 0, where: new Set() }
      tally[h].count++
      tally[h].where.add(where)
    }
    add(getComputedStyle(document.body).backgroundColor, 'page background')
    document.querySelectorAll('h1,h2').forEach((e) => add(getComputedStyle(e).color, 'headings'))
    document.querySelectorAll('button,a[class*="btn"],a[class*="button"],[role="button"]').forEach((e) => {
      add(getComputedStyle(e).backgroundColor, 'buttons')
      add(getComputedStyle(e).color, 'button text')
    })
    document.querySelectorAll('section,header,footer,nav').forEach((e) => add(getComputedStyle(e).backgroundColor, 'sections'))
    document.querySelectorAll('a').forEach((e) => add(getComputedStyle(e).color, 'links'))
    const colors = Object.values(tally).map((x) => ({ ...x, where: [...x.where] }))
    return { url: location.href, title: document.title, description: meta('description') || meta('og:description'), text: text.slice(0, 7000), links, colors }
  })
}

const pages = []
const colorTotals = {}
const home = await read(start).catch((e) => ({ url: start, error: e.message, links: [], colors: [] }))
pages.push(home)
const next = [...new Map(home.links.filter((l) => l.href.startsWith(origin) && !l.href.includes('#') && l.href !== home.url).map((l) => [l.href.split('?')[0], l])).values()]
  .sort((a, b) => Number(KEY.test(b.href + b.label)) - Number(KEY.test(a.href + a.label)))
  .slice(0, 4)
for (const l of next) pages.push(await read(l.href).catch((e) => ({ url: l.href, error: e.message, links: [], colors: [] })))
for (const p of pages)
  for (const c of p.colors ?? []) {
    colorTotals[c.hex] ??= { hex: c.hex, count: 0, where: new Set() }
    colorTotals[c.hex].count += c.count
    c.where.forEach((w) => colorTotals[c.hex].where.add(w))
  }
await browser.close()

const result = {
  pages: pages.map(({ links: _l, colors: _c, ...p }) => p),
  colors: Object.values(colorTotals)
    .map((c) => ({ ...c, where: [...c.where] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12),
}
// Full result goes to a file (it can be large); stdout gets the path + a short summary.
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../analysis', `site-${new URL(start).hostname}.json`)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(result, null, 1))
console.log(path.relative(process.cwd(), out).replace(/\\/g, '/'))
for (const p of result.pages) console.log(`- ${p.url} · ${p.title ?? ''} · ${p.error ? 'ERROR ' + p.error : (p.text?.length ?? 0) + ' chars'}`)
console.log('top colours: ' + result.colors.slice(0, 6).map((c) => `${c.hex} (${c.where.join('/')})`).join(', '))
