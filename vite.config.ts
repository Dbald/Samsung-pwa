import { defineConfig } from 'vite';
import { showroomPlugin } from './src/node/vite-plugin';

// BASE_PATH lets the site live under a sub-path, e.g. BASE_PATH=/Samsung-pwa/ for GitHub Pages.
const base = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');

export default defineConfig({
  base,
  publicDir: false,
  plugins: [showroomPlugin()],
  build: {
    target: 'es2022',
    // The 3D viewer is a separate lazy chunk; only it may exceed the default warning size.
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { main: 'src/client/main.ts' } },
  },
});
