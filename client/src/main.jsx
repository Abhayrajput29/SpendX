import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const originalFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url
  const token = localStorage.getItem('spendx_token')
  if (!url.startsWith('/api/auth/') && token) {
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined))
    headers.set('Authorization', `Bearer ${token}`)
    return originalFetch(input, { ...init, headers })
  }
  return originalFetch(input, init)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
