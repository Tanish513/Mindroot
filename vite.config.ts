import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/framer-motion/') || id.includes('node_modules/clsx/') || id.includes('node_modules/tailwind-merge/')) {
            return 'vendor-ui';
          }
          if (id.includes('node_modules/socket.io-client/')) {
            return 'vendor-socket';
          }
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000',
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && typeof res.writeHead === 'function' && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend server offline' }));
            }
          });
        }
      },
      '/socket.io': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, socket) => {
            if (socket && 'destroy' in socket && typeof socket.destroy === 'function') {
              socket.destroy();
            }
          });
        }
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    cors: true
  }
});
