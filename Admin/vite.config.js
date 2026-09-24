import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During local dev, /api is proxied to the FastAPI backend on :8000.
// In production the API base URL comes from VITE_API_URL (set on Render).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
