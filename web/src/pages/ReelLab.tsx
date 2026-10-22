import { AnimatePresence, motion } from 'framer-motion'
import { Activity, ArrowRight, Eye, Link2, Upload, Wand2, Zap } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { analyzeReel, uploadFile, type ReelAnalysis } from '../engine'
import { Badge, Card, cn, fmt, PageHeader, Shimmer } from '../ui'

const watchlist = [
  { handle: '@growthwithmeera', reel: 'I fired my receptionist (sort of)', views: 1_240_000, ratio: 18.2 },
  { handle: '@smbindia', reel: '3 AI tools every clinic needs', views: 486_000, ratio: 9.4 },
  { handle: '@realtyreels', reel: 'Touring a ₹4Cr flat in 15s', views: 2_100_000, ratio: 31.0 },
]

export default function ReelLab() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<ReelAnalysis | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState('')

  const run = async (u: string | File = url) => {
    setLoading(true)
    setRes(null)
    setError('')
    try {
      // Upload the actual video to the server — Claude can't see files in your browser.
      setRes(await analyzeReel(typeof u === 'string' ? u : await uploadFile(u)))
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reel Lab"
        title={<>Find the <span className="text-gradient">viral curve</span>.</>}
        desc="RYPL splits a reel into frames (ffmpeg), transcribes it (Whisper), and Claude scores the hook, pacing, payoff and loop against viral benchmarks in your niche."
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input className="input pl-10" placeholder="Paste an Instagram reel URL — yours or a competitor's" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
          </div>
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) run(e.target.files[0]); e.target.value = '' }} />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload .mp4</button>
          <button className="btn-volt" onClick={() => run()} disabled={loading}><Activity size={15} /> Analyse</button>
        </div>
      </Card>

      {error && !loading && (
        <Card className="mb-5 border-flare/30">
          <div className="label mb-2 text-flare">Analysis failed</div>
          <p className="whitespace-pre-line text-sm text-zinc-300">{error}</p>
        </Card>
      )}

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="glass flex items-center gap-3 p-4 font-mono text-xs text-zinc-400">
              <Zap size={14} className="animate-pulse text-volt" /> extracting frames @2fps → transcribing → scoring hook & pacing…
            </div>
            <Shimmer className="h-[320px]" />
          </motion.div>
        )}

        {!loading && res && (
          <motion.div key="r" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
              <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="label">Retention curve</div>
                    <div className="mt-1 text-sm text-zinc-300">{res.title}</div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-flare" />This reel</span>
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-volt" />Viral benchmark</span>
                  </div>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer>
                    <ComposedChart data={res.curve} margin={{ left: -20, right: 8, top: 10 }}>
                      <defs>
                        <linearGradient id="gy" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0" stopColor="#E58A98" stopOpacity=".3" />
                          <stop offset="1" stopColor="#E58A98" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
                      <XAxis dataKey="s" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v + 's'} interval={3} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v + '%'} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: '#131316', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }} labelFormatter={(v) => v + 's'} formatter={(v: number) => v + '%'} />
                      <Line type="monotone" dataKey="viral" name="Viral" stroke="#A3B1FF" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="you" name="This reel" stroke="#E58A98" strokeWidth={2.5} fill="url(#gy)" />
                      {res.drops.map((d) => {
                        const pt = res.curve.find((c) => c.s === d.s)
                        return pt ? <ReferenceDot key={d.s} x={d.s} y={pt.you} r={6} fill="#05050A" stroke="#E58A98" strokeWidth={2} /> : null
                      })}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  {res.drops.map((d, i) => (
                    <div key={d.s} className="rounded-xl border border-flare/20 bg-flare/[0.05] p-3">
                      <div className="font-mono text-xs text-flare">Drop {i + 1} · {d.s}s</div>
                      <div className="mt-1 text-[13px] text-zinc-300">{d.why}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-5">
                <Card className="text-center">
                  <div className="label">Viral potential</div>
                  <div className="mt-2 font-display text-6xl font-black text-white">{res.score}</div>
                  <div className="mt-1 text-sm text-zinc-400">→ <span className="text-volt">~88</span> with fixes applied</div>
                </Card>
                <Card>
                  <div className="label mb-3">Breakdown</div>
                  <div className="space-y-2.5">
                    {res.metrics.map((m) => (
                      <div key={m.label} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">{m.label}</span>
                        <span className={cn('font-medium', m.verdict === 'good' ? 'text-volt' : m.verdict === 'ok' ? 'text-amber-300' : 'text-flare')}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="label">How to fix it</div>
                <Link to="/studio" className="btn-volt py-2"><Wand2 size={15} /> Remake with fixes</Link>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {res.fixes.map((f, i) => (
                  <div key={f} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <div className="font-display text-2xl font-black text-volt/80">0{i + 1}</div>
                    <div className="mt-2 text-[13px] leading-snug text-zinc-300">{f}</div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && !res && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="label mb-4">What RYPL measures</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Hook', 'First 1.5s pattern interrupt'],
                ['Pacing', 'Cuts per second, energy'],
                ['Payoff', 'When the value lands'],
                ['Loop', 'Does the end feed the start'],
                ['Text', 'Captions & on-screen copy'],
                ['Audio', 'Trend, VO, beat sync'],
              ].map(([a, b]) => (
                <div key={a} className="rounded-xl border border-white/[0.06] p-3">
                  <div className="text-sm font-semibold text-zinc-100">{a}</div>
                  <div className="text-xs text-zinc-500">{b}</div>
                </div>
              ))}
            </div>
            <button onClick={() => run('https://instagram.com/reel/demo')} className="btn-ghost mt-4 w-full">Try with a sample reel <ArrowRight size={14} /></button>
          </Card>
          <Card>
            <div className="label mb-4 flex items-center gap-2"><Eye size={12} /> Viral watchlist</div>
            <div className="space-y-2.5">
              {watchlist.map((w) => (
                <button key={w.handle} onClick={() => run(w.handle)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] p-3 text-left transition hover:border-volt/30">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-100">{w.reel}</div>
                    <div className="text-xs text-zinc-500">{w.handle}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-sm font-bold text-white">{fmt(w.views)}</div>
                    <Badge tone="volt">{w.ratio}× followers</Badge>
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">Competitor reels are pulled via Apify. Only public metrics (views, likes, comments) are available for accounts you don't own.</p>
          </Card>
        </div>
      )}
    </div>
  )
}
