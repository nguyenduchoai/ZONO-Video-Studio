import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Perf 2026-06-19: tách vendor nặng thành chunk riêng, cacheable độc lập
        // (route components đã lazy-load qua router). Tránh gộp tất cả vào 1 entry chunk.
        manualChunks(id: string) {
          if (id.includes('node_modules/vuetify')) return 'vuetify';
          if (id.includes('node_modules/chart.js') || id.includes('vue-chartjs')) return 'charts';
          if (id.includes('@tiptap')) return 'editor';
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'socket';
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/exceljs')) return 'spreadsheet';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Cho phép đổi cổng backend qua env (mặc định 3000) — tránh xung đột cổng khi
      // dev nhiều app cùng máy. VD: VITE_API_PROXY_TARGET=http://localhost:3001
      '/api': process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
      '/socket.io': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
