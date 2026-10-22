import { AnimatePresence, motion } from 'framer-motion'
import { Bot, CalendarClock, Check, ChevronLeft, ChevronRight, Copy, Plus, RefreshCw, Send, SkipForward, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { moments, type Moment } from '../data'
import {
  autoPlanWeek,
  deletePlanItem,
  fileUrl,
  generatePlanItem,
  getPlan,
  publishPlanItem,
  replanWeek,
  saveAutopilot,
  savePlanItem,
  type Format,
  type PlanItem,
  type PlanState,
  type PlanStatus,
  type Progress,
} from '../engine'
import { CreativeEditor } from '../components/CreativeEditor'
import { GenProgress } from '../components/GenProgress'
import { useStore } from '../store'
import { Badge, Card, cn, PageHeader } from '../ui'

const typeColor: Record<Moment['type'], string> = {
  festival: '#D4A86A',
  national: '#7DBFCF',
  global: '#9D8FE0',
  commerce: '#E58A98',
  awareness: '#A3B1FF',
}
const formatLabel: Record<Format, string> = { post: 'Post', carousel: 'Carousel', reel: 'Motion reel', shoot: 'Shoot brief' }
const formatDot: Record<Format, string> = { post: '#7DBFCF', carousel: '#9D8FE0', reel: '#A3B1FF', shoot: '#E58A98' }
const statusTone: Record<PlanStatus, 'zinc' | 'pulse' | 'amber' | 'surge' | 'volt' | 'flare'> = {
  Planned: 'zinc',
  Generating: 'pulse',
  'In review': 'amber',
  Approved: 'surge',
  Posted: 'volt',
  Failed: 'flare',
  Skipped: 'zinc',
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const nice = (k: string) => new Date(k + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

export default function CalendarPage() {
  const now = new Date()
  const today = iso(now)
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [plan, setPlan] = useState<PlanState | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<PlanItem | null>(null)
  const [planning, setPlanning] = useState(false)
  const [params] = useSearchParams()

  const refresh = useCallback(
    () =>
      getPlan().then(
        (p) => {
          setPlan(p)
          setError('')
          // keep the open drawer in sync with server-side status changes (e.g. Generating → In review)
          setOpen((o) => (o?.id ? p.items.find((x) => x.id === o.id) ?? o : o))
        },
        () => setError('Start the RYPL server (npm run dev) to plan and automate content.'),
      ),
    [],
  )
  const busy = !!plan && (plan.queue.busy !== null || plan.items.some((x) => x.status === 'Generating'))
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, busy || planning ? 2500 : 10000)
    return () => clearInterval(t)
  }, [refresh, busy, planning])
  useEffect(() => {
    if (params.get('review') && plan) {
      const first = plan.items.find((x) => x.status === 'In review')
      if (first) setOpen(first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, !!plan])

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7)) // Monday start
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
  const items = plan?.items ?? []
  const monthMoments = moments.filter((m) => m.date.startsWith(iso(first).slice(0, 7)))
  const review = items.filter((x) => x.status === 'In review')
  const s = plan?.settings

  const runAutoPlan = async () => {
    setPlanning(true)
    setError('')
    try {
      const from = items.some((x) => x.date === today && x.status !== 'Skipped') ? iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) : today
      await autoPlanWeek(from, s?.focus)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
    setPlanning(false)
  }
  const runReplan = async () => {
    if (!confirm('Replace upcoming auto-planned items that you haven’t approved with a fresh plan from your current Brand Brain? Items you added yourself and approved items are kept.')) return
    setPlanning(true)
    setError('')
    try {
      await replanWeek(today, s?.focus)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
    setPlanning(false)
  }
  const setAuto = async (patch: Partial<NonNullable<typeof s>>) => {
    await saveAutopilot(patch)
    refresh()
  }

  return (
    <div>
      <PageHeader
        eyebrow="Content calendar"
        title={month.toLocaleString('en', { month: 'long', year: 'numeric' })}
        desc="Your content plan. Autopilot plans the week, creates each piece a day ahead and puts it in review — you approve, it goes out. Click any day to add something yourself."
        right={
          <div className="flex gap-2">
            <button className="btn-ghost px-3" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <button className="btn-ghost" onClick={() => setMonth(new Date(now.getFullYear(), now.getMonth(), 1))}>Today</button>
            <button className="btn-ghost px-3" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
        }
      />
      {error && <Card className="mb-5 border-flare/30 text-sm text-zinc-300">{error}</Card>}

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-x-auto p-3 md:p-4">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 gap-1.5 pb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="label px-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((d) => {
                const k = iso(d)
                const inMonth = d.getMonth() === month.getMonth()
                const ms = moments.filter((m) => m.date === k)
                const cs = items.filter((c) => c.date === k)
                return (
                  <div
                    key={k}
                    onClick={() => plan && k >= today && setOpen({ date: k, time: '19:00', format: 'post', title: '', status: 'Planned', source: 'manual', occasion: ms[0]?.name })}
                    className={cn(
                      'group min-h-[112px] rounded-xl border p-2 transition',
                      inMonth ? 'border-white/[0.06] bg-white/[0.015] hover:border-white/15' : 'border-transparent opacity-30',
                      k === today && 'border-volt/40 bg-volt/[0.04]',
                      plan && k >= today && 'cursor-pointer',
                    )}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className={cn('font-mono text-xs', k === today ? 'font-bold text-volt' : 'text-zinc-500')}>{d.getDate()}</span>
                      {plan && k >= today && <Plus size={12} className="text-zinc-600 opacity-0 transition group-hover:opacity-100" />}
                    </div>
                    <div className="space-y-1">
                      {ms.map((m) => (
                        <div key={m.name} className="truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: typeColor[m.type] + '1f', color: typeColor[m.type] }}>
                          {m.name}
                        </div>
                      ))}
                      {cs.map((c) => (
                        <button
                          key={c.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpen(c)
                          }}
                          className={cn('flex w-full items-center gap-1 truncate rounded-md px-1 py-0.5 text-left text-[10.5px] hover:bg-white/[0.06]', c.status === 'Skipped' ? 'text-zinc-600 line-through' : 'text-zinc-300')}
                        >
                          {c.status === 'Generating' ? (
                            <RefreshCw size={9} className="shrink-0 animate-spin text-pulse" />
                          ) : (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: formatDot[c.format] }} />
                          )}
                          <span className="truncate">{c.title}</span>
                          {c.status === 'In review' && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" title="Needs review" />}
                          {c.status === 'Failed' && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-flare" title="Failed" />}
                          {(c.status === 'Approved' || c.status === 'Posted') && <Check size={10} className="ml-auto shrink-0 text-surge" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {/* Autopilot */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="label flex items-center gap-2"><Bot size={12} /> Autopilot</div>
              {s && (
                <button onClick={() => setAuto({ enabled: !s.enabled })} className={cn('relative h-6 w-11 rounded-full transition', s.enabled ? 'bg-volt' : 'bg-white/10')} aria-pressed={s.enabled} aria-label="Toggle autopilot">
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full transition', s.enabled ? 'left-[22px] bg-ink-950' : 'left-0.5 bg-white')} />
                </button>
              )}
            </div>
            {s ? (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-zinc-500">
                  {s.enabled
                    ? <>Every day after {s.hour}:00, RYPL creates what’s due {s.leadDays === 0 ? 'that day' : `in the next ${s.leadDays} day${s.leadDays > 1 ? 's' : ''}`} and puts it in review.{s.autoPlan && ' When the coming week is empty, it plans it.'}</>
                    : 'Off — nothing is created automatically. You can still generate items by hand.'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <div className="mb-1 text-[11px] text-zinc-500">Create ahead</div>
                    <select className="input py-1.5 text-xs" value={s.leadDays} onChange={(e) => setAuto({ leadDays: +e.target.value })}>
                      {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 0 ? 'Same day' : `${n} day${n > 1 ? 's' : ''} before`}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <div className="mb-1 text-[11px] text-zinc-500">Daily at</div>
                    <select className="input py-1.5 text-xs" value={s.hour} onChange={(e) => setAuto({ hour: +e.target.value })}>
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                    </select>
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input type="checkbox" checked={s.autoPlan} onChange={(e) => setAuto({ autoPlan: e.target.checked })} className="accent-[#A3B1FF]" />
                  Auto-plan empty weeks
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input type="checkbox" checked={s.autoPublish} onChange={(e) => setAuto({ autoPublish: e.target.checked })} className="accent-[#A3B1FF]" />
                  Auto-publish approved posts at their time
                </label>
                {!plan?.canPublish && <p className="text-[11px] text-amber-300/80">Publishing needs Cloudinary keys in server/.env (free) — until then, approved posts wait for you to post them.</p>}
                <input
                  className="input py-1.5 text-xs"
                  placeholder="Focus for planning, e.g. websites for gyms & clinics"
                  defaultValue={s.focus}
                  onBlur={(e) => e.target.value !== s.focus && setAuto({ focus: e.target.value })}
                />
                <button onClick={runAutoPlan} disabled={planning} className="btn-volt w-full py-2 text-xs">
                  {planning ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />} {planning ? 'Planning the week… (1–2 min)' : 'Auto-plan next 7 days'}
                </button>
                {items.some((x) => x.date >= today && x.source === 'auto-plan' && !['Approved', 'Posted'].includes(x.status)) && (
                  <button onClick={runReplan} disabled={planning} className="btn-ghost w-full py-2 text-xs">
                    <RefreshCw size={13} /> Re-plan upcoming (after a brand change)
                  </button>
                )}
                <p className="text-[11px] text-zinc-600">Runs while the RYPL server is running (npm run dev).</p>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">{error ? 'Server offline.' : 'Loading…'}</div>
            )}
          </Card>

          {/* Review queue */}
          <Card>
            <div className="label mb-3">Needs your review · {review.length}</div>
            {review.length === 0 && <div className="text-sm text-zinc-500">{busy ? 'Creating content now…' : 'Nothing waiting.'}</div>}
            <div className="space-y-1.5">
              {review.map((x) => (
                <button key={x.id} onClick={() => setOpen(x)} className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-white/[0.04]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: formatDot[x.format] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-200">{x.title}</span>
                    <span className="block text-[11px] text-zinc-500">{nice(x.date)} · {x.time} · {formatLabel[x.format]}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="label mb-3">This month's moments</div>
            {monthMoments.length === 0 && <div className="text-sm text-zinc-500">No major moments.</div>}
            <div className="space-y-2">
              {monthMoments.map((m) => (
                <div key={m.date} className="flex items-center gap-2.5 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ background: typeColor[m.type] }} />
                  <span className="flex-1 text-zinc-200">{m.name}</span>
                  {m.verify && <span title="Lunar calendar — verify date" className="font-mono text-[10px] text-amber-300">verify</span>}
                  <span className="font-mono text-xs text-zinc-500">{new Date(m.date).getDate()}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
              {(Object.keys(formatLabel) as Format[]).map((f) => (
                <span key={f} className="chip"><span className="h-2 w-2 rounded-full" style={{ background: formatDot[f] }} />{formatLabel[f]}</span>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <ItemDrawer
            key={open.id ?? 'new'}
            item={open}
            progress={open.id ? plan?.progress?.[open.id] : undefined}
            canPublish={!!plan?.canPublish}
            autoPublish={!!plan?.settings.autoPublish}
            onClose={() => setOpen(null)}
            onChanged={(it) => {
              setOpen(it)
              refresh()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ItemDrawer({ item, onClose, onChanged, canPublish, autoPublish, progress }: { item: PlanItem; onClose: () => void; onChanged: (it: PlanItem | null) => void; canPublish: boolean; autoPublish: boolean; progress?: Progress }) {
  const { brand } = useStore()
  const [d, setD] = useState<PlanItem>(item)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => setD((x) => ({ ...x, status: item.status, result: item.result, error: item.error, permalink: item.permalink, editedAt: item.editedAt })), [item.status, item.result, item.error, item.permalink, item.editedAt])
  const isNew = !item.id
  const dirty = isNew || (['date', 'time', 'format', 'title', 'angle', 'occasion', 'subBrandId', 'voiceover'] as const).some((k) => (d[k] ?? '') !== (item[k] ?? ''))
  const set = <K extends keyof PlanItem>(k: K, v: PlanItem[K]) => setD({ ...d, [k]: v })

  const act = async (fn: () => Promise<unknown>) => {
    setSaving(true)
    setErr('')
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    }
    setSaving(false)
  }
  const save = (patch: Partial<PlanItem> = {}) => act(async () => onChanged(await savePlanItem({ ...d, ...patch })))
  const generate = () =>
    act(async () => {
      const saved = dirty ? await savePlanItem(d) : d
      await generatePlanItem(saved.id!)
      onChanged({ ...saved, status: 'Generating' })
    })
  const r = d.result
  const ver = '?v=' + encodeURIComponent(d.editedAt ?? d.generatedAt ?? '') // bust the browser cache after edits
  const schedules = canPublish && autoPublish && d.format !== 'shoot'
  const pastDue = `${d.date} ${d.time}` <= `${iso(new Date())} ${new Date().toTimeString().slice(0, 5)}`

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l border-white/10 bg-ink-900 p-6"
        initial={{ x: 520 }}
        animate={{ x: 0 }}
        exit={{ x: 520 }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
      >
        <button className="absolute right-5 top-5 text-zinc-400 hover:text-white" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="flex items-center gap-2">
          <div className="label">{isNew ? 'New plan item' : nice(d.date)}</div>
          {!isNew && <Badge tone={statusTone[d.status]}>{d.status === 'Generating' && <RefreshCw size={10} className="animate-spin" />}{d.status}</Badge>}
          {d.source === 'auto-plan' && <Badge tone="zinc">Auto-planned</Badge>}
        </div>

        <div className="mt-4 space-y-3">
          <input className="input text-base font-semibold" placeholder="Hook / title — e.g. Your website loses leads at night" value={d.title} onChange={(e) => set('title', e.target.value)} />
          <textarea className="input min-h-[70px] text-sm" placeholder="Angle — what should it say or show? (optional)" value={d.angle ?? ''} onChange={(e) => set('angle', e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <input type="date" className="input py-2 text-xs" value={d.date} onChange={(e) => set('date', e.target.value)} />
            <input type="time" className="input py-2 text-xs" value={d.time} onChange={(e) => set('time', e.target.value)} />
            <select className="input py-2 text-xs" value={d.format} onChange={(e) => set('format', e.target.value as Format)}>
              {(Object.keys(formatLabel) as Format[]).map((f) => <option key={f} value={f}>{formatLabel[f]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input py-2 text-xs" value={d.occasion ?? ''} onChange={(e) => set('occasion', e.target.value || undefined)}>
              <option value="">No occasion</option>
              {moments.filter((m) => m.date >= iso(new Date())).slice(0, 20).map((m) => <option key={m.date + m.name} value={m.name}>{m.name}</option>)}
            </select>
            <select className="input py-2 text-xs" value={d.subBrandId ?? ''} onChange={(e) => set('subBrandId', e.target.value || undefined)}>
              <option value="">{brand.name} (main)</option>
              {brand.subBrands?.map((sb) => <option key={sb.id} value={sb.id}>{sb.name}</option>)}
            </select>
          </div>
        </div>

        {d.format === 'reel' && (
          <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={!!d.voiceover} onChange={(e) => set('voiceover', e.target.checked || undefined)} className="accent-[#A3B1FF]" />
            Add AI voiceover <span className="text-xs text-zinc-500">— Claude writes the script, OpenAI voices it, music dips under it</span>
          </label>
        )}
        {err && <p className="mt-3 text-sm text-flare">{err}</p>}
        {d.status === 'Failed' && d.error && <div className="mt-4 rounded-xl border border-flare/30 bg-flare/[0.05] p-3 text-xs text-zinc-300">{d.error}</div>}

        {/* Actions */}
        <div className="mt-5 flex flex-wrap gap-2">
          {dirty && <button onClick={() => save()} disabled={saving || !d.title} className="btn-ghost"><Check size={14} /> {isNew ? 'Add to plan' : d.status === 'Approved' && (d.date !== item.date || d.time !== item.time) ? 'Reschedule' : 'Save changes'}</button>}
          {d.status !== 'Generating' && d.status !== 'Posted' && (
            <button onClick={generate} disabled={saving || !d.title} className={d.status === 'In review' ? 'btn-ghost' : 'btn-volt'}>
              <Wand2 size={14} /> {r ? 'Regenerate' : 'Create now'}
            </button>
          )}
          {d.status === 'In review' && (
            <button onClick={() => save({ status: 'Approved', error: undefined })} disabled={saving} className="btn-volt">
              <CalendarClock size={14} /> {schedules ? `Approve & schedule · ${nice(d.date)}, ${d.time}` : 'Approve'}
            </button>
          )}
          {(d.status === 'Approved' || d.status === 'In review') && !!r?.files?.length && d.format !== 'shoot' && (
            <button
              onClick={() =>
                confirm(`Post this to Instagram RIGHT NOW${schedules ? ` instead of at ${d.time} on ${nice(d.date)}` : ''}?`) &&
                act(async () => onChanged(await publishPlanItem((dirty ? await savePlanItem(d) : d).id!)))
              }
              disabled={saving || !canPublish}
              title={canPublish ? '' : 'Add Cloudinary keys to server/.env to publish directly'}
              className="btn-ghost"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} {saving ? 'Posting… (reels take 1–2 min)' : 'Post now instead'}
            </button>
          )}
          {d.status === 'Approved' && <button onClick={() => save({ status: 'Posted' })} disabled={saving} className="btn-ghost"><Check size={14} /> I posted it manually</button>}
          {!isNew && d.status !== 'Skipped' && d.status !== 'Posted' && <button onClick={() => save({ status: 'Skipped' })} disabled={saving} className="btn-ghost"><SkipForward size={14} /> Skip</button>}
          {!isNew && (
            <button
              onClick={() => confirm('Delete this item?') && act(async () => { await deletePlanItem(d.id!); onChanged(null); onClose() })}
              className="btn-ghost px-3 hover:text-flare"
              aria-label="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {d.status === 'Approved' && (
          schedules ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-surge/25 bg-surge/[0.06] p-3 text-sm text-zinc-200">
              <CalendarClock size={16} className="shrink-0 text-surge" />
              <span>
                {pastDue
                  ? <>Scheduled time has passed — this goes out within a minute. Change the date/time above to post it later.</>
                  : <>Scheduled: posts automatically on <b>{nice(d.date)} at {d.time}</b>. Change the date/time above to move it. Keep RYPL running (npm run dev).</>}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">
              {canPublish ? 'Auto-publish is off (Autopilot panel) — use "Post now", or turn it on to schedule.' : 'To publish straight from RYPL, add your Cloudinary keys to server/.env (free account). Until then, download it and post from the Instagram app.'}
            </p>
          )
        )}
        {d.status === 'In review' && schedules && (
          <p className="mt-3 text-xs text-zinc-500">Approving schedules it — it posts by itself on {nice(d.date)} at {d.time}. Nothing goes live until you approve.</p>
        )}
        {d.status === 'Posted' && d.permalink && (
          <a href={d.permalink} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-volt hover:underline"><Send size={13} /> View on Instagram</a>
        )}
        {d.error?.startsWith('Publishing failed') && d.status !== 'Posted' && <div className="mt-4 rounded-xl border border-flare/30 bg-flare/[0.05] p-3 text-xs text-zinc-300">{d.error}</div>}
        {d.status === 'Generating' && (
          <div className="mt-4">
            {progress || !item.generatingOn ? <GenProgress progress={progress} format={d.format} /> : <p className="rounded-xl border border-white/[0.07] p-3 text-sm text-zinc-300">Being created on <b>{item.generatingOn}</b> (the other laptop) — it’ll appear here when it’s ready.</p>}
            <p className="mt-2 text-[11px] text-zinc-500">You can close this panel — it keeps going in the background.</p>
          </div>
        )}

        {/* Result */}
        {r && (
          <div className="mt-6 space-y-4 border-t border-white/[0.06] pt-5">
            {!!r.files?.length && (
              <div className={cn('grid gap-2', r.files.length > 1 && 'grid-cols-2')}>
                {r.files.map((f) =>
                  f.endsWith('.mp4') ? (
                    <video key={f + ver} src={fileUrl(f) + ver} controls loop className="w-full rounded-xl" />
                  ) : (
                    <a key={f + ver} href={fileUrl(f) + ver} target="_blank" rel="noreferrer"><img src={fileUrl(f) + ver} alt="" className="w-full rounded-xl" /></a>
                  ),
                )}
              </div>
            )}
            {r.brief && (
              <div className="rounded-xl border border-white/[0.07] p-3 text-sm">
                <div className="label mb-1">Shoot brief · {r.brief.length}</div>
                <div className="font-semibold text-white">{r.brief.concept}</div>
                <div className="mt-2 text-zinc-300">Hook: “{r.brief.hook.line}”</div>
                <ol className="mt-2 space-y-1 text-xs text-zinc-400">
                  {r.brief.beats.map((b) => <li key={b.time}><span className="font-mono text-zinc-500">{b.time}</span> {b.action} — {b.say}</li>)}
                </ol>
              </div>
            )}
            {r.caption && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(r.caption + '\n\n' + (r.hashtags ?? []).join(' ')).catch(() => {})
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy caption'}
                </button>
              </div>
            )}
            {d.status !== 'Posted' && d.status !== 'Generating' && d.id && (
              <CreativeEditor item={{ ...item, ...d, id: d.id }} progress={progress} onChanged={(it) => onChanged(it)} />
            )}
            {d.status === 'Posted' && r.caption && <p className="whitespace-pre-line text-sm text-zinc-300">{r.caption}</p>}
            {!!r.rationale?.length && (
              <div>
                <div className="label mb-1.5">Why this should work</div>
                <ul className="space-y-1 text-xs text-zinc-400">{r.rationale.map((x) => <li key={x}>• {x}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </>
  )
}
