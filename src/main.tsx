import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Après App : le thème doit se charger APRÈS le style par défaut de
// React Flow (importé depuis FlowCanvas.tsx) pour pouvoir le redéfinir —
// sinon les variables --xy-* par défaut de la librairie l'emportent.
import './styles/theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
