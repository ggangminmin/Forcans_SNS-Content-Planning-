import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/openclaw': {
        target: 'http://127.0.0.1:18789', // OpenClaw 기본 포트로 가정
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openclaw/, ''),
      },
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
