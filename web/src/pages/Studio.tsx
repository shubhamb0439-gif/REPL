import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Camera, Check, Clapperboard, Copy, Film, Image, ImagePlus, Layers, Lightbulb, Mic, Package, RefreshCw, Send, Sparkles, Wand2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CarouselPreview, PostCanvas, ReelPreview } from '../components/Creatives'
import { moments, resolveBrand } from '../data'
import { GenProgress } from '../components/GenProgress'
import { fileUrl, generate, getProgress, uploadFile, type Creative, type Format, type Progress } from '../engine'
import { useStore } from '../store'
import { Badge, Card, cn, PageHeader, Shimmer } from '../ui'

const formats: { id: Format; label: string; icon: typeof Image; desc: string }[] = [
  { id: 'post', label: 'Post', icon: Image, desc: '4:5 static' },
  { id: 'carousel', label: 'Carousel', icon: Layers, desc: '5 slides' },
  { id: 'reel', label: 'Motion Reel', icon: Film, desc: '9:16 · Remotion' },
  { id: 'shoot', label: 'Shoot Brief', icon: Clapperboard, desc: 'You film it' },
]

const ideaChips = ['missed leads at night', 'slow WhatsApp replies', 'clinic appointment no-shows', 'real estate site visits', 'AI vs human receptionist', 'founder story']

export default function Studio() {
  const { brand } = useStore()
  const [params] = useSearchParams()
  const [format, setFormat] = useState<Format>(params.get('occasion') ? 'reel' : 'post')
  const [topic, setTopic] = useState('')
  const [occasion, setOccasion] = useState(params.get('occasion') ?? '')
  const [loading, setLoading] = useState(false)
  const [out, setOut] = useState<Creative | null>(null)
  const [approved, setApproved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [assets, setAssets] = useState<{ path: string; preview: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [subId, setSubId] = useState('')
  const [voiceover, setVoiceover] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const postAs = resolveBrand(brand, subId)

  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [loading])

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError('')
    try {
      const added = await Promise.all([...files].map(async (f) => ({ path: await uploadFile(f), preview: URL.createObjectURL(f) })))
      setAssets((a) => [...a, ...added])
    } catch (e) {
      setError((e as Error).message)
    }
    setUploading(false)
  }

  const [progress, setProgress] = useState<Progress | null>(null)
  const run = async () => {
    setLoading(true)
    setApproved(false)
    setOut(null)
    setError('')
    setProgress(null)
    // Poll the server for live steps while Claude works.
    const jobId = 'studio_' + Date.now().toString(36)
    const poll = setInterval(() => getProgress(jobId).then(setProgress, () => {}), 2000)
    try {
      setOut(await generate({ format, topic, occasion: occasion || undefined, brand: postAs, assets: assets.map((a) => a.path), voiceover: format === 'reel' && voiceover, jobId }))
    } catch (e) {
      setError((e as Error).message)
    }
    clearInterval(poll)
    setLoading(false)
  }

  const copy = () => {
    if (!out) return
    navigator.clipboard?.writeText(out.caption + '\n\n' + out.hashtags.join(' ')).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const upcoming = moments.filter((m) => new Date(m.date) >= new Date('2026-10-21')).slice(0, 12)

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title={<>Create something that <span className="text-gradient">ripples</span>.</>}
        desc="Every creative is generated from your Brand Brain and the learned playbook. Motion reels render locally with Remotion via Claude Code."
      />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        {/* Controls */}
        <Card className="h-fit space-y-6">
          {!!brand.subBrands?.length && (
            <div>
              <div className="label mb-2.5">Post as</div>
              <select className="input" value={subId} onChange={(e) => setSubId(e.target.value)}>
                <option value="">{brand.name} (main brand)</option>
                {brand.subBrands.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div className="label mb-2.5">Format</div>
            <div className="grid grid-cols-2 gap-2">
              {formats.map(({ id, label, icon: Icon, desc }) => (
                <button
                  key={id}
                  onClick={() => setFormat(id)}
                  className={cn(
                    'relative rounded-xl border p-3 text-left transition',
                    format === id ? 'border-volt/40 bg-volt/[0.07]' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15',
                  )}
                >
                  <Icon size={17} className={format === id ? 'text-volt' : 'text-zinc-400'} />
                  <div className="mt-2 text-sm font-semibold text-zinc-100">{label}</div>
                  <div className="text-[11px] text-zinc-500">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label mb-2.5">What's it about?</div>
            <textarea
              className="input min-h-[96px] resize-none"
              placeholder={format === 'shoot' ? 'e.g. show how Recipto handles a 3am enquiry' : 'e.g. missed leads at night, clinic no-shows…'}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {ideaChips.map((c) => (
                <button key={c} onClick={() => setTopic(c)} className="chip hover:border-volt/30 hover:text-volt">
                  {c}
                </button>
              ))}
            </div>
          </div>

          {format === 'reel' && (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={voiceover} onChange={(e) => setVoiceover(e.target.checked)} className="accent-[#A3B1FF]" />
              Add AI voiceover <span className="text-xs text-zinc-500">(needs OpenAI key)</span>
            </label>
          )}

          <div>
            <div className="label mb-2.5">Occasion (optional)</div>
            <select className="input" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
              <option value="">— Evergreen content —</option>
              {upcoming.map((m) => (
                <option key={m.date} value={m.name}>
                  {m.name} · {new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label mb-2.5">Your images (optional)</div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            <div className="flex flex-wrap gap-2">
              {assets.map((a) => (
                <div key={a.path} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-white/10">
                  <img src={a.preview} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => setAssets((x) => x.filter((y) => y.path !== a.path))} className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white opacity-0 group-hover:opacity-100">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-white/15 text-zinc-400 hover:border-volt/40 hover:text-volt">
                {uploading ? <RefreshCw size={16} className="animate-spin" /> : <ImagePlus size={18} />}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">Product shots, team photos, screenshots — RYPL designs the post around them.</p>
          </div>

          <button onClick={run} disabled={loading || uploading} className="btn-volt w-full py-3 text-[15px]">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {loading ? `RYPL is thinking… ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : format === 'shoot' ? 'Write shoot brief' : 'Generate'}
          </button>


          <div className="rounded-xl border border-white/[0.06] bg-ink-900/60 p-3.5 font-mono text-[11px] leading-relaxed text-zinc-500">
            <span className="text-zinc-400">$</span> claude -p "/{format === 'shoot' ? 'shoot-brief' : format === 'reel' ? 'make-reel' : 'make-post'} {topic || '…'}{format === 'carousel' ? ' --carousel' : ''}{occasion ? ` --occasion "${occasion}"` : ''}{assets.length ? ` --assets "${assets.map((a) => a.path).join(',')}"` : ''}"
          </div>
        </Card>

        {/* Output */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
                <Shimmer className="aspect-[4/5]" />
                <div className="space-y-3">
                  <GenProgress progress={progress} format={format} />
                  <Shimmer className="h-20" />
                </div>
              </motion.div>
            )}

            {!loading && error && (
              <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="border-flare/30">
                  <div className="label mb-2 flex items-center gap-2 text-flare"><AlertTriangle size={12} /> Claude couldn't finish</div>
                  <p className="whitespace-pre-line text-sm text-zinc-300">{error}</p>
                </Card>
              </motion.div>
            )}

            {!loading && !out && !error && (
              <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="relative grid min-h-[520px] place-items-center overflow-hidden text-center">
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className="absolute h-48 w-48 rounded-full border border-volt/20 animate-ripple" style={{ animationDelay: `${i * 0.75}s` }} />
                    ))}
                  </div>
                  <div className="relative">
                    <Sparkles className="mx-auto text-volt" size={30} />
                    <div className="mt-4 font-display text-2xl font-bold text-white">Drop a pebble.</div>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">Pick a format and a topic. RYPL writes it, designs it and tells you exactly why it should perform.</p>
                  </div>
                </Card>
              </motion.div>
            )}

            {!loading && out && (
              <motion.div key="o" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {out.format === 'shoot' && out.brief ? (
                  <ShootBriefView c={out} />
                ) : (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
                    <div>
                      {out.files?.length ? (
                        <div className="space-y-2">
                          {out.files.map((f) =>
                            f.endsWith('.mp4') ? (
                              <video key={f} src={fileUrl(f)} controls autoPlay loop muted className="mx-auto max-h-[640px] rounded-2xl" />
                            ) : (
                              <img key={f} src={fileUrl(f)} alt="Rendered creative" className="w-full rounded-2xl" />
                            ),
                          )}
                          <div className="label text-center">Rendered by Claude Code · engine/out</div>
                        </div>
                      ) : (
                        <>
                      {out.format === 'post' && <PostCanvas c={out} brand={postAs} />}
                      {out.format === 'carousel' && <CarouselPreview c={out} brand={postAs} />}
                      {out.format === 'reel' && <ReelPreview c={out} brand={postAs} />}
                        </>
                      )}
                    </div>
                    <div className="space-y-4">
                      <Card className="p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="label">Caption</div>
                          <button onClick={copy} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
                            {copied ? <Check size={13} className="text-volt" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">{out.caption}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {out.hashtags.map((h) => (
                            <span key={h} className="font-mono text-[11px] text-surge">{h}</span>
                          ))}
                        </div>
                      </Card>
                      {out.scenes && (
                        <Card className="p-4">
                          <div className="label mb-3">Motion timeline</div>
                          <div className="space-y-2">
                            {out.scenes.map((s) => (
                              <div key={s.t} className="flex gap-3 text-sm">
                                <span className="w-10 shrink-0 font-mono text-xs text-volt">{s.t}</span>
                                <div>
                                  <div className="text-zinc-200">{s.text}</div>
                                  <div className="text-xs text-zinc-500">{s.motion}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                      <Card className="p-4">
                        <div className="label mb-3 flex items-center gap-2"><Lightbulb size={12} /> Why this should work</div>
                        <ul className="space-y-2 text-sm text-zinc-300">
                          {out.rationale.map((r) => (
                            <li key={r} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-volt" />{r}</li>
                          ))}
                        </ul>
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3 text-xs text-zinc-400">
                          Best slot: <Badge tone="volt">{out.postTime}</Badge>
                          <Badge tone={out.source === 'claude' ? 'pulse' : 'amber'}>{out.source === 'claude' ? 'Claude Code' : 'Demo engine'}</Badge>
                        </div>
                      </Card>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setApproved(true)} className={cn(approved ? 'btn-ghost text-volt' : 'btn-volt')}>
                          {approved ? <Check size={15} /> : <Send size={15} />} {approved ? 'Approved & queued' : 'Approve & schedule'}
                        </button>
                        <button onClick={run} className="btn-ghost"><RefreshCw size={14} /> Regenerate</button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function ShootBriefView({ c }: { c: Creative }) {
  const b = c.brief!
  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-flare/20 blur-3xl" />
        <div className="label mb-2 flex items-center gap-2"><Clapperboard size={12} /> Shoot brief · {b.length}</div>
        <h2 className="font-display text-2xl font-bold text-white">{b.concept}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-volt/25 bg-volt/[0.06] p-4">
            <div className="label mb-1.5 text-volt/80">Hook · say this</div>
            <div className="text-[15px] font-semibold text-white">“{b.hook.line}”</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="label mb-1.5">On-screen text</div>
            <div className="text-[15px] font-semibold text-white">{b.hook.onScreen}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="label mb-1.5">Opening visual</div>
            <div className="text-sm text-zinc-300">{b.hook.visual}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="label mb-4">Beat sheet</div>
        <div className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-gradient-to-b before:from-volt before:via-surge before:to-pulse">
          {b.beats.map((x) => (
            <div key={x.time} className="relative">
              <span className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-ink-950 bg-volt" />
              <div className="font-mono text-xs text-volt">{x.time}</div>
              <div className="mt-0.5 text-sm font-medium text-zinc-100">{x.action}</div>
              <div className="text-sm text-zinc-400">{x.say}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="label mb-3 flex items-center gap-2"><Camera size={12} /> Shot list</div>
          <ol className="space-y-1.5 text-sm text-zinc-300">
            {b.shots.map((s, i) => (
              <li key={s} className="flex gap-2"><span className="font-mono text-xs text-zinc-500">{i + 1}.</span>{s}</li>
            ))}
          </ol>
        </Card>
        <Card className="p-4">
          <div className="label mb-3 flex items-center gap-2"><Mic size={12} /> Audio</div>
          <p className="text-sm text-zinc-300">{b.audio}</p>
          <p className="mt-3 text-xs text-zinc-500">Trending sounds can’t be added via API — post this one manually from the app.</p>
        </Card>
        <Card className="p-4">
          <div className="label mb-3 flex items-center gap-2"><Package size={12} /> Props</div>
          <div className="flex flex-wrap gap-1.5">
            {b.props.map((p) => <span key={p} className="chip">{p}</span>)}
          </div>
          <div className="mt-4 text-xs text-zinc-400">Post: <Badge tone="volt">{c.postTime}</Badge></div>
        </Card>
      </div>
    </div>
  )
}
