import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Brand } from '../data'
import { uploadUrl, type Creative } from '../engine'
import { cn } from '../ui'

function Rings({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={cn('pointer-events-none absolute', className)}>
      {[30, 55, 80, 100].map((r, i) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={color} strokeOpacity={0.5 - i * 0.1} strokeWidth="1.2" />
      ))}
    </svg>
  )
}

function BrandTag({ brand }: { brand: Brand }) {
  if (brand.logo) {
    const h = { small: 'h-4', medium: 'h-6', large: 'h-8' }[brand.logoSize ?? 'large']
    return <img src={uploadUrl(brand.logo)} alt={brand.name} className={cn(h, 'max-w-[55%] object-contain object-left')} />
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: brand.colors.primary }} />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">{brand.name}</span>
    </div>
  )
}

/** 4:5 static post */
export function PostCanvas({ c, brand }: { c: Creative; brand: Brand }) {
  const { primary, secondary, accent, bg } = brand.colors
  if (c.layout === 'split')
    return (
      <div className="relative grid aspect-[4/5] w-full grid-rows-[1.3fr_1fr] overflow-hidden rounded-2xl" style={{ background: bg }}>
        <div className="relative overflow-hidden p-7" style={{ background: `linear-gradient(135deg, ${secondary}, ${bg})` }}>
          <Rings color={primary} className="-right-16 -top-16 h-64 w-64" />
          <BrandTag brand={brand} />
          <h2 className="mt-6 font-brand text-[28px] font-black leading-[1.02] text-white">{c.headline}</h2>
        </div>
        <div className="flex flex-col justify-between p-7">
          <p className="text-[15px] leading-snug text-white/75">{c.sub}</p>
          <div className="inline-flex w-fit rounded-full px-4 py-2 text-xs font-bold" style={{ background: primary, color: bg }}>
            {c.cta}
          </div>
        </div>
      </div>
    )
  if (c.layout === 'minimal')
    return (
      <div className="relative flex aspect-[4/5] w-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-8" style={{ background: bg }}>
        <BrandTag brand={brand} />
        <div>
          <div className="mb-4 h-1 w-14 rounded" style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }} />
          <h2 className="font-brand text-[30px] font-bold leading-[1.05] text-white">{c.headline}</h2>
          <p className="mt-4 text-sm text-white/60">{c.sub}</p>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: primary }} className="font-semibold">{c.cta}</span>
          <span className="text-white/40">{brand.handle}</span>
        </div>
      </div>
    )
  if (c.layout === 'festive')
    return (
      <div
        className="relative flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden rounded-2xl p-8 text-center"
        style={{ background: `radial-gradient(circle at 50% 35%, #3b1d00 0%, ${bg} 70%)` }}
      >
        <Rings color="#FFB547" className="left-1/2 top-[30%] h-80 w-80 -translate-x-1/2 -translate-y-1/2" />
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-amber-300"
            style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, opacity: 0.3 + ((i * 7) % 10) / 15, boxShadow: '0 0 8px #FFB547' }}
          />
        ))}
        <div className="relative">
          <div className="mx-auto mb-5 h-10 w-10 rounded-full" style={{ background: 'radial-gradient(circle, #FFE08A, #FF8A00 60%, transparent 70%)', boxShadow: '0 0 40px #FF8A00' }} />
          <h2 className="font-brand text-[34px] font-black leading-none text-amber-200">{c.headline}</h2>
          <p className="mx-auto mt-4 max-w-[85%] text-sm text-amber-50/75">{c.sub}</p>
          <div className="mt-6 flex justify-center">
            <BrandTag brand={brand} />
          </div>
        </div>
      </div>
    )
  // bold
  return (
    <div className="relative flex aspect-[4/5] w-full flex-col justify-between overflow-hidden rounded-2xl p-7" style={{ background: primary }}>
      <Rings color={bg} className="-bottom-24 -right-24 h-80 w-80" />
      <div className="flex items-center justify-between">
        {brand.logo ? <BrandTag brand={brand} /> : <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: bg }}>{brand.name}</span>}
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: bg, color: primary }}>NEW</span>
      </div>
      <h2 className="relative font-brand text-[34px] font-black uppercase leading-[0.95]" style={{ color: bg }}>
        {c.headline}
      </h2>
      <div className="relative flex items-end justify-between gap-4">
        <p className="max-w-[70%] text-[13px] font-medium leading-snug" style={{ color: bg, opacity: 0.8 }}>{c.sub}</p>
        <span className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-white" style={{ background: bg }}>
          → DM
        </span>
      </div>
    </div>
  )
}

export function CarouselPreview({ c, brand }: { c: Creative; brand: Brand }) {
  const [i, setI] = useState(0)
  const slides = c.slides ?? []
  const s = slides[i]
  return (
    <div>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl" style={{ background: brand.colors.bg }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            className="absolute inset-0 flex flex-col justify-between p-8"
            style={{ background: i === 0 ? `linear-gradient(150deg, ${brand.colors.secondary}, ${brand.colors.bg} 70%)` : undefined }}
          >
            <div className="flex items-center justify-between">
              <BrandTag brand={brand} />
              <span className="font-mono text-[11px] text-white/40">{i + 1}/{slides.length}</span>
            </div>
            <div>
              {i > 0 && <div className="mb-3 font-mono text-xs" style={{ color: brand.colors.primary }}>0{i}</div>}
              <h2 className={cn('font-brand font-black leading-[1.02] text-white', i === 0 ? 'text-[32px]' : 'text-2xl')}>{s?.title}</h2>
              <p className="mt-4 text-[15px] text-white/65">{s?.body}</p>
            </div>
            <div className="flex gap-1">
              {slides.map((_, j) => (
                <span key={j} className="h-1 flex-1 rounded-full" style={{ background: j <= i ? brand.colors.primary : 'rgba(255,255,255,.12)' }} />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <button className="btn-ghost px-3 py-1.5" onClick={() => setI(Math.max(0, i - 1))} aria-label="Previous slide"><ChevronLeft size={16} /></button>
        <button className="btn-ghost px-3 py-1.5" onClick={() => setI(Math.min(slides.length - 1, i + 1))} aria-label="Next slide"><ChevronRight size={16} /></button>
      </div>
    </div>
  )
}

/** 9:16 motion graphic preview — the real render is done by Remotion in /engine */
export function ReelPreview({ c, brand }: { c: Creative; brand: Brand }) {
  const scenes = c.scenes ?? []
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setI((i + 1) % scenes.length), 1700)
    return () => clearTimeout(t)
  }, [i, playing, scenes.length])
  const s = scenes[i]
  const { primary, secondary, bg } = brand.colors
  return (
    <div className="mx-auto w-full max-w-[290px]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border-[6px] border-ink-700 shadow-violet" style={{ background: bg }}>
        <motion.div
          key={'bg' + i}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          style={{ background: `radial-gradient(circle at ${30 + i * 15}% ${20 + i * 12}%, ${i % 2 ? secondary : primary}55, transparent 60%)` }}
        />
        {[0, 1, 2].map((k) => (
          <motion.span
            key={i + '-' + k}
            className="absolute left-1/2 top-1/2 h-40 w-40 rounded-full border"
            style={{ borderColor: primary, x: '-50%', y: '-50%' }}
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 1.6, delay: k * 0.18, ease: 'easeOut' }}
          />
        ))}
        <div className="absolute left-4 right-4 top-4 flex gap-1">
          {scenes.map((_, j) => (
            <span key={j} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15">
              {j <= i && <motion.span className="block h-full" style={{ background: primary }} initial={{ width: j < i ? '100%' : 0 }} animate={{ width: '100%' }} transition={{ duration: j < i ? 0 : 1.7, ease: 'linear' }} />}
            </span>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            className="absolute inset-0 flex items-center justify-center p-6 text-center"
            initial={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -30, scale: 1.05, filter: 'blur(8px)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <div className={cn('font-brand font-black leading-[1.05] text-white', i === 0 ? 'text-[26px] uppercase' : 'text-xl')} style={i === 2 ? { color: primary } : undefined}>
              {s?.text}
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <BrandTag brand={brand} />
          <button onClick={() => setPlaying(!playing)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white backdrop-blur" aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
        </div>
      </div>
    </div>
  )
}
