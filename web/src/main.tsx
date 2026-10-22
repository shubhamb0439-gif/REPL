import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Layout from './Layout'
import { StoreProvider } from './store'
import { AuthGate, installAuthFetch } from './auth'
import Dashboard from './pages/Dashboard'
import Studio from './pages/Studio'
import CalendarPage from './pages/Calendar'
import ReelLab from './pages/ReelLab'
import Flows from './pages/Flows'
import Actions from './pages/Actions'
import CRM from './pages/CRM'
import BrandBrain from './pages/BrandBrain'
import SettingsPage from './pages/Settings'

// The hosted single-file preview keeps routing in memory; the local app uses #/routes.
const Router = import.meta.env.MODE === 'single' ? MemoryRouter : HashRouter

installAuthFetch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
    <StoreProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/reel-lab" element={<ReelLab />} />
            <Route path="/flows" element={<Flows />} />
            <Route path="/actions" element={<Actions />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/brain" element={<BrandBrain />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </Router>
    </StoreProvider>
    </AuthGate>
  </StrictMode>,
)
