import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig({
  root: 'apps/web',
  plugins: [react(), tailwind()],
  server: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    proxy: { '/api': 'http://127.0.0.1:4174' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
