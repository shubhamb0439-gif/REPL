import { Check, FlaskConical, Pencil, Plug, Plus, RefreshCw, Trash2, Waypoints, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteAction, listActions, saveAction, testAction, type ActionResult, type CustomAction } from '../engine'
import { Badge, Card, cn, PageHeader } from '../ui'

// Starting points. Endpoints follow each provider's public API docs — check yours (region, API version) before going live.
const templates: { id: string; label: string; desc: string; action: CustomAction }[] = [
  {
    id: 'webhook',
    label: 'Webhook',
    desc: 'Zapier, Make, n8n, Pabbly — then route anywhere',
    action: {
      name: 'Send to webhook',
      method: 'POST',
      url: 'https://hooks.zapier.com/hooks/catch/123456/abcdef/',
      headers: [],
      body: '{\n  "name": "{{lead.name}}",\n  "handle": "{{lead.handle}}",\n  "phone": "{{lead.phone}}",\n  "message": "{{lead.message}}",\n  "source": "{{lead.source}}"\n}',
    },
  },
  {
    id: 'hubspot',
    label: 'HubSpot',
    desc: 'Create a contact (private app token)',
    action: {
      name: 'HubSpot — create contact',
      method: 'POST',
      url: 'https://api.hubapi.com/crm/v3/objects/contacts',
      headers: [{ key: 'Authorization', value: 'Bearer YOUR_PRIVATE_APP_TOKEN' }],
      body: '{\n  "properties": {\n    "firstname": "{{lead.name}}",\n    "email": "{{lead.email}}",\n    "phone": "{{lead.phone}}"\n  }\n}',
    },
  },
  {
    id: 'zoho',
    label: 'Zoho CRM',
    desc: 'Create a lead (India data centre)',
    action: {
      name: 'Zoho CRM — create lead',
      method: 'POST',
      url: 'https://www.zohoapis.in/crm/v2/Leads',
      headers: [{ key: 'Authorization', value: 'Zoho-oauthtoken YOUR_ACCESS_TOKEN' }],
      body: '{\n  "data": [{\n    "Last_Name": "{{lead.name}}",\n    "Phone": "{{lead.phone}}",\n    "Email": "{{lead.email}}",\n    "Lead_Source": "{{lead.source}}",\n    "Description": "{{lead.message}}"\n  }]\n}',
    },
  },
  {
    id: 'custom',
    label: 'Custom API',
    desc: 'Your own product or any REST endpoint',
    action: {
      name: 'My API',
      method: 'POST',
      url: 'https://api.example.com/v1/leads',
      headers: [{ key: 'Authorization', value: 'Bearer YOUR_API_KEY' }],
      body: '{\n  "name": "{{lead.name}}",\n  "message": "{{lead.message}}"\n}',
    },
  },
]

const variables = ['lead.name', 'lead.handle', 'lead.phone', 'lead.email', 'lead.message', 'lead.source', 'post.caption', 'post.url', 'post.format', 'brand.name']

function Editor({ initial, onSaved, onCancel }: { initial: CustomAction; onSaved: (a: CustomAction) => void; onCancel: () => void }) {
  const [a, setA] = useState<CustomAction>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof CustomAction>(k: K, v: CustomAction[K]) => setA({ ...a, [k]: v })

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      if (a.method !== 'GET' && a.body.trim()) JSON.parse(a.body.replace(/\{\{\s*[\w.]+\s*\}\}/g, 'x'))
      onSaved(await saveAction(a))
    } catch (e) {
      setError(e instanceof SyntaxError ? 'Body is not valid JSON.' : (e as Error).message)
    }
    setSaving(false)
  }

  return (
    <Card className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <div className="label mb-2">Name</div>
          <input className="input" value={a.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="block">
          <div className="label mb-2">Description (optional)</div>
          <input className="input" placeholder="Shown on the Flow block" value={a.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <select className="input w-28" value={a.method} onChange={(e) => set('method', e.target.value as CustomAction['method'])}>
          {['POST', 'GET', 'PUT', 'PATCH'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <input className="input font-mono text-xs" placeholder="https://…" value={a.url} onChange={(e) => set('url', e.target.value)} />
      </div>

      <div>
        <div className="label mb-2">Headers</div>
        <div className="space-y-2">
          {a.headers.map((h, i) => (
            <div key={i} className="flex gap-2">
              <input className="input w-48 font-mono text-xs" placeholder="Authorization" value={h.key} onChange={(e) => set('headers', a.headers.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
              <input className="input font-mono text-xs" placeholder="Bearer …" value={h.value} onChange={(e) => set('headers', a.headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <button onClick={() => set('headers', a.headers.filter((_, j) => j !== i))} className="btn-ghost px-2.5" aria-label="Remove header"><X size={14} /></button>
            </div>
          ))}
          <button onClick={() => set('headers', [...a.headers, { key: '', value: '' }])} className="btn-ghost py-1.5 text-xs"><Plus size={13} /> Add header</button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">Keys are stored on your machine in <code>server/actions.json</code> (git-ignored), never in the browser.</p>
      </div>

      {a.method !== 'GET' && (
        <div>
          <div className="label mb-2">Body (JSON)</div>
          <textarea className="input min-h-[160px] font-mono text-xs" value={a.body} onChange={(e) => set('body', e.target.value)} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-zinc-500">Insert:</span>
            {variables.map((v) => (
              <button key={v} onClick={() => set('body', a.body + `{{${v}}}`)} className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-400 hover:text-white">{`{{${v}}}`}</button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-flare">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !a.name || !a.url} className="btn-volt">{saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />} Save action</button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </Card>
  )
}

export default function Actions() {
  const [actions, setActions] = useState<CustomAction[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<CustomAction | null>(null)
  const [testing, setTesting] = useState('')
  const [results, setResults] = useState<Record<string, ActionResult | { error: string }>>({})

  const refresh = () => listActions().then(setActions, (e) => setLoadError(e.message))
  useEffect(() => {
    refresh()
  }, [])

  const test = async (id: string) => {
    setTesting(id)
    try {
      const r = await testAction(id)
      setResults((x) => ({ ...x, [id]: r }))
    } catch (e) {
      setResults((x) => ({ ...x, [id]: { error: (e as Error).message } }))
    }
    setTesting('')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Actions"
        title={<>Connect your <span className="text-gradient">stack</span>.</>}
        desc="Turn any CRM, webhook or API into an action. Saved actions appear as blocks in Flows — e.g. new IG comment → create a lead in your CRM."
        right={<Link to="/flows" className="btn-ghost"><Waypoints size={14} /> Open Flows</Link>}
      />

      {loadError && <Card className="mb-5 border-flare/30 text-sm text-zinc-300">{loadError}</Card>}

      {editing ? (
        <Editor
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      ) : (
        <>
          <div className="label mb-3">New action from a template</div>
          <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {templates.map((t) => (
              <button key={t.id} onClick={() => setEditing({ ...t.action })} disabled={!!loadError} className="glass glass-hover p-4 text-left disabled:opacity-50">
                <Plug size={16} className="text-zinc-400" />
                <div className="mt-2.5 text-sm font-semibold text-white">{t.label}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{t.desc}</div>
              </button>
            ))}
          </div>

          <div className="label mb-3">Your actions</div>
          {actions && !actions.length && <Card className="text-sm text-zinc-400">No actions yet — pick a template above to connect your first one.</Card>}
          <div className="space-y-3">
            {actions?.map((a) => {
              const r = results[a.id!]
              return (
                <Card key={a.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-zinc-300"><Plug size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white">{a.name}</div>
                      <div className="truncate font-mono text-[11px] text-zinc-500">{a.method} {a.url}</div>
                    </div>
                    <button onClick={() => test(a.id!)} disabled={testing === a.id} className="btn-ghost py-1.5 text-xs">
                      {testing === a.id ? <RefreshCw size={13} className="animate-spin" /> : <FlaskConical size={13} />} Test with sample lead
                    </button>
                    <button onClick={() => setEditing(a)} className="btn-ghost px-2.5 py-1.5" aria-label="Edit"><Pencil size={13} /></button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${a.name}"?`)) return
                        await deleteAction(a.id!)
                        refresh()
                      }}
                      className="btn-ghost px-2.5 py-1.5 hover:text-flare"
                      aria-label="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {r && (
                    <div className="mt-3 rounded-xl border border-white/[0.06] bg-ink-900/60 p-3">
                      {'error' in r ? (
                        <div className="text-xs text-flare">{r.error}</div>
                      ) : (
                        <>
                          <div className="mb-1.5 flex items-center gap-2 text-xs">
                            <Badge tone={r.ok ? 'surge' : 'flare'}>{r.status}</Badge>
                            <span className="text-zinc-500">{r.ms} ms</span>
                          </div>
                          <pre className={cn('max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px]', r.ok ? 'text-zinc-400' : 'text-flare/90')}>{r.body || '(empty response)'}</pre>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
