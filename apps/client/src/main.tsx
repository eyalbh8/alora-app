import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/open-sauce-one/latin-400.css'
import '@fontsource/open-sauce-one/latin-500.css'
import '@fontsource/open-sauce-one/latin-600.css'
import '@fontsource/open-sauce-one/latin-700.css'
import '@fontsource/open-sauce-one/latin-800.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import './index.css'
import App from './App.tsx'

if (window.location.pathname === '/index.html') {
  window.history.replaceState(
    null,
    '',
    `/${window.location.search}${window.location.hash}`,
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
