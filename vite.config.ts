import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/** `.env` lives at the repo root, not next to the client sources under `root`. */
const envDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, envDir, ''), ...process.env };
  const apiPort = env.PORT ?? '3001';

  return {
    plugins: [react()],
    root: 'src/client',
    envDir,
    build: {
      outDir: '../../dist/client',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        '^/api/': `http://localhost:${apiPort}`,
      },
    },
  };
});
