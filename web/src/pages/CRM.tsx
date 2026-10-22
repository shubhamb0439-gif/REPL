import { AnimatePresence, motion } from 'framer-motion'
import { Bot, ExternalLink, Instagram, Linkedin, MapPin, MessageCircle, Phone, Plus, RefreshCw, Search, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { stages, type Lead, type Stage } from '../data'
import { igLeads, type IgLead } from '../engine'
import { useStore } from '../store'
import { Badge, Card, cn, PageHeader } from '../ui'

const stageColor: Record<Stage, string> = { New: '#a1a1aa', Contacted: '#7DBFCF', Demo: '#9D8FE0', Pilot: '#D4A86A', Won: '#A3B1FF' }
const srcIcon = { 'IG Comment': Instagram, 'IG DM': Instagram, Recipto: Bot, LinkedIn: Linkedin, 'Google Maps': MapPin, Referral: UserRound }
const prodTone = { Recipto: 'surge', RYPL: 'volt', Tours: 'pulse' } as const
const inr = (n: number) => '₹' + n.toLocaleString('en-IN')
const ago = (iso: string) => {
  const m = Math.round((Date.now() - +new Date(iso)) / 60000)
  return m < 60 ? `${Math.max(m, 1)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
}
const isSample = (l: Lead) => /^l[1-9]$/.test(l.id) // seed demo leads

// Merge Instagram commenters into the pipeline: new people land in "New"; existing ones keep their stage.
function mergeIg(current: Lead[], ig: IgLead[]): Lead[] {
  const next = current.filter((l) => !isSample(l))
  for (const x of ig) {
    const id = 'ig_' + x.username
    const fields = {
      last: ago(x.latest.timestamp),
      note: `“${x.latest.text}” on “${x.latest.post.caption || 'your post'}”${x.comments.length > 1 ? ` (+${x.comments.length - 1} more)` : ''}`,
      link: x.latest.post.permalink,
    }
    const i = next.findIndex((l) => l.id === id)
    if (i >= 0) next[i] = { ...next[i], ...fields }
    else next.unshift({ id, name: '', company: '@' + x.username, niche: 'Instagram', source: 'IG Comment', value: 0, stage: 'New', product: [], city: '', instagram: x.username, ...fields })
  }
  return next
}

export default function CRM() {
  const { leads, setLeads } = useStore()
  const [q, setQ] = useState('')
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<Stage | null>(null)
  const [open, setOpen] = useState<Lead | null>(null)
  const [adding, setAdding] = useState(false)
  const { igConnected } = useStore()
  const [sync, setSync] = useState<{ state: 'idle' | 'syncing' | 'done' | 'error'; msg?: string }>({ state: 'idle' })

  const syncIg = () => {
    setSync({ state: 'syncing' })
    igLeads().then(
      (ig) => {
        setLeads(mergeIg(leads, ig))
        setSync({ state: 'done', msg: `${ig.length} people commented on your recent posts` })
      },
      (e) => setSync({ state: 'error', msg: e.message }),
    )
  }
  useEffect(() => {
    if (igConnected) syncIg()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igConnected])

  const filtered = leads.filter((l) => (l.name + l.company + l.niche + l.city).toLowerCase().includes(q.toLowerCase()))
  const pipeline = leads.filter((l) => l.stage !== 'Won').reduce((a, l) => a + l.value, 0)
  const mrr = leads.filter((l) => l.stage === 'Won').reduce((a, l) => a + l.value, 0)

  const move = (id: string, stage: Stage) => setLeads(leads.map((l) => (l.id === id ? { ...l, stage, last: 'just now' } : l)))

  return (
    <div>
      <PageHeader
        eyebrow="Leadflow CRM"
        title={<>Every ripple, <span className="text-gradient">a customer</span>.</>}
        desc="Everyone who comments on your Instagram posts lands here automatically. Drag cards to move them through your pipeline."
        right={<button className="btn-volt" onClick={() => setAdding(true)}><Plus size={15} /> Add lead</button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['Open pipeline', inr(pipeline) + '/mo'],
          ['Won MRR', inr(mrr) + '/mo'],
          ['Total leads', String(leads.length)],
          ['Demo → Won', (() => {
            const won = leads.filter((l) => l.stage === 'Won').length
            const reached = leads.filter((l) => ['Demo', 'Pilot', 'Won'].includes(l.stage)).length
            return reached ? Math.round((won / reached) * 100) + '%' : '—'
          })()],
        ].map(([a, b], i) => (
          <Card key={a} delay={i * 0.05} className="p-4">
            <div className="label">{a}</div>
            <div className={cn('mt-2 font-display text-xl font-bold md:text-2xl', i === 1 ? 'text-volt' : 'text-white')}>{b}</div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input className="input pl-10" placeholder="Search leads…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {igConnected ? (
          <button onClick={syncIg} disabled={sync.state === 'syncing'} className="btn-ghost py-2 text-xs">
            <RefreshCw size={13} className={cn(sync.state === 'syncing' && 'animate-spin')} /> Sync Instagram comments
          </button>
        ) : (
          <span className="text-xs text-zinc-500">Connect Instagram in Settings to pull in real leads.</span>
        )}
        {sync.msg && <span className={cn('text-xs', sync.state === 'error' ? 'text-flare' : 'text-zinc-500')}>{sync.msg}</span>}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((s) => {
          const items = filtered.filter((l) => l.stage === s)
          return (
            <div
              key={s}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(s)
              }}
              onDragLeave={() => setOver(null)}
              onDrop={() => {
                if (drag) move(drag, s)
                setDrag(null)
                setOver(null)
              }}
              className={cn('w-[272px] shrink-0 rounded-2xl border p-2.5 transition', over === s ? 'border-volt/40 bg-volt/[0.04]' : 'border-white/[0.05] bg-white/[0.012]')}
            >
              <div className="mb-3 flex items-center gap-2 px-1.5 pt-1">
                <span className="h-2 w-2 rounded-full" style={{ background: stageColor[s], boxShadow: `0 0 10px ${stageColor[s]}` }} />
                <span className="text-sm font-semibold text-zinc-100">{s}</span>
                <span className="font-mono text-xs text-zinc-500">{items.length}</span>
                <span className="ml-auto font-mono text-[11px] text-zinc-500">{inr(items.reduce((a, l) => a + l.value, 0))}</span>
              </div>
              <div className="min-h-[200px] space-y-2">
                {items.map((l) => {
                  const Src = srcIcon[l.source]
                  return (
                    <motion.div
                      layout
                      key={l.id}
                      draggable
                      onDragStart={() => setDrag(l.id)}
                      onClick={() => setOpen(l)}
                      className={cn('cursor-grab rounded-xl border border-white/[0.07] bg-ink-850 p-3 transition hover:border-white/20 active:cursor-grabbing', drag === l.id && 'opacity-40')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{l.company}</div>
                          {(l.name || l.city) && <div className="truncate text-xs text-zinc-400">{[l.name, l.city].filter(Boolean).join(' · ')}</div>}
                          {l.instagram && l.note && <div className="mt-1 line-clamp-2 text-xs text-zinc-400">{l.note}</div>}
                        </div>
                        {l.value > 0 && <div className="font-mono text-xs font-semibold text-zinc-200">{inr(l.value)}</div>}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {l.product.map((p) => (
                          <Badge key={p} tone={prodTone[p]}>{p}</Badge>
                        ))}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1"><Src size={11} /> {l.source}</span>
                        <span>{l.last}</span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} />
            <motion.div
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-white/10 bg-ink-900 p-6"
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            >
              <button className="absolute right-5 top-5 text-zinc-400 hover:text-white" onClick={() => setOpen(null)} aria-label="Close"><X size={18} /></button>
              <div className="label">{open.niche}</div>
              <h2 className="mt-1 font-display text-2xl font-bold text-white">{open.company}</h2>
              {(open.name || open.city) && <div className="text-sm text-zinc-400">{[open.name, open.city].filter(Boolean).join(' · ')}</div>}
              <div className="mt-5 grid grid-cols-3 gap-2">
                {open.instagram ? (
                  <>
                    <a href={`https://instagram.com/${open.instagram}`} target="_blank" rel="noreferrer" className="btn-ghost flex-col gap-1 py-3 text-xs"><Instagram size={16} className="text-volt" />Profile</a>
                    {open.link && <a href={open.link} target="_blank" rel="noreferrer" className="btn-ghost flex-col gap-1 py-3 text-xs"><ExternalLink size={16} className="text-surge" />Their comment</a>}
                    <a href={`https://ig.me/m/${open.instagram}`} target="_blank" rel="noreferrer" className="btn-ghost flex-col gap-1 py-3 text-xs"><MessageCircle size={16} className="text-pulse" />DM</a>
                  </>
                ) : (
                  <>
                    <button className="btn-ghost flex-col gap-1 py-3 text-xs"><MessageCircle size={16} className="text-volt" />WhatsApp</button>
                    <button className="btn-ghost flex-col gap-1 py-3 text-xs"><Phone size={16} className="text-surge" />Call</button>
                    <button className="btn-ghost flex-col gap-1 py-3 text-xs"><Bot size={16} className="text-pulse" />Notes</button>
                  </>
                )}
              </div>
              <div className="label mb-2 mt-6">Stage</div>
              <div className="flex flex-wrap gap-1.5">
                {stages.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      move(open.id, s)
                      setOpen({ ...open, stage: s })
                    }}
                    className={cn('rounded-lg border px-2.5 py-1 text-xs', open.stage === s ? 'border-volt/50 bg-volt/10 text-volt' : 'border-white/10 text-zinc-400')}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {!!open.product.length && (
                <>
                  <div className="label mb-2 mt-6">Interested in</div>
                  <div className="flex gap-1.5">{open.product.map((p) => <Badge key={p} tone={prodTone[p]}>{p}</Badge>)}</div>
                </>
              )}
              <div className="label mb-2 mt-6">Activity</div>
              <div className="space-y-3 border-l border-white/10 pl-4 text-sm">
                {open.note && <div><div className="text-zinc-200">{open.note}</div><div className="text-xs text-zinc-500">{open.last}</div></div>}
                <div><div className="text-zinc-200">Lead captured from {open.source}</div><div className="text-xs text-zinc-500">{open.instagram ? 'Synced from Instagram comments' : 'Added manually'}</div></div>
              </div>
              <div className="label mb-2 mt-6">AI next step</div>
              <div className="rounded-xl border border-volt/20 bg-volt/[0.05] p-3 text-sm text-zinc-300">
                {open.instagram
                  ? <>Reply to their comment and invite them to DM you — they’re already engaging with your content. Check their profile to see if they’re a business that fits your audience.</>
                  : <>Follow up within 24h with something specific to {open.company}{open.niche ? ` and the ${open.niche.toLowerCase()} space` : ''}.</>}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>{adding && <AddLead onClose={() => setAdding(false)} onAdd={(l) => setLeads([l, ...leads])} />}</AnimatePresence>
    </div>
  )
}

function AddLead({ onClose, onAdd }: { onClose: () => void; onAdd: (l: Lead) => void }) {
  const [f, setF] = useState({ name: '', company: '', niche: 'Clinic', city: '', value: '4999', phone: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
      <motion.div className="pointer-events-auto w-full max-w-md" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="glass bg-ink-900/95 p-6">
          <h3 className="font-display text-xl font-bold text-white">New lead</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <input className="input col-span-2" placeholder="Company" value={f.company} onChange={set('company')} />
            <input className="input" placeholder="Contact name" value={f.name} onChange={set('name')} />
            <input className="input" placeholder="City" value={f.city} onChange={set('city')} />
            <select className="input" value={f.niche} onChange={set('niche')}>
              {['Clinic', 'Salon', 'Gym', 'Coaching', 'Real estate', 'Restaurant', 'Other'].map((n) => <option key={n}>{n}</option>)}
            </select>
            <input className="input" placeholder="₹ / month" value={f.value} onChange={set('value')} />
            <input className="input col-span-2" placeholder="Phone / WhatsApp" value={f.phone} onChange={set('phone')} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn-volt"
              disabled={!f.company}
              onClick={() => {
                onAdd({ id: 'l' + Date.now(), name: f.name || '—', company: f.company, niche: f.niche, city: f.city || '—', value: Number(f.value) || 0, phone: f.phone, source: 'Referral', stage: 'New', product: ['Recipto'], last: 'just now' })
                onClose()
              }}
            >
              Add lead
            </button>
          </div>
        </div>
      </motion.div>
      </div>
    </>
  )
}
