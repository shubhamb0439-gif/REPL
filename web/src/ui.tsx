import clsx from 'clsx'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export const cn = clsx

export function Logo({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {animated && (
        <>
          <span className="absolute inset-0 rounded-full border border-volt/50 animate-ripple" />
          <span className="absolute inset-0 rounded-full border border-pulse/50 animate-ripple [animation-delay:1s]" />
        </>
      )}
      <svg viewBox="0 0 32 32" width={size} height={size}>
        <defs>
          <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#A3B1FF" />
            <stop offset="1" stopColor="#7DBFCF" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="4.2" fill="url(#lg)" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="#A3B1FF" strokeOpacity=".55" strokeWidth="1.6" />
        <circle cx="16" cy="16" r="14" fill="none" stroke="#9D8FE0" strokeOpacity=".55" strokeWidth="1.4" />
      </svg>
    </div>
  )
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={30} animated />
      <div className="leading-none">
        <div className="font-display text-[19px] font-black tracking-[0.14em] text-white">RYPL</div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-zinc-500">by AXIon</div>
      </div>
    </div>
  )
}

export function Card({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0.7, 0.2, 1] }}
      className={cn('glass p-5', className)}
    >
      {children}
    </motion.div>
  )
}

export function PageHeader({ eyebrow, title, desc, right }: { eyebrow: string; title: ReactNode; desc?: string; right?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="label mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-volt " />
          {eyebrow}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-[40px] md:leading-[1.05]">{title}</h1>
        {desc && <p className="mt-2 max-w-2xl text-sm text-zinc-400">{desc}</p>}
      </div>
      {right}
    </div>
  )
}

export function Spark({ data, color = '#A3B1FF', w = 110, h = 34 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - 4) - 2])
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const id = 'sp' + color.slice(1)
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d + ` L ${w} ${h} L 0 ${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n))

export function Badge({ children, tone = 'zinc' }: { children: ReactNode; tone?: 'volt' | 'pulse' | 'surge' | 'flare' | 'zinc' | 'amber' }) {
  const tones = {
    volt: 'text-volt bg-volt/10 border-volt/25',
    pulse: 'text-[#A996FF] bg-pulse/10 border-pulse/30',
    surge: 'text-surge bg-surge/10 border-surge/25',
    flare: 'text-flare bg-flare/10 border-flare/25',
    amber: 'text-amber-300 bg-amber-400/10 border-amber-400/25',
    zinc: 'text-zinc-300 bg-white/[0.04] border-white/10',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tones[tone])}>{children}</span>
}

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-shimmer rounded-xl', className)}
      style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.03) 0%, rgba(255,255,255,.08) 50%, rgba(255,255,255,.03) 100%)', backgroundSize: '200% 100%' }}
    />
  )
}
