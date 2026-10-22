import { Check, Cpu, Instagram, KeyRound, MessageCircle, Mic, Plug, Search, Send, Sparkles, Terminal, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { serverStatus } from '../engine'
import { useStore } from '../store'
import { Badge, Card, cn, PageHeader } from '../ui'

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('relative h-6 w-11 rounded-full transition', on ? 'bg-volt' : 'bg-white/10')} aria-pressed={on}>
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', on ? 'left-[22px] bg-ink-950' : 'left-0.5')} />
    </button>
  )
}

export default function SettingsPage() {
  const { igConnected, setIgConnected, brand } = useStore()
  const [engine, setEngine] = useState<'local' | 'api'>('local')
  const [rules, setRules] = useState({ posts: true, carousels: true, motion: true, trendReels: false, approval: true })
  // Live status of server-side integrations (keys live in server/.env, never in the browser).
  const [health, setHealth] = useState<{ aiImages?: boolean; publishing?: boolean }>({})
  useEffect(() => {
    fetch('/api/health').then((r) => (r.ok ? r.json() : {})).then(setHealth, () => {})
  }, [])

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Connections & autopilot" desc="Hook RYPL up to Instagram, choose how the AI engine runs, and decide what gets auto-posted." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-flare/40 to-pulse/30 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white">
              <Instagram size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-white">Instagram</div>
                {igConnected ? <Badge tone="volt"><Check size={11} /> Connected</Badge> : <Badge tone="zinc">Not connected</Badge>}
              </div>
              <p className="mt-1 text-sm text-zinc-400">Insights (views, reach, watch time, shares, saves), comments → CRM, and publishing for posts, carousels, reels and stories.</p>
              <ol className="mt-3 space-y-1 text-xs text-zinc-500">
                <li>1. Switch your account to <b className="text-zinc-300">Business</b> or <b className="text-zinc-300">Creator</b></li>
                <li>2. Create a Meta app → add Instagram API (Instagram Login)</li>
                <li>3. Paste App ID & secret in <code className="text-surge">server/.env</code>, then click Connect</li>
              </ol>
              <button
                onClick={async () => {
                  // Real OAuth when the local server is running; demo toggle otherwise
                  if (!igConnected && (await serverStatus())) window.location.href = '/api/instagram/login'
                  else setIgConnected(!igConnected)
                }}
                className={cn('mt-4', igConnected ? 'btn-ghost' : 'btn-volt')}>
                {igConnected ? `Disconnect ${brand.handle}` : 'Connect Instagram'}
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="label mb-3">AI engine</div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[
              { id: 'local' as const, icon: Terminal, t: 'Claude Code (local)', d: 'Runs `claude -p` on your machine. Uses your Claude plan. Best while building.' },
              { id: 'api' as const, icon: KeyRound, t: 'Claude API key', d: 'For the SaaS version. Pay per use, runs on a server for all clients.' },
            ].map(({ id, icon: Icon, t, d }) => (
              <button key={id} onClick={() => setEngine(id)} className={cn('rounded-xl border p-3.5 text-left transition', engine === id ? 'border-volt/40 bg-volt/[0.06]' : 'border-white/[0.07] hover:border-white/15')}>
                <Icon size={17} className={engine === id ? 'text-volt' : 'text-zinc-400'} />
                <div className="mt-2 text-sm font-semibold text-white">{t}</div>
                <div className="mt-1 text-xs text-zinc-500">{d}</div>
              </button>
            ))}
          </div>
          {engine === 'api' && <input className="input mt-3 font-mono" placeholder="sk-ant-…  (stored in server/.env, never in the browser)" />}
        </Card>

        <Card>
          <div className="label mb-4">Auto-publish rules</div>
          <div className="space-y-3.5">
            {[
              ['posts', 'Static posts', 'Auto-publish at best slot'],
              ['carousels', 'Carousels', 'Auto-publish at best slot'],
              ['motion', 'Motion reels (own audio)', 'Rendered by Remotion, auto-publish'],
              ['trendReels', 'Reels with trending audio', 'API can’t add IG library audio — post manually'],
              ['approval', 'Require my approval first', 'WhatsApp ping before anything goes live'],
            ].map(([k, t, d]) => (
              <div key={k} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm text-zinc-100">{t}</div>
                  <div className="text-xs text-zinc-500">{d}</div>
                </div>
                <Toggle on={rules[k as keyof typeof rules]} onClick={() => setRules({ ...rules, [k]: !rules[k as keyof typeof rules] })} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="label mb-4">Integrations</div>
          <div className="space-y-2.5">
            {[
              { icon: MessageCircle, n: 'WhatsApp', d: 'Approvals & alerts to your phone', on: true, c: '#25D366' },
              { icon: Search, n: 'Apify', d: 'Competitor & viral reel scraping', on: true, c: '#A3B1FF' },
              { icon: Sparkles, n: 'AI pictures (OpenAI)', d: health.aiImages ? 'Claude adds a generated picture when a post needs one' : 'Add OPENAI_API_KEY to server/.env', on: !!health.aiImages, c: '#A3B1FF' },
              { icon: Send, n: 'Instagram publishing (Cloudinary)', d: health.publishing ? 'Approved posts go out at their scheduled time' : 'Add Cloudinary keys to server/.env', on: !!health.publishing, c: '#7DBFCF' },
              { icon: Mic, n: 'Voiceover', d: 'AI VO for motion reels', on: false, c: '#9D8FE0' },
              { icon: Upload, n: 'Google Drive', d: 'Back up rendered creatives', on: false, c: '#D4A86A' },
              { icon: Cpu, n: 'Remotion', d: 'Local video rendering', on: true, c: '#E58A98' },
            ].map(({ icon: Icon, n, d, on, c }) => (
              <div key={n} className="flex items-center gap-3 rounded-xl border border-white/[0.06] p-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: c + '1a', color: c }}><Icon size={16} /></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-100">{n}</div>
                  <div className="text-xs text-zinc-500">{d}</div>
                </div>
                {on ? <Badge tone="volt">Active</Badge> : <button className="btn-ghost px-3 py-1 text-xs">Connect</button>}
              </div>
            ))}
            <Link to="/actions" className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 p-3 transition hover:border-white/25">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-zinc-300"><Plug size={16} /></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-100">Your CRM or any API</div>
                <div className="text-xs text-zinc-500">HubSpot, Zoho, webhooks, your own product — use them in Flows</div>
              </div>
              <span className="btn-ghost px-3 py-1 text-xs">Set up</span>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
