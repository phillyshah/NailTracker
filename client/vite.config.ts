import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3045',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Framework code changes far less often than app code. Splitting it out
        // means a routine release no longer invalidates the whole cached bundle.
        // Route-level chunks are left to Rollup, which derives them from the
        // React.lazy() boundaries in App.tsx.
        // Rolldown (Vite 8) only accepts the function form here.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@tanstack/')) return 'query-vendor';
        },
      },
    },
  },
});
