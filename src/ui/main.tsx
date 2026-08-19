/// <reference types="vite/client" />
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { useGame } from './store.js'
import './styles.css'

// Dev-only hook for smoke tests and console poking: the store, on window.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__game = useGame
}

const root = document.getElementById('root')
if (!root) throw new Error('No #root element in the document')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
