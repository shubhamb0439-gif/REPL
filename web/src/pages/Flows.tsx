import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Activity,
  Brain,
  CalendarHeart,
  CheckCircle2,
  Clock,
  Film,
  GitBranch,
  Image,
  Instagram,
  MessageCircle,
  MessageSquareText,
  Play,
  Plug,
  Reply,
  Send,
  UserPlus,
  Webhook,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listActions, type CustomAction } from '../engine'
import { cn, PageHeader } from '../ui'

type Kind = 'trigger' | 'ai' | 'action' | 'logic'
const kindStyle: Record<Kind, { color: string; label: string }> = {
  trigger: { color: '#E58A98', label: 'Trigger' },
  ai: { color: '#A3B1FF', label: 'AI' },
  action: { color: '#7DBFCF', label: 'Action' },
  logic: { color: '#9D8FE0', label: 'Logic' },
}

const catalog = {
  holiday: { kind: 'trigger', title: 'Holiday', icon: CalendarHeart, sub: '3 days before a moment' },
  schedule: { kind: 'trigger', title: 'Schedule', icon: Clock, sub: 'Every Monday 9:00' },
  igComment: { kind: 'trigger', title: 'IG comment', icon: Instagram, sub: 'Contains keyword' },
  webhook: { kind: 'trigger', title: 'Webhook', icon: Webhook, sub: 'From any app' },
  brain: { kind: 'ai', title: 'Brand Brain', icon: Brain, sub: 'Load brand + playbook' },
  genPost: { kind: 'ai', title: 'Generate post', icon: Image, sub: 'Static / carousel' },
  genReel: { kind: 'ai', title: 'Generate reel', icon: Film, sub: 'Remotion render' },
  analyse: { kind: 'ai', title: 'Analyse reel', icon: Activity, sub: 'Retention + fixes' },
  approval: { kind: 'logic', title: 'Approval', icon: CheckCircle2, sub: 'You approve on WhatsApp' },
  branch: { kind: 'logic', title: 'If / else', icon: GitBranch, sub: 'Condition' },
  wait: { kind: 'logic', title: 'Wait', icon: Clock, sub: '48 hours' },
  publish: { kind: 'action', title: 'Publish to IG', icon: Send, sub: 'Instagram Graph API' },
  crm: { kind: 'action', title: 'Add to CRM', icon: UserPlus, sub: 'Stage: New' },
  igReply: { kind: 'action', title: 'Reply in DM', icon: Reply, sub: 'Instagram private reply' },
  whatsapp: { kind: 'action', title: 'WhatsApp me', icon: MessageCircle, sub: 'Send summary' },
  playbook: { kind: 'action', title: 'Update playbook', icon: MessageSquareText, sub: 'Learn from results' },
} as const
type CatKey = keyof typeof catalog
// k: 'custom' = a user-defined action from the Actions page (CRM, webhook, any API).
type NData = { k: CatKey | 'custom'; active?: boolean; sub?: string; title?: string; actionId?: string }
const customDef = (title = 'Custom action') => ({ kind: 'action' as const, title, icon: Plug, sub: 'Custom action' })
const defOf = (d: NData) => (d.k === 'custom' ? customDef(d.title) : catalog[d.k])

function RyplNode({ data, selected }: NodeProps<Node<NData>>) {
  const c = defOf(data)
  const ks = kindStyle[c.kind]
  const Icon = c.icon
  return (
    <div
      className={cn(
        'relative w-[210px] rounded-2xl border bg-ink-850/95 p-3 backdrop-blur transition',
        selected ? 'border-white/30' : 'border-white/10',
      )}
      style={{ boxShadow: data.active ? `0 0 0 2px ${ks.color}, 0 0 40px -4px ${ks.color}` : '0 10px 30px -10px rgba(0,0,0,.6)' }}
    >
      {c.kind !== 'trigger' && <Handle type="target" position={Position.Left} style={{ background: ks.color }} />}
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: ks.color + '1a', color: ks.color }}>
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: ks.color }}>{ks.label}</div>
          <div className="truncate text-[13px] font-semibold text-white">{c.title}</div>
        </div>
      </div>
      <div className="mt-2 truncate rounded-lg bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-400">{data.sub ?? c.sub}</div>
      <Handle type="source" position={Position.Right} style={{ background: ks.color }} />
    </div>
  )
}
const nodeTypes = { rypl: RyplNode }

const mk = (id: string, k: NData['k'], x: number, y: number, sub?: string, extra?: Partial<NData>): Node<NData> => ({ id, type: 'rypl', position: { x, y }, data: { k, sub, ...extra } })
const ed = (a: string, b: string): Edge => ({ id: a + '-' + b, source: a, target: b, style: { stroke: '#3A3A42' } })

const presets: Record<string, { name: string; nodes: Node<NData>[]; edges: Edge[] }> = {
  festival: {
    name: 'Festival autopilot',
    nodes: [
      mk('1', 'holiday', 0, 100, 'Diwali −3 days'),
      mk('2', 'brain', 250, 100),
      mk('3', 'genReel', 500, 20, 'Festive motion reel'),
      mk('4', 'genPost', 500, 180, 'Greeting post'),
      mk('5', 'approval', 750, 100),
      mk('6', 'publish', 1000, 100, 'Diwali 7:00 PM'),
      mk('7', 'wait', 1000, 300),
      mk('8', 'analyse', 750, 300),
      mk('9', 'playbook', 500, 340),
    ],
    edges: [ed('1', '2'), ed('2', '3'), ed('2', '4'), ed('3', '5'), ed('4', '5'), ed('5', '6'), ed('6', '7'), ed('7', '8'), ed('7', '9')],
  },
  leads: {
    name: 'Comment → customer',
    nodes: [
      mk('1', 'igComment', 0, 120, 'Contains "price" or "DEMO"'),
      mk('2', 'crm', 260, 40, 'Stage: New · Source: IG'),
      mk('3', 'igReply', 260, 200, 'Send demo link in DM'),
      mk('4', 'branch', 520, 200, 'Booked a call?'),
      mk('5', 'whatsapp', 780, 120, 'Ping Shubham: hot lead'),
      mk('6', 'wait', 780, 280, '24h then follow up'),
    ],
    edges: [ed('1', '2'), ed('1', '3'), ed('3', '4'), ed('4', '5'), ed('4', '6')],
  },
  weekly: {
    name: 'Weekly growth loop',
    nodes: [
      mk('1', 'schedule', 0, 120, 'Every Monday 9:00'),
      mk('2', 'analyse', 260, 120, 'Last 7 days of reels'),
      mk('3', 'playbook', 520, 120),
      mk('4', 'genPost', 780, 40, '3 posts + 2 carousels'),
      mk('5', 'genReel', 780, 200, '3 motion reels + 2 shoot briefs'),
      mk('6', 'whatsapp', 1040, 120, 'Send week plan for approval'),
    ],
    edges: [ed('1', '2'), ed('2', '3'), ed('3', '4'), ed('3', '5'), ed('4', '6'), ed('5', '6')],
  },
}

function Canvas() {
  const [preset, setPreset] = useState('festival')
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NData>>(presets.festival.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(presets.festival.edges)
  const [running, setRunning] = useState(false)
  const [custom, setCustom] = useState<CustomAction[]>([])
  useEffect(() => {
    listActions().then(setCustom, () => setCustom([]))
  }, [])

  const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge({ ...c, style: { stroke: '#3A3A42' } }, e)), [setEdges])

  const load = (k: string) => {
    setPreset(k)
    setNodes(presets[k].nodes)
    setEdges(presets[k].edges)
  }

  const add = (k: NData['k'], extra?: Partial<NData>) => {
    const id = 'n' + Date.now()
    setNodes((n) => [...n, mk(id, k, 200 + Math.random() * 300, 340 + Math.random() * 80, extra?.sub, extra)])
  }

  const run = async () => {
    setRunning(true)
    // BFS order from triggers
    const order: string[] = []
    const indeg = new Map(nodes.map((n) => [n.id, 0]))
    edges.forEach((e) => indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1))
    let frontier = nodes.filter((n) => !indeg.get(n.id)).map((n) => n.id)
    const seen = new Set<string>()
    while (frontier.length) {
      const next: string[] = []
      for (const id of frontier) {
        if (seen.has(id)) continue
        seen.add(id)
        order.push(id)
        edges.filter((e) => e.source === id).forEach((e) => next.push(e.target))
      }
      frontier = next
    }
    for (const id of order) {
      setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, active: n.id === id ? true : n.data.active } })))
      setEdges((es) => es.map((e) => (e.source === id ? { ...e, animated: true, style: { stroke: '#A3B1FF' } } : e)))
      await new Promise((r) => setTimeout(r, 450))
    }
    await new Promise((r) => setTimeout(r, 1200))
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, active: false } })))
    setEdges((es) => es.map((e) => ({ ...e, animated: false, style: { stroke: '#3A3A42' } })))
    setRunning(false)
  }

  const groups: Kind[] = ['trigger', 'ai', 'logic', 'action']

  return (
    <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
      <div className="glass h-fit space-y-4 p-4 lg:max-h-[640px] lg:overflow-y-auto">
        {groups.map((g) => (
          <div key={g}>
            <div className="label mb-2" style={{ color: kindStyle[g].color }}>{kindStyle[g].label}s</div>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
              {(Object.keys(catalog) as CatKey[])
                .filter((k) => catalog[k].kind === g)
                .map((k) => {
                  const Icon = catalog[k].icon
                  return (
                    <button key={k} onClick={() => add(k)} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left text-xs text-zinc-300 transition hover:border-white/20 hover:text-white">
                      <Icon size={14} style={{ color: kindStyle[g].color }} />
                      {catalog[k].title}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
        <div>
          <div className="label mb-2" style={{ color: kindStyle.action.color }}>Your actions</div>
          <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {custom.map((a) => (
              <button key={a.id} onClick={() => add('custom', { title: a.name, sub: a.description || a.method + ' ' + a.url.replace(/^https?:\/\//, '').split('/')[0], actionId: a.id })} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left text-xs text-zinc-300 transition hover:border-white/20 hover:text-white">
                <Plug size={14} style={{ color: kindStyle.action.color }} />
                <span className="truncate">{a.name}</span>
              </button>
            ))}
            <Link to="/actions" className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-2.5 py-2 text-xs text-zinc-500 transition hover:border-white/25 hover:text-white">
              + Connect CRM / API
            </Link>
          </div>
        </div>
      </div>

      <div className="glass relative h-[640px] overflow-hidden p-0">
        <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center gap-2">
          {Object.entries(presets).map(([k, p]) => (
            <button key={k} onClick={() => load(k)} className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur transition', preset === k ? 'border-volt/40 bg-volt/10 text-volt' : 'border-white/10 bg-ink-900/70 text-zinc-400 hover:text-white')}>
              {p.name}
            </button>
          ))}
          <button onClick={run} disabled={running} className="btn-volt ml-auto py-1.5 text-xs">
            <Play size={13} className="fill-current" /> {running ? 'Running…' : 'Test run'}
          </button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          style={{ background: 'transparent' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#2E2E34" />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap position="bottom-right" pannable zoomable maskColor="rgba(5,5,10,.7)" style={{ background: '#0E0E11', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12 }} nodeColor={(n) => kindStyle[defOf(n.data as NData).kind].color} />
        </ReactFlow>
      </div>
    </div>
  )
}

export default function Flows() {
  return (
    <div>
      <PageHeader
        eyebrow="Flows"
        title={<>Wire your <span className="text-gradient">autopilot</span>.</>}
        desc="Drag nodes, connect them, and let RYPL run your content and lead workflows. Click a block on the left to add it, drag from a dot to connect."
      />
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
    </div>
  )
}
