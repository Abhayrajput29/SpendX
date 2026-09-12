import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const originalFetch = window.fetch.bind(window)
const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

window.fetch = (input, init = {}) => {
  let url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
  if (apiBase && url.startsWith('/api')) {
    url = `${apiBase}${url}`
  }

  const token = localStorage.getItem('spendx_token')
  const isAuthRequest = url.includes('/api/auth/')

  if (!isAuthRequest && token) {
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined))
    headers.set('Authorization', `Bearer ${token}`)
    return originalFetch(url, { ...init, headers }).then((response) => {
      if (response.status === 401) {
        localStorage.removeItem('spendx_token')
        window.dispatchEvent(new Event('spendx:session-expired'))
      }
      return response
    })
  }

  return originalFetch(url, init)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
