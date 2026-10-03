import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  root: '.',
  // Relative asset paths for the packaged desktop build (dist/ is loaded from
  // disk with file://), absolute in dev so the preview server behaves as before.
  base: command === 'build' ? './' : '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
  },
}));
