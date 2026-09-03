import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 前端开发服务器：5173；/api 与 /art、/fonts、/assets 静态资源代理到后端 8787
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
})
