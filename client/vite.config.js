import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const configDirectory = path.dirname(fileURLToPath(import.meta.url))
const serverEnvPath = path.resolve(configDirectory, '../server/.env')
const serverEnv = fs.existsSync(serverEnvPath) ? fs.readFileSync(serverEnvPath, 'utf8') : ''
const configuredPort = serverEnv.match(/^\s*PORT\s*=\s*["']?(\d+)/m)?.[1]
const backendPort = process.env.PORT || configuredPort || '5001'
const backendTarget = process.env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${backendPort}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all local addresses (both localhost and 127.0.0.1)
    port: 5173,
    proxy: {
      // Proxy all /api and /uploads requests to the Express backend
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
})
