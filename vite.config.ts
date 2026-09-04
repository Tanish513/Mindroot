import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
