import { defineConfig } from 'vite';
import { resolveBase } from './scripts/config.mjs';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  base: resolveBase(),
  define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
  build: { target: 'safari16.4', sourcemap: false },
});
