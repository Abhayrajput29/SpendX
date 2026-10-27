import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const originalFetch = window.fetch.bind(window)
const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

window.fetch = (input, init = {}) => {
  const originalUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
  let url = originalUrl
  if (apiBase && typeof input === 'string' && url.startsWith('/api')) url = `${apiBase}${url}`

  const requestUrl = new URL(url, window.location.href)
  const apiOrigin = apiBase ? new URL(apiBase, window.location.origin).origin : window.location.origin
  const isApiRequest = requestUrl.origin === apiOrigin && requestUrl.pathname.startsWith('/api/')
  const isPublicAuthRequest = isApiRequest && /^\/api\/auth\/(login|register|validate-username|validate-email)$/.test(requestUrl.pathname)

  const token = localStorage.getItem('spendx_token')

  if (isApiRequest && !isPublicAuthRequest && token) {
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
    headers.set('Authorization', `Bearer ${token}`)
    return originalFetch(url === originalUrl ? input : url, { ...init, headers }).then((response) => {
      if (response.status === 401) {
        localStorage.removeItem('spendx_token')
        window.dispatchEvent(new Event('spendx:session-expired'))
      }
      return response
    })
  }

  return originalFetch(url === originalUrl ? input : url, init)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
