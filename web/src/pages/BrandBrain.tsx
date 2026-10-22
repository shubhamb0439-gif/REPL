import { Brain, Check, FileText, Globe, ImagePlus, Plus, RefreshCw, RotateCcw, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRef, useState } from 'react'
import { PostCanvas } from '../components/Creatives'
import { defaultBrand, playbook, type Brand, type SubBrand } from '../data'
import { learnBrand, uploadFile, uploadUrl, type Creative, type LearnedBrand } from '../engine'
import { useStore } from '../store'
import { Card, cn, PageHeader } from '../ui'

function TagList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState('')
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span key={t} className="chip">
            {t}
            <button onClick={() => onChange(items.filter((x) => x !== t))} className="text-zinc-500 hover:text-flare" aria-label={`Remove ${t}`}><X size={11} /></button>
          </span>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (v.trim()) onChange([...items, v.trim()])
          setV('')
        }}
      >
        <input className="input py-2" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn-ghost px-3" aria-label="Add"><Plus size={15} /></button>
      </form>
    </div>
  )
}

const colorHelp: Record<keyof Brand['colors'], string> = {
  primary: 'Headlines, buttons, highlights',
  secondary: 'Gradients, second panels',
  accent: 'Small details',
  bg: 'Post background',
}

export default function BrandBrain() {
  const { brand, setBrand } = useStore()
  const [active, setActive] = useState<'master' | string>('master')
  const [url, setUrl] = useState('')
  const [learning, setLearning] = useState(false)
  const [busy, setBusy] = useState<'' | 'logo' | 'guide'>('')
  const [error, setError] = useState('')
  const logoRef = useRef<HTMLInputElement>(null)
  const guideRef = useRef<HTMLInputElement>(null)

  const subs = brand.subBrands ?? []
  const sub = subs.find((s) => s.id === active)
  const cur: Brand = sub ?? brand
  const update = (patch: Partial<Brand>) =>
    sub ? setBrand({ ...brand, subBrands: subs.map((s) => (s.id === sub.id ? { ...s, ...patch } : s)) }) : setBrand({ ...brand, ...patch })
  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => update({ [k]: v } as Partial<Brand>)

  const addSub = () => {
    const { subBrands: _omit, ...base } = brand
    const s: SubBrand = { ...base, id: 'sb_' + Date.now().toString(36), name: 'New sub-brand', tagline: '', about: '', services: [], handle: '', logo: undefined, guidelines: '', guideFiles: [] }
    setBrand({ ...brand, subBrands: [...subs, s] })
    setActive(s.id)
  }
  const removeSub = (id: string) => {
    if (!confirm('Delete this sub-brand?')) return
    setBrand({ ...brand, subBrands: subs.filter((s) => s.id !== id) })
    setActive('master')
  }

  const [proposal, setProposal] = useState<LearnedBrand | null>(null)
  const [applied, setApplied] = useState(false)
  const proposalRef = useRef<HTMLDivElement>(null)
  const learn = async () => {
    setLearning(true)
    setError('')
    setApplied(false)
    try {
      const u = /^https?:\/\//.test(url.trim()) ? url.trim() : 'https://' + url.trim()
      setProposal(await learnBrand(u))
      // The review card renders above the form — bring it into view so it isn't missed.
      setTimeout(() => proposalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      setError((e as Error).message)
    }
    setLearning(false)
  }
  // Merge the proposal into the main brand. Logo, guidelines and existing sub-brands are kept;
  // products become sub-brands unless one with that name already exists (then it's updated).
  const applyProposal = () => {
    if (!proposal) return
    const { subBrands: learnedSubs = [], sources: _s, notes: _n, ...fields } = proposal
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))) as Partial<Brand>
    const merged: Brand = { ...brand, ...clean, colors: { ...brand.colors, ...(clean.colors ?? {}) } }
    const subsNext = [...subs]
    for (const ls of learnedSubs) {
      const i = subsNext.findIndex((x) => x.name.trim().toLowerCase() === ls.name.trim().toLowerCase())
      const base = i >= 0 ? subsNext[i] : { ...merged, id: 'sb_' + Date.now().toString(36) + subsNext.length, subBrands: undefined, logo: undefined, guidelines: '', guideFiles: [], handle: '' }
      const { subBrands: _x, ...rest } = base as Brand & { id: string }
      const next = { ...rest, name: ls.name, tagline: ls.tagline ?? rest.tagline, about: ls.about ?? '', services: ls.services ?? [], audience: ls.audience ?? rest.audience, cta: ls.cta ?? rest.cta }
      i >= 0 ? (subsNext[i] = next) : subsNext.push(next)
    }
    setBrand({ ...merged, subBrands: subsNext })
    setProposal(null)
    setApplied(true)
  }

  const upload = async (kind: 'logo' | 'guide', files: FileList | null) => {
    if (!files?.length) return
    setBusy(kind)
    setError('')
    try {
      if (kind === 'logo') set('logo', await uploadFile(files[0]))
      else {
        const added = await Promise.all([...files].map(async (f) => ({ path: await uploadFile(f), name: f.name })))
        set('guideFiles', [...(cur.guideFiles ?? []), ...added])
      }
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy('')
  }

  const sample: Creative = {
    format: 'post',
    headline: 'Your receptionist sleeps. Ours doesn’t.',
    sub: cur.tagline,
    cta: cur.cta,
    caption: '',
    hashtags: [],
    layout: 'split',
    postTime: '',
    rationale: [],
    source: 'demo',
  }

  return (
    <div>
      <PageHeader
        eyebrow="Brand Brain"
        title={<>Teach RYPL <span className="text-gradient">who you are</span>.</>}
        desc="Everything here is written to engine/brand/ when you generate — Claude reads it before every creative. Add sub-brands for product lines that post with their own look."
        right={<button className="btn-ghost" onClick={() => confirm('Reset all brand settings to the defaults?') && (setBrand(defaultBrand), setActive('master'))}><RotateCcw size={14} /> Reset</button>}
      />

      {/* Brand / sub-brand switcher */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[{ id: 'master', name: brand.name || 'Main brand', master: true }, ...subs.map((s) => ({ id: s.id, name: s.name || 'Untitled', master: false }))].map((b) => (
          <button
            key={b.id}
            onClick={() => setActive(b.id)}
            className={cn('rounded-xl border px-3.5 py-2 text-sm transition', active === b.id ? 'border-white/20 bg-white/[0.06] text-white' : 'border-white/[0.07] text-zinc-400 hover:text-white')}
          >
            {b.name}
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{b.master ? 'Main' : 'Sub-brand'}</span>
          </button>
        ))}
        <button onClick={addSub} className="btn-ghost py-2 text-sm"><Plus size={14} /> Add sub-brand</button>
      </div>

      {error && <Card className="mb-5 border-flare/30 text-sm text-zinc-300">{error}</Card>}

      {!sub && (
        <Card className="mb-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-3 md:w-64">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-zinc-300"><Brain size={19} /></div>
              <div>
                <div className="text-sm font-semibold text-white">Auto-train</div>
                <div className="text-xs text-zinc-500">From your website or Instagram</div>
              </div>
            </div>
            <div className="relative flex-1">
              <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input className="input pl-10" placeholder="https://yourbusiness.com or @handle" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <button className="btn-volt" disabled={!url || learning} onClick={learn}>
              {learning ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />} {learning ? 'Reading your site… (1–2 min)' : 'Learn my brand'}
            </button>
          </div>
        </Card>
      )}

      {proposal && !sub && (
        <div ref={proposalRef} className="scroll-mt-6">
        <Card className="mb-5 border-volt/40">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="label mb-1">RYPL learned this from your site — review before applying</div>
              {proposal.notes && <p className="text-xs text-zinc-500">{proposal.notes}</p>}
            </div>
            <button onClick={() => setProposal(null)} className="text-zinc-500 hover:text-white" aria-label="Dismiss"><X size={16} /></button>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            {proposal.name && <div><div className="label mb-1">Brand</div><div className="text-white">{proposal.name}{proposal.tagline && <span className="text-zinc-400"> — {proposal.tagline}</span>}</div></div>}
            {proposal.audience && <div><div className="label mb-1">Audience</div><div className="text-zinc-300">{proposal.audience}</div></div>}
            {proposal.about && <div className="md:col-span-2"><div className="label mb-1">What you do</div><div className="text-zinc-300">{proposal.about}</div></div>}
            {!!proposal.services?.length && <div><div className="label mb-1">Services</div><div className="flex flex-wrap gap-1">{proposal.services.map((x) => <span key={x} className="chip">{x}</span>)}</div></div>}
            {proposal.colors && (
              <div>
                <div className="label mb-1">Colours from your site</div>
                <div className="flex gap-1.5">
                  {Object.entries(proposal.colors).map(([k, v]) => (
                    <span key={k} className="chip"><span className="h-3 w-3 rounded" style={{ background: v }} />{k} <span className="font-mono text-[10px] text-zinc-500">{v}</span></span>
                  ))}
                </div>
              </div>
            )}
            {!!proposal.tone?.length && <div><div className="label mb-1">Tone</div><div className="flex flex-wrap gap-1">{proposal.tone.map((x) => <span key={x} className="chip">{x}</span>)}</div></div>}
            {!!proposal.subBrands?.length && (
              <div className="md:col-span-2">
                <div className="label mb-1">Products → sub-brands</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {proposal.subBrands.map((x) => (
                    <div key={x.name} className="rounded-xl border border-white/[0.07] p-2.5">
                      <div className="font-medium text-white">{x.name}</div>
                      <div className="text-xs text-zinc-400">{x.about}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {!!proposal.sources?.length && <p className="mt-3 truncate font-mono text-[10.5px] text-zinc-600">Read: {proposal.sources.join(' · ')}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={applyProposal} className="btn-volt"><Check size={14} /> Apply to Brand Brain</button>
            <button onClick={() => setProposal(null)} className="btn-ghost">Discard</button>
            <span className="self-center text-xs text-zinc-500">Nothing changes below until you apply.</span>
          </div>
        </Card>
        </div>
      )}

      {applied && (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-300">
          <span>Brand updated. Your calendar was planned with the old brand — re-plan it so upcoming content matches.</span>
          <Link to="/calendar" className="btn-ghost py-1.5 text-xs">Go to calendar → Re-plan</Link>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            {sub && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-xs text-zinc-400">
                <span>Sub-brand of <b className="text-zinc-200">{brand.name}</b> — posts made as this sub-brand use its own name, logo, colours and guidelines.</span>
                <button onClick={() => removeSub(sub.id)} className="ml-3 flex items-center gap-1 text-zinc-500 hover:text-flare"><Trash2 size={13} /> Delete</button>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="label mb-2">{sub ? 'Sub-brand name' : 'Brand name'}</div>
                <input className="input" value={cur.name} onChange={(e) => set('name', e.target.value)} />
              </label>
              <label className="block">
                <div className="label mb-2">Instagram handle</div>
                <input className="input" value={cur.handle} onChange={(e) => set('handle', e.target.value)} />
              </label>
              <label className="block md:col-span-2">
                <div className="label mb-2">Tagline</div>
                <input className="input" value={cur.tagline} onChange={(e) => set('tagline', e.target.value)} />
              </label>
              <label className="block md:col-span-2">
                <div className="label mb-2">What you do</div>
                <textarea className="input min-h-[90px]" value={cur.about} onChange={(e) => set('about', e.target.value)} />
              </label>
              <label className="block md:col-span-2">
                <div className="label mb-2">Audience</div>
                <input className="input" value={cur.audience} onChange={(e) => set('audience', e.target.value)} />
              </label>
              <label className="block md:col-span-2">
                <div className="label mb-2">Default call to action</div>
                <input className="input" value={cur.cta} onChange={(e) => set('cta', e.target.value)} />
              </label>
            </div>
          </Card>

          {/* Guidelines */}
          <Card>
            <div className="label mb-1">Brand guidelines</div>
            <p className="mb-3 text-xs text-zinc-500">Fonts, logo rules, do’s and don’ts, example captions — anything a designer would need. Upload your brand book (PDF) or reference posts too; Claude reads them before every creative.</p>
            <textarea
              className="input min-h-[120px]"
              placeholder={'e.g.\n• Logo always top-left, never on busy photos\n• Headlines in sentence case, max 8 words\n• Never use red — reads as “error” for our audience'}
              value={cur.guidelines ?? ''}
              onChange={(e) => set('guidelines', e.target.value)}
            />
            <input ref={guideRef} type="file" multiple accept=".pdf,image/*,.txt,.md" className="hidden" onChange={(e) => { upload('guide', e.target.files); e.target.value = '' }} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(cur.guideFiles ?? []).map((f) => (
                <span key={f.path} className="chip">
                  <FileText size={12} className="text-zinc-400" />
                  <a href={uploadUrl(f.path)} target="_blank" rel="noreferrer" className="max-w-[200px] truncate hover:text-white">{f.name}</a>
                  <button onClick={() => set('guideFiles', (cur.guideFiles ?? []).filter((x) => x.path !== f.path))} className="text-zinc-500 hover:text-flare" aria-label={`Remove ${f.name}`}><X size={11} /></button>
                </span>
              ))}
              <button onClick={() => guideRef.current?.click()} disabled={busy === 'guide'} className="btn-ghost py-1.5 text-xs">
                {busy === 'guide' ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />} Upload brand book / references
              </button>
            </div>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <div className="label mb-3">Services</div>
              <TagList items={cur.services} onChange={(v) => set('services', v)} placeholder="Add a service" />
            </Card>
            <Card>
              <div className="label mb-3">Tone of voice</div>
              <TagList items={cur.tone} onChange={(v) => set('tone', v)} placeholder="e.g. Playful" />
              <div className="label mb-3 mt-5">Never do</div>
              <TagList items={cur.avoid} onChange={(v) => set('avoid', v)} placeholder="e.g. Use slang" />
            </Card>
          </div>

          {!sub && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div className="label">Learned playbook</div>
                <span className="font-mono text-[11px] text-zinc-500">updated Mon 19 Oct · from 41 posts</span>
              </div>
              <div className="space-y-3">
                {playbook.map((p, i) => (
                  <div key={p.rule} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="font-display text-sm font-bold text-zinc-400">#{i + 1}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-100">{p.rule}</div>
                        <div className="mt-0.5 text-xs text-zinc-500">{p.evidence}</div>
                      </div>
                      <div className="w-20 text-right">
                        <div className="font-mono text-xs text-zinc-300">{Math.round(p.confidence * 100)}%</div>
                        <div className="mt-1 h-1 rounded-full bg-white/[0.06]">
                          <div className="h-1 rounded-full bg-volt" style={{ width: `${p.confidence * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {/* Logo */}
          <Card>
            <div className="label mb-3">Logo</div>
            <input ref={logoRef} type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden" onChange={(e) => { upload('logo', e.target.files); e.target.value = '' }} />
            {cur.logo ? (
              <div className="flex items-center gap-3">
                <div className="grid h-20 flex-1 place-items-center rounded-xl border border-white/[0.07] p-3" style={{ background: cur.colors.bg }}>
                  <img src={uploadUrl(cur.logo)} alt={`${cur.name} logo`} className="max-h-14 max-w-full object-contain" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => logoRef.current?.click()} className="btn-ghost px-3 py-1.5 text-xs">Replace</button>
                  <button onClick={() => set('logo', undefined)} className="btn-ghost px-3 py-1.5 text-xs">Remove</button>
                </div>
              </div>
            ) : (
              <button onClick={() => logoRef.current?.click()} disabled={busy === 'logo'} className="grid h-24 w-full place-items-center rounded-xl border border-dashed border-white/15 text-sm text-zinc-400 transition hover:border-white/30 hover:text-white">
                <span className="flex items-center gap-2">{busy === 'logo' ? <RefreshCw size={16} className="animate-spin" /> : <ImagePlus size={16} />} Upload logo</span>
              </button>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-zinc-400">Size on posts</span>
              <div className="ml-auto flex rounded-lg border border-white/10 p-0.5">
                {(['small', 'medium', 'large'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => set('logoSize', sz)}
                    className={cn('rounded-md px-2.5 py-1 text-xs capitalize transition', (cur.logoSize ?? 'large') === sz ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-200')}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">Any image works — a solid background (e.g. logo on black) is removed automatically. Placed on every post, carousel and reel.</p>
          </Card>

          {/* Colours */}
          <Card>
            <div className="label mb-1">Brand colours</div>
            <p className="mb-3 text-[11px] text-zinc-500">Click a swatch or type a hex code. Every post is designed with these.</p>
            <div className="space-y-2">
              {(Object.keys(cur.colors) as (keyof Brand['colors'])[]).map((k) => (
                <div key={k} className="flex items-center gap-3 rounded-xl border border-white/[0.07] p-2">
                  <input type="color" value={cur.colors[k]} onChange={(e) => set('colors', { ...cur.colors, [k]: e.target.value })} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent" aria-label={`${k} colour`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs capitalize text-zinc-200">{k === 'bg' ? 'Background' : k}</div>
                    <div className="truncate text-[10.5px] text-zinc-500">{colorHelp[k]}</div>
                  </div>
                  <input
                    className="input w-[92px] px-2 py-1.5 font-mono text-xs uppercase"
                    defaultValue={cur.colors[k]}
                    key={active + k + cur.colors[k]}
                    onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value.trim()) && set('colors', { ...cur.colors, [k]: e.target.value.trim() })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="label mb-3">Live preview</div>
            <PostCanvas c={sample} brand={cur} />
          </Card>
        </div>
      </div>
    </div>
  )
}
