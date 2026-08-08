import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyPxCm } from './lib/touch'

// Calibrazione dei tocchi in cm reali (§3.2.1): applicata prima del primo
// render, cosi' nessuna schermata compare per un istante con i pulsanti
// della misura sbagliata.
applyPxCm()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
