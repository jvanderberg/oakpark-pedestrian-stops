import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const darkMedia = window.matchMedia('(prefers-color-scheme: dark)')

const applySystemTheme = () => {
  document.documentElement.classList.toggle('dark', darkMedia.matches)
}

applySystemTheme()

if (typeof darkMedia.addEventListener === 'function') {
  darkMedia.addEventListener('change', applySystemTheme)
} else {
  darkMedia.addListener(applySystemTheme)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
