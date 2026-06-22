import { defineConfig } from 'vite';

export default defineConfig({
  // Serve sw.js from the public directory so it's at the root
  publicDir: 'public',
  server: {
    // In dev mode, proxy /proxy and /api to the Express server
    proxy: {
      '/proxy': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
});
