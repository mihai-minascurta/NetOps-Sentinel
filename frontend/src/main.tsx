import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Dashboard from './dashboard/Dashboard.tsx'
import { dashboardSample } from './dashboard/dashboardSample.ts'

const showDashboard = new URLSearchParams(window.location.search).get('view') === 'dashboard'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showDashboard ? <Dashboard sample={dashboardSample} /> : <App />}
  </StrictMode>,
)
