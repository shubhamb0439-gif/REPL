import { ImagePlus, Mic, PenLine, RefreshCw, Save, Sparkles, Type } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { assetUrl, editPlanItem, getEditable, revisePlanItem, uploadFile, type Editable, type PlanItem, type Progress, type VoiceSpec } from '../engine'
import { GenProgress } from './GenProgress'

/** Edit a finished creative: caption, text on the design, pictures, or "ask AI to change…". */
export function CreativeEditor({ item, progress, onChanged }: { item: PlanItem; progress?: Progress; onChanged: (it: PlanItem) => void }) {
  const r = item.result!
  const [caption, setCaption] = useState(r.caption ?? '')
  const [tags, setTags] = useState((r.hashtags ?? []).join(' '))
  const [ed, setEd] = useState<Editable | null>(null)
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [images, setImages] = useState<Record<string, string>>({})
  const [ask, setAsk] = useState('')
  const [voice, setVoice] = useState<VoiceSpec | null>(null) // edited copy of the voiceover; null = unchanged
  const [busy, setBusy] = useState<'' | 'caption' | 'design' | 'ai'>('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const swapFor = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const reel = item.format === 'reel'

  const load = () => getEditable(item.id!).then(setEd, () => setEd(null))
  useEffect(() => {
    load()
    setCaption(r.caption ?? '')
    setTags((r.hashtags ?? []).join(' '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.editedAt, item.generatedAt])

  const run = async (kind: typeof busy, fn: () => Promise<PlanItem>, done: string) => {
    setBusy(kind)
    setErr('')
    setMsg('')
    try {
      onChanged(await fn())
      setMsg(done)
      setTexts({})
      setImages({})
      setVoice(null)
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy('')
  }

  const captionDirty = caption !== (r.caption ?? '') || tags !== (r.hashtags ?? []).join(' ')
  const designDirty = Object.keys(texts).length + Object.keys(images).length > 0 || !!voice
  const v = voice ?? ed?.voice ?? null
  const editVoice = (patch: Partial<VoiceSpec>) => setVoice({ ...(voice ?? ed!.voice!), ...patch })
  const parts = ed ? [...new Set(ed.texts.map((t) => t.part).concat(ed.images.map((i) => i.part)))] : []

  return (
    <div className="space-y-5">
      {/* Caption */}
      <div>
        <div className="label mb-1.5 flex items-center gap-1.5"><PenLine size={11} /> Caption</div>
        <textarea className="input min-h-[120px] text-sm" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <input className="input mt-2 font-mono text-xs" placeholder="#hashtags separated by spaces" value={tags} onChange={(e) => setTags(e.target.value)} />
        {captionDirty && (
          <button
            disabled={!!busy}
            onClick={() => run('caption', () => editPlanItem({ id: item.id!, caption, hashtags: tags.split(/\s+/).filter(Boolean).map((h) => (h.startsWith('#') ? h : '#' + h)) }), 'Caption saved.')}
            className="btn-ghost mt-2 py-1.5 text-xs"
          >
            {busy === 'caption' ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />} Save caption
          </button>
        )}
      </div>

      {/* Text + pictures on the design */}
      {ed && (ed.texts.length > 0 || ed.images.length > 0) && (
        <div>
          <div className="label mb-1.5 flex items-center gap-1.5"><Type size={11} /> Text & pictures on the {reel ? 'reel' : 'design'}</div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f || !swapFor.current) return
            try {
              const p = await uploadFile(f)
              setImages((x) => ({ ...x, [swapFor.current!]: p }))
            } catch (er) {
              setErr((er as Error).message)
            }
          }} />
          <div className="space-y-3">
            {parts.map((part) => (
              <div key={part} className="rounded-xl border border-white/[0.06] p-3">
                {parts.length > 1 && <div className="mb-2 text-[11px] font-medium text-zinc-400">{part}</div>}
                <div className="space-y-1.5">
                  {ed.texts.filter((t) => t.part === part).map((t) => (
                    <input
                      key={t.id}
                      className="input py-1.5 text-sm"
                      value={texts[t.id] ?? t.text}
                      onChange={(e) => setTexts((x) => (e.target.value === t.text ? (({ [t.id]: _, ...rest }) => rest)(x) : { ...x, [t.id]: e.target.value }))}
                    />
                  ))}
                </div>
                {ed.images.filter((i) => i.part === part).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ed.images.filter((i) => i.part === part).map((i) => (
                      <button
                        key={i.id}
                        onClick={() => {
                          swapFor.current = i.id
                          fileRef.current?.click()
                        }}
                        className="group relative h-20 w-16 overflow-hidden rounded-lg border border-white/10"
                        title="Replace this picture"
                      >
                        <img src={assetUrl(images[i.id] ?? i.path) + `?v=${item.editedAt ?? item.generatedAt ?? ''}`} alt="" className="h-full w-full object-cover" />
                        <span className="absolute inset-0 grid place-items-center bg-black/60 text-white opacity-0 transition group-hover:opacity-100"><ImagePlus size={16} /></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {designDirty && (
            <button
              disabled={!!busy}
              onClick={() => run('design', () => editPlanItem({ id: item.id!, texts: Object.entries(texts).map(([id, text]) => ({ id, text })), images: Object.entries(images).map(([id, path]) => ({ id, path })), ...(voice ? { voice } : {}) }), voice ? 'Voiceover re-recorded and reel re-rendered.' : 'Updated and re-rendered.')}
              className="btn-volt mt-3 py-2 text-xs"
            >
              {busy === 'design' ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              {busy === 'design' ? (reel ? 'Re-rendering the reel… (1–2 min)' : 'Re-rendering…') : 'Apply changes & re-render'}
            </button>
          )}
        </div>
      )}
      {/* Voiceover */}
      {v && (
        <div>
          <div className="label mb-1.5 flex items-center gap-1.5"><Mic size={11} /> Voiceover</div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <select className="input py-1.5 text-xs" value={v.voice} onChange={(e) => editVoice({ voice: e.target.value })}>
              {['ash', 'echo', 'onyx', 'ballad', 'verse', 'alloy', 'coral', 'nova', 'shimmer', 'sage', 'fable'].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input className="input py-1.5 text-xs" placeholder="Tone, e.g. warm, confident, Indian English accent" value={v.style} onChange={(e) => editVoice({ style: e.target.value })} />
          </div>
          <div className="mt-2 space-y-1.5">
            {v.lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-right font-mono text-[10.5px] text-zinc-500">{l.t.toFixed(1)}s</span>
                <input className="input py-1.5 text-sm" value={l.text} onChange={(e) => editVoice({ lines: v.lines.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">Small wording or voice changes re-record instantly. For a different script, ask AI below so the animation is re-timed too.</p>
        </div>
      )}

      {designDirty && !ed?.texts.length && !ed?.images.length && (
        <button disabled={!!busy} onClick={() => run('design', () => editPlanItem({ id: item.id!, ...(voice ? { voice } : {}) }), 'Voiceover re-recorded and reel re-rendered.')} className="btn-volt py-2 text-xs">
          {busy === 'design' ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />} {busy === 'design' ? 'Re-recording & re-rendering… (1–2 min)' : 'Apply & re-render'}
        </button>
      )}

      {!ed && <p className="text-xs text-zinc-500">This one was made with an older template — use “Ask AI to change” below, or Regenerate.</p>}

      {/* AI change */}
      <div>
        <div className="label mb-1.5 flex items-center gap-1.5"><Sparkles size={11} /> Ask AI to change something</div>
        <div className="flex gap-2">
          <input
            className="input text-sm"
            placeholder={reel ? 'e.g. make the hook faster, swap the music to lofi, change the voiceover line 2' : 'e.g. make the logo bigger, use a black background, move the CTA up'}
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask.trim() && !busy && run('ai', () => revisePlanItem(item.id!, ask), 'Changed and re-rendered.').then(() => setAsk(''))}
          />
          <button disabled={!ask.trim() || !!busy} onClick={() => run('ai', () => revisePlanItem(item.id!, ask), 'Changed and re-rendered.').then(() => setAsk(''))} className="btn-ghost shrink-0 px-3 text-xs">
            {busy === 'ai' ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />} Change
          </button>
        </div>
        {busy === 'ai' && <div className="mt-3"><GenProgress progress={progress} format={item.format} /></div>}
      </div>

      {msg && <p className="text-xs text-surge">{msg}</p>}
      {err && <p className="text-xs text-flare">{err}</p>}
    </div>
  )
}
