import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Dashboard from './dashboard/Dashboard.tsx'
import { dashboardSample } from './dashboard/dashboardSample.ts'

const params = new URLSearchParams(window.location.search)
const view = params.get('view')
const showTopology = view === 'topology' ||
  (view === null && import.meta.env.DEV && params.get('demo') === '1')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showTopology ? <App /> : <Dashboard sample={dashboardSample} />}
  </StrictMode>,
)
