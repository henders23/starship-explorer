import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { CrashBoundary } from './CrashScreen.js'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('No #root element in the document')

createRoot(root).render(
  <StrictMode>
    <CrashBoundary>
      <App />
    </CrashBoundary>
  </StrictMode>,
)
