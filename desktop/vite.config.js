import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/query': 'http://localhost:8420',
      '/peers': 'http://localhost:8420',
      '/ws':    { target: 'ws://localhost:8420', ws: true },
      '/health':'http://localhost:8420'
    }
  }
})
