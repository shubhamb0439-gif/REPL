import { motion } from 'framer-motion'
import { ArrowUpRight, CalendarClock, Flame, Play, RefreshCw, Sparkles, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { bestTimes, kpis, moments, timeSlots, topReels, viewsSeries } from '../data'
import { getPlan, igDashboard, type IgDashboard, type PlanItem } from '../engine'
import { useStore } from '../store'
import { Badge, Card, cn, fmt, Spark } from '../ui'

const TODAY = new Date()

function RippleScore({ value, label = 'Ripple score', suffix = '' }: { value: number; label?: string; suffix?: string }) {
  const r = 62
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid h-[170px] w-[170px] place-items-center">
      {[0, 1, 2].map((i) => (
        <span key={i} className="absolute inset-6 rounded-full border border-volt/30 animate-ripple" style={{ animationDelay: `${i}s` }} />
      ))}
      <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="rs" x1="0" x2="1">
            <stop offset="0" stopColor="#A3B1FF" />
            <stop offset=".6" stopColor="#7DBFCF" />
            <stop offset="1" stopColor="#9D8FE0" />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" />
        <motion.circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="url(#rs)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(value, 100) / 100) }}
          transition={{ duration: 1.6, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </svg>
      <div className="text-center">
        <div className="font-display text-5xl font-black text-white">{value}<span className="text-2xl text-zinc-500">{suffix}</span></div>
        <div className="label mt-1">{label}</div>
      </div>
    </div>
  )
}

type Kpi = { label: string; value: number; suffix?: string; delta?: number; spark?: number[]; note?: string }
type TopItem = { id: string; title: string; views: number; watch?: number; shares: number; score: number; thumb?: string; hue: number; href?: string }

const pct = (now = 0, before = 0) => (before >= 20 ? (now - before) / before : undefined) // skip % change on tiny baselines
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const firstLine = (s = '') => s.split('\n')[0].trim() || 'Untitled post'

// Live Instagram data → the same shapes the sample data uses.
function fromLive(d: IgDashboard) {
  const t = d.totals
  const reels = d.media.filter((m) => m.metrics.ig_reels_avg_watch_time)
  const avgWatch = reels.length ? reels.reduce((a, m) => a + (m.metrics.ig_reels_avg_watch_time ?? 0), 0) / reels.length / 1000 : 0
  const byDate = [...d.media].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const kpis: Kpi[] = [
    { label: 'Views · 30d', value: t.views ?? 0, delta: pct(t.views, d.prev.views), spark: byDate.map((m) => m.metrics.views ?? 0) },
    { label: 'Reach · 30d', value: t.reach ?? 0, delta: pct(t.reach, d.prev.reach), spark: d.series.map((x) => x.reach) },
    { label: 'Followers', value: d.account.followers_count, note: `${d.account.media_count} posts` },
    { label: 'Avg watch time', value: +avgWatch.toFixed(1), suffix: 's', note: `across ${reels.length} reels` },
    { label: 'Shares · 30d', value: t.shares ?? 0, delta: pct(t.shares, d.prev.shares), note: `${t.saves ?? 0} saves` },
  ]
  const top: TopItem[] = [...d.media]
    .sort((a, b) => (b.metrics.views ?? 0) - (a.metrics.views ?? 0))
    .slice(0, 4)
    .map((m, i) => ({
      id: m.id,
      title: firstLine(m.caption),
      views: m.metrics.views ?? 0,
      watch: m.metrics.ig_reels_avg_watch_time ? +(m.metrics.ig_reels_avg_watch_time / 1000).toFixed(1) : undefined,
      shares: m.metrics.shares ?? 0,
      score: m.metrics.total_interactions ?? 0,
      thumb: m.thumbnail_url ?? m.media_url,
      hue: 220 + i * 30,
      href: m.permalink,
    }))
  const series = d.series.map((x) => ({ day: dayLabel(x.date), reach: x.reach }))
  const peak = d.series.reduce((a, b) => (b.reach > a.reach ? b : a), d.series[0] ?? { date: d.fetchedAt, reach: 0 })
  const engagement = t.reach ? Math.round(((t.total_interactions ?? 0) / t.reach) * 100) : 0
  return { kpis, top, series, peak, engagement, best: top[0] }
}

export default function Dashboard() {
  const { igConnected } = useStore()
  const [live, setLive] = useState<IgDashboard | null>(null)
  const [liveError, setLiveError] = useState('')
  useEffect(() => {
    if (!igConnected) return
    igDashboard().then(setLive, (e) => setLiveError(e.message))
  }, [igConnected])
  const L = live ? fromLive(live) : null
  const kpiList: Kpi[] = L?.kpis ?? kpis
  const topList: TopItem[] = L?.top ?? topReels
  const upcoming = moments.filter((m) => new Date(m.date) >= TODAY).slice(0, 5)
  // Real content plan from the server (autopilot); empty if the server is offline.
  const [plan, setPlan] = useState<PlanItem[]>([])
  useEffect(() => {
    getPlan().then((p) => setPlan(p.items), () => {})
  }, [])
  const todayKey = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`
  const queue = plan.filter((c) => c.date >= todayKey && !['Posted', 'Skipped'].includes(c.status)).slice(0, 4)
  const inReview = plan.filter((c) => c.status === 'In review').length

  return (
    <div className="space-y-5">
      {/* HERO */}
      <Card className="relative overflow-hidden p-0">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-pulse/25 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-volt/10 blur-[90px]" />
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
          <div>
            <div className="label mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-volt " />
              {live ? <>Live · @{live.account.username}</> : igConnected ? (liveError ? 'Instagram error — showing sample data' : <><RefreshCw size={11} className="animate-spin" /> Loading Instagram…</>) : 'Sample data'}
            </div>
            <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-tight text-white md:text-5xl">
              Your feed is <span className="text-gradient">rippling</span>.
            </h1>
            <p className="mt-3 max-w-xl text-[15px] text-zinc-400">
              {L && live ? (
                <>
                  <b className="text-zinc-100">{fmt(live.totals.views ?? 0)}</b> views and <b className="text-zinc-100">{fmt(live.totals.reach ?? 0)}</b> accounts reached in the last 30 days.
                  {L.best && <> Top post: “{L.best.title.slice(0, 60)}” with <b className="text-volt">{fmt(L.best.views)}</b> views.</>}
                </>
              ) : (
                <>Views up <b className="text-volt">42%</b> this month. Your “3am lead” reel triggered a second wave — RYPL drafted 3 follow-ups in that format and a Diwali reel for <b className="text-zinc-200">8 Nov</b>.</>
              )}
            </p>
            {liveError && <p className="mt-2 text-xs text-flare">{liveError}</p>}
            <div className="mt-6 flex flex-wrap gap-2.5">
              {inReview > 0 ? (
                <Link to="/calendar?review=1" className="btn-volt">
                  <Sparkles size={15} /> Review {inReview} new draft{inReview > 1 ? 's' : ''}
                </Link>
              ) : (
                <Link to="/calendar" className="btn-volt">
                  <CalendarClock size={15} /> Open content plan
                </Link>
              )}
              <Link to="/reel-lab" className="btn-ghost">
                <Play size={14} /> Analyse a reel
              </Link>
              {!igConnected && (
                <Link to="/settings" className="btn-ghost text-flare">
                  Connect Instagram for live data
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center md:pr-4">
            {L ? <RippleScore value={L.engagement} suffix="%" label="Engagement" /> : <RippleScore value={82} />}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpiList.map((k, i) => (
          <Card key={k.label} delay={0.05 * i} className="glass-hover p-4">
            <div className="label">{k.label}</div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div className="font-display text-2xl font-bold text-white">
                {k.suffix ? k.value : fmt(k.value)}
                {k.suffix && <span className="text-base text-zinc-500">{k.suffix}</span>}
              </div>
              {k.spark && k.spark.length > 1 && <Spark data={k.spark} w={70} h={28} color={i % 2 ? '#7DBFCF' : '#A3B1FF'} />}
            </div>
            {k.delta !== undefined ? (
              <div className={cn('mt-2 flex items-center gap-1 text-xs', k.delta >= 0 ? 'text-volt' : 'text-flare')}>
                <TrendingUp size={12} /> {k.delta >= 0 ? '+' : ''}{Math.round(k.delta * 100)}% <span className="text-zinc-500">vs prev 30d</span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-zinc-500">{k.note ?? (L ? 'last 30 days' : '')}</div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        {/* Views chart */}
        <Card delay={0.1}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="label">{L ? 'Daily reach · last 30 days' : 'Views & reach · last 30 days'}</div>
              <div className="mt-1 text-sm text-zinc-400">
                {L ? (L.peak.reach ? <>Peak: {fmt(L.peak.reach)} accounts on {dayLabel(L.peak.date)}</> : 'No reach recorded yet') : 'Spike on 9 Oct: “Your receptionist sleeps” reel'}
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              {!L && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-volt" />Views</span>}
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-pulse" />Reach</span>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <AreaChart data={L?.series ?? viewsSeries} margin={{ left: -18, right: 4, top: 6 }}>
                <defs>
                  <linearGradient id="gv" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#A3B1FF" stopOpacity=".35" />
                    <stop offset="1" stopColor="#A3B1FF" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="gr" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#9D8FE0" stopOpacity=".3" />
                    <stop offset="1" stopColor="#9D8FE0" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                <Tooltip
                  contentStyle={{ background: '#131316', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(v: number) => fmt(v)}
                />
                <Area type="monotone" dataKey="reach" stroke="#9D8FE0" strokeWidth={2} fill="url(#gr)" />
                {!L && <Area type="monotone" dataKey="views" stroke="#A3B1FF" strokeWidth={2} fill="url(#gv)" />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top reels */}
        <Card delay={0.15}>
          <div className="mb-4 flex items-center justify-between">
            <div className="label">{L ? 'Top posts · by views' : 'Top reels'}</div>
            <Link to="/reel-lab" className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
              Reel Lab <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="space-y-2.5">
            {topList.map((r, i) => (
              <a key={r.id} href={r.href} target="_blank" rel="noreferrer" className="glass-hover flex items-center gap-3 rounded-xl border border-transparent p-2">
                <div
                  className="relative grid h-14 w-10 shrink-0 place-items-center overflow-hidden rounded-lg"
                  style={{ background: `linear-gradient(160deg, hsl(${r.hue} 25% 38%), hsl(${r.hue + 40} 20% 14%))` }}
                >
                  {r.thumb && <img src={r.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />}
                  <Play size={13} className="relative fill-white text-white drop-shadow" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-100">{r.title}</div>
                  <div className="mt-0.5 flex gap-3 font-mono text-[11px] text-zinc-500">
                    <span>{fmt(r.views)} views</span>
                    {r.watch !== undefined && <span>{r.watch}s avg</span>}
                    <span>{r.shares} shares</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('font-display text-lg font-bold', i === 0 ? 'text-volt' : 'text-zinc-300')}>{r.score}</div>
                  {L && <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">interactions</div>}
                </div>
              </a>
            ))}
            {L && !topList.length && <div className="text-sm text-zinc-500">No posts yet.</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Best time heatmap */}
        <Card delay={0.2}>
          <div className="label mb-4">Best time to post · IST</div>
          {L && <p className="-mt-2 mb-3 text-[11px] text-zinc-500">Sample pattern — Instagram shares when your followers are online once you pass 100 followers.</p>}
          <div className="grid grid-cols-[32px_repeat(6,1fr)] gap-1.5 text-[10px]">
            <span />
            {timeSlots.map((t) => (
              <span key={t} className="text-center font-mono text-zinc-500">{t}</span>
            ))}
            {bestTimes.map((row) => (
              <div key={row.day} className="contents">
                <span className="self-center font-mono text-zinc-500">{row.day}</span>
                {row.slots.map((v, j) => (
                  <div
                    key={j}
                    title={`${row.day} ${timeSlots[j]} · ${Math.round(v * 100)}`}
                    className={cn('h-7 rounded-md', v === 1 && 'ring-1 ring-volt')}
                    style={{ background: `rgba(163,177,255,${0.05 + v * 0.7})` }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
            <Flame size={13} className="text-volt" /> Peak: <b className="text-zinc-200">Fri 8 PM</b>
          </div>
        </Card>

        {/* Upcoming moments */}
        <Card delay={0.25}>
          <div className="mb-4 flex items-center justify-between">
            <div className="label">Upcoming moments</div>
            <Link to="/calendar" className="text-xs text-zinc-400 hover:text-white">Calendar →</Link>
          </div>
          <div className="space-y-2">
            {upcoming.map((m) => {
              const d = new Date(m.date)
              const days = Math.round((+d - +TODAY) / 864e5)
              return (
                <div key={m.date} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/[0.03]">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-ink-800 text-center leading-none">
                    <div>
                      <div className="font-display text-sm font-bold text-white">{d.getDate()}</div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase text-zinc-500">{d.toLocaleString('en', { month: 'short' })}</div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-100">{m.name}</div>
                    <div className="text-xs text-zinc-500">in {days} days</div>
                  </div>
                  <Link to={`/studio?occasion=${encodeURIComponent(m.name)}`} className="rounded-lg border border-volt/20 bg-volt/10 px-2 py-1 text-[11px] font-semibold text-volt hover:bg-volt/20">
                    Create
                  </Link>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Queue */}
        <Card delay={0.3}>
          <div className="mb-4 flex items-center justify-between">
            <div className="label">Up next</div>
            <CalendarClock size={15} className="text-zinc-500" />
          </div>
          <div className="space-y-2.5">
            {queue.map((c) => (
              <Link key={c.id} to="/calendar" className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 hover:border-white/15">
                <div className="w-12 shrink-0 font-mono text-[11px] text-zinc-500">
                  {new Date(c.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
                <div className="min-w-0 flex-1 truncate text-sm text-zinc-200">{c.title}</div>
                <Badge tone={c.status === 'Approved' ? 'surge' : c.status === 'In review' ? 'amber' : c.status === 'Generating' ? 'pulse' : c.status === 'Failed' ? 'flare' : 'zinc'}>{c.status}</Badge>
              </Link>
            ))}
            {!queue.length && (
              <Link to="/calendar" className="block text-sm text-zinc-500 hover:text-white">Nothing planned yet — open the calendar to auto-plan your week →</Link>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
