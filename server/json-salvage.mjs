// Claude's final answer should be strict JSON, but copy sometimes contains a stray "quote" or other glitch that
// makes JSON.parse fail even though the creative rendered fine. This recovers the known top-level fields so a
// finished post isn't thrown away over punctuation.
const KEYS = ['format', 'headline', 'sub', 'cta', 'caption', 'hashtags', 'layout', 'slides', 'scenes', 'brief', 'postTime', 'rationale', 'files', 'publish', 'change']

const unescape = (s) => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')

export function salvageJson(text) {
  const t = String(text)
  const start = t.indexOf('{')
  if (start < 0) return null
  const body = t.slice(start)
  const hits = []
  const re = new RegExp(`"(${KEYS.join('|')})"\\s*:`, 'g')
  for (let m; (m = re.exec(body)); ) hits.push({ key: m[1], from: m.index, valueAt: m.index + m[0].length })
  if (!hits.length) return null

  const out = {}
  hits.forEach((h, i) => {
    if (h.key in out) return // first occurrence = top level (nested objects don't use these keys)
    let raw = body.slice(h.valueAt, i + 1 < hits.length ? hits[i + 1].from : body.length).trim()
    raw = raw.replace(/```[\s\S]*$/, '').trim() // trailing code fence + prose
    if (i + 1 === hits.length) raw = raw.replace(/\}\s*$/, '').trim() // closing brace of the object
    raw = raw.replace(/,\s*$/, '').trim()
    try {
      out[h.key] = JSON.parse(raw)
    } catch {
      // A string with unescaped quotes inside: take everything between the outer quotes.
      if (raw.startsWith('"') && raw.lastIndexOf('"') > 0) out[h.key] = unescape(raw.slice(1, raw.lastIndexOf('"')))
    }
  })
  // Only trust it if we got something usable.
  if (!out.files?.length && !out.caption && !out.headline) return null
  if (!Array.isArray(out.files)) {
    const paths = [...t.matchAll(/engine[\\/]out[\\/][\w.-]+[\\/][\w.-]+\.(?:png|jpe?g|mp4)/g)].map((m) => m[0].replace(/\\/g, '/'))
    out.files = [...new Set(paths)]
  }
  return { ...out, salvaged: true }
}
