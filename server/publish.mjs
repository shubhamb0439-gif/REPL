// Publish a plan item to Instagram.
// Instagram's API downloads media from a PUBLIC https URL, so renders are first uploaded to Cloudinary
// (free tier is plenty). Needs CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in server/.env.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ig from './instagram.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = () => ({ cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET })
export const isConfigured = () => {
  const e = env()
  return !!(e.cloud && e.key && e.secret)
}

async function upload(rel) {
  const { cloud, key, secret } = env()
  const file = path.resolve(ROOT, rel.replace(/\\/g, '/'))
  if (!file.startsWith(path.join(ROOT, 'engine')) || !fs.existsSync(file)) throw new Error(`Render not found: ${rel}`)
  const video = /\.(mp4|mov)$/i.test(file)
  const timestamp = Math.floor(Date.now() / 1000)
  const folder = 'rypl'
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex')
  const form = new FormData()
  form.set('file', new Blob([fs.readFileSync(file)]), path.basename(file))
  form.set('api_key', key)
  form.set('timestamp', String(timestamp))
  form.set('folder', folder)
  form.set('signature', signature)
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${video ? 'video' : 'image'}/upload`, { method: 'POST', body: form })
  const j = await r.json()
  if (!r.ok) throw new Error('Cloudinary upload failed: ' + (j.error?.message ?? r.status))
  // Instagram only accepts JPEG stills — ask Cloudinary to deliver images as .jpg.
  return video ? j.secure_url : `https://res.cloudinary.com/${cloud}/image/upload/${j.public_id}.jpg`
}

/** Upload the item's renders and publish them. Returns { mediaId, permalink }. */
export async function publishItem(item) {
  if (!isConfigured()) throw new Error('Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to server/.env to publish (Instagram needs a public link to your media).')
  if (!ig.isConnected()) throw new Error('Instagram is not connected.')
  const r = item.result
  if (!r?.files?.length) throw new Error('Nothing rendered yet — create it first.')
  if (item.format === 'shoot') throw new Error('Shoot briefs are filmed by you — post the video from the Instagram app.')
  const files = r.files.map((f) => f.replace(/\\/g, '/'))
  const caption = [r.caption, (r.hashtags ?? []).join(' ')].filter(Boolean).join('\n\n').slice(0, 2200)

  let res
  if (item.format === 'reel') {
    const video = files.find((f) => f.endsWith('.mp4'))
    if (!video) throw new Error('No reel.mp4 found for this item.')
    const cover = files.find((f) => /cover\.(jpg|png)$/.test(f))
    res = await ig.publish({ type: 'REELS', url: await upload(video), caption, ...(cover ? { cover_url: await upload(cover) } : {}) })
  } else {
    const images = files.filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
    if (!images.length) throw new Error('No images found for this item.')
    if (item.format === 'carousel' && images.length > 1) {
      const urls = []
      for (const f of images.slice(0, 10)) urls.push(await upload(f))
      res = await ig.publish({ type: 'CAROUSEL', urls, caption })
    } else {
      res = await ig.publish({ type: 'IMAGE', url: await upload(images[0]), caption })
    }
  }
  const permalink = await ig.permalink(res.id).catch(() => null)
  return { mediaId: res.id, permalink }
}
