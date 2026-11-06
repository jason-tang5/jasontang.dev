import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // relative base so the build works from any subpath, not just the domain root
  base: './',
  // Vite serves the UI locally; published posts and uploaded images stay in KV.
  server: {
    proxy: {
      '^/api/blog(?:/|$)': {
        target: 'https://jasontang.dev',
        changeOrigin: true,
      },
      // analytics and the snake scoreboard read the live numbers too. /api/event stays
      // local, so playing on localhost doesn't count as real visits and wins
      '^/api/(?:stats|analytics|insights)(?:\\?|$)': {
        target: 'https://jasontang.dev',
        changeOrigin: true,
      },
    },
  },
  // keep vite's output out of assets/, which holds our own static files
  build: { assetsDir: 'desktop-assets' },
});
