import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts', 'react-is'],
          'vendor-motion': ['framer-motion'],
          'vendor-socket': ['socket.io-client'],
          'vendor-zustand': ['zustand']
        }
      }
    }
  }
})
