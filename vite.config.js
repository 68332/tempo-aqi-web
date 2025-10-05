import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/Aircast/' : '/',
  server: {
    proxy: {
      '/api/openaq': {
        target: 'https://api.openaq.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openaq/, ''),
        headers: {
          'User-Agent': 'Aircast/1.0.0'
        }
      }, 
      '/api/pandora': {
        target: 'https://data.hetzner.pandonia-global-network.org/',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api\/pandora/, ''),
      },
      '/api/ml': {
        target: 'http://167.179.86.141:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ml/, ''),
        secure: false
      }
    }
  }
})
