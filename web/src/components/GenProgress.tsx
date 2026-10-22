import { Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PROGRESS_PCT, PROGRESS_STAGES, type Format, type Progress } from '../engine'
import { cn } from '../ui'

const typical: Record<Format, string> = { post: 'usually 1–2 min', carousel: 'usually 2–3 min', reel: 'usually 5–12 min', shoot: 'usually about 1 min' }
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`

/** Live progress for a generation: bar, current stage, and the steps Claude has taken so far. */
export function GenProgress({ progress, format }: { progress?: Progress | null; format: Format }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const started = progress ? +new Date(progress.startedAt) : now
  const elapsed = (now - started) / 1000
  const stage = progress?.stage ?? 0
  // Creep forward inside the current stage so the bar never looks frozen during long "thinking" steps.
  const base = PROGRESS_PCT[stage] ?? 0
  const next = PROGRESS_PCT[stage + 1] ?? 100
  const sinceStep = progress ? (now - +new Date(progress.lastStepAt)) / 1000 : elapsed
  const pct = progress?.done ? 100 : Math.min(next - 2, base + (next - base - 2) * (1 - Math.exp(-sinceStep / (format === 'reel' ? 120 : 45))))
  const quiet = !progress?.done && sinceStep > 20

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 font-medium text-zinc-200">
          {!progress?.done && <Loader2 size={13} className="animate-spin text-volt" />}
          {progress?.error ? 'Stopped' : progress?.label ?? 'Starting Claude…'}
        </span>
        <span className="font-mono text-zinc-500">{mmss(elapsed)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={cn('h-full rounded-full transition-[width] duration-1000 ease-out', progress?.error ? 'bg-flare' : 'bg-volt')} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-zinc-500">
        <span>{PROGRESS_STAGES[stage]} · step {Math.min(stage + 1, PROGRESS_STAGES.length)} of {PROGRESS_STAGES.length}</span>
        <span>{typical[format]}</span>
      </div>
      {quiet && <p className="mt-2 text-[11px] text-zinc-500">Claude is working on the design — the thinking steps are the longest part.</p>}

      {!!progress?.steps.length && (
        <ol className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
          {progress.steps.map((s, i) => {
            const last = i === progress.steps.length - 1 && !progress.done
            return (
              <li key={i} className="flex items-start gap-2 text-xs">
                {last ? <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin text-volt" /> : <Check size={12} className="mt-0.5 shrink-0 text-surge" />}
                <span className={cn('flex-1', last ? 'text-zinc-200' : 'text-zinc-400')}>{s.label}</span>
                <span className="font-mono text-[10px] text-zinc-600">{mmss((+new Date(s.at) - started) / 1000)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
