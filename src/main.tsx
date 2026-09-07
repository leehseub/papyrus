import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GraphWindow } from './GraphWindow.tsx'

const isGraphWindow = new URLSearchParams(window.location.search).has('graphview')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isGraphWindow ? <GraphWindow /> : <App />}
  </StrictMode>,
)
