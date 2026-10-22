import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Bell, Brain, CalendarDays, Command, Instagram, LayoutDashboard, LogOut, Menu, Plug, Settings, Sparkles, Users, Waypoints, X, Zap } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { getSession, signOut } from './auth'
import { serverStatus } from './engine'
import { useStore } from './store'
import { cn, Wordmark } from './ui'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/studio', label: 'Studio', icon: Sparkles, hot: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/reel-lab', label: 'Reel Lab', icon: Activity },
  { to: '/flows', label: 'Flows', icon: Waypoints },
  { to: '/actions', label: 'Actions', icon: Plug },
  { to: '/crm', label: 'CRM', icon: Users },
  { to: '/brain', label: 'Brand Brain', icon: Brain },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Sidebar({ onNav }: { onNav?: () => void }) {
  const { brand, igConnected } = useStore()
  const [engine, setEngine] = useState<boolean | null>(null)
  const session = getSession()
  const who = session?.user.email?.split('@')[0] ?? 'You'
  useEffect(() => {
    serverStatus().then(setEngine)
  }, [])
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Wordmark />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map(({ to, label, icon: Icon, hot }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNav}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition',
                isActive ? 'text-white' : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl border border-white/10 bg-gradient-to-r from-volt/[0.12] via-white/[0.04] to-transparent"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
                {isActive && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-volt " />}
                <Icon size={17} className={cn('relative', isActive ? 'text-volt' : 'text-zinc-500 group-hover:text-zinc-300')} />
                <span className="relative">{label}</span>
                {hot && <span className="relative ml-auto rounded-md bg-volt/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-volt">AI</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 p-4">
        <div className="glass space-y-2.5 p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Engine</span>
            <span className={cn('flex items-center gap-1.5', engine ? 'text-volt' : 'text-amber-300')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', engine ? 'bg-volt ' : 'bg-amber-300')} />
              {engine === null ? '…' : engine ? 'Claude Code' : 'Demo mode'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Instagram</span>
            <span className={cn('flex items-center gap-1.5', igConnected ? 'text-volt' : 'text-zinc-500')}>
              <Instagram size={12} />
              {igConnected ? brand.handle : 'Not linked'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl px-1">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pulse to-surge font-display text-xs font-bold uppercase text-white">{who[0]}</div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="truncate font-semibold capitalize text-zinc-100">{who}</div>
            <div className="truncate text-zinc-500">{session ? `${brand.name} · shared workspace` : `${brand.name} · local`}</div>
          </div>
          {session && (
            <button onClick={signOut} title="Sign out" className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.05] hover:text-white" aria-label="Sign out">
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const nav2 = useNavigate()
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        nav2('/studio')
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [nav2])

  return (
    <div className="flex h-full">
      <aside className="hidden w-[248px] shrink-0 border-r border-white/[0.06] bg-ink-950/60 backdrop-blur-xl lg:block">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[260px] border-r border-white/10 bg-ink-950 lg:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <button className="absolute right-3 top-6 text-zinc-400" onClick={() => setOpen(false)} aria-label="Close menu">
                <X size={20} />
              </button>
              <Sidebar onNav={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-ink-950/70 px-4 backdrop-blur-xl md:px-8">
          <button className="text-zinc-300 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="lg:hidden"><Wordmark /></div>
          <button
            onClick={() => nav2('/studio')}
            className="hidden max-w-md flex-1 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2 text-left text-sm text-zinc-500 transition hover:border-white/15 sm:flex"
          >
            <Command size={15} />
            Ask RYPL to create anything…
            <kbd className="ml-auto rounded-md border border-white/10 px-1.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] text-zinc-400 hover:text-white" aria-label="Notifications">
              <Bell size={16} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-flare" />
            </button>
            <button onClick={() => nav2('/studio')} className="btn-volt py-2">
              <Zap size={15} /> <span className="hidden sm:inline">Generate</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden px-4 py-7 md:px-8 md:py-9">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="mx-auto max-w-[1400px]">
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
