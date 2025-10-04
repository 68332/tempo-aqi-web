import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === '/',
  server: {
    proxy: {
      '/api/openaq': {
        target: 'https://api.openaq.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openaq/, ''),
        headers: {
          'User-Agent': 'tempo-aqi-web/1.0.0'
        }
      }, 
      '/api/pandora': {
        target: 'https://data.hetzner.pandonia-global-network.org/',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api\/pandora/, ''),
      },
    }
  }
})
