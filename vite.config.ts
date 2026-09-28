import { defineConfig } from 'vite';

export default defineConfig({
  // WGSL shaders are shipped as real files and inlined at build time with Vite's
  // native `?raw` suffix: `import src from './geodesic.wgsl?raw'`.
  // No plugin is required for that, so the config stays minimal on purpose.
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
});
