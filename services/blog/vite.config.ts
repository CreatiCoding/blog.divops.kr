import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 개발: `yarn dev` 는 화면만 띄우고 /api 는 Go API(API_URL, 기본 127.0.0.1:8080)로 넘긴다.
// 글 상세처럼 서버가 데이터를 넣어 주는 화면은 `vite build --watch` + Go(STATIC_DIR=dist)로 보는 게 정확하다.
const API = process.env.API_URL || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    proxy: {
      '/api': API,
      '/sitemap.xml': API,
      '/robots.txt': API,
    },
  },
});
