import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { existsSync } from 'node:fs';

export default defineConfig(({ mode }) => {
  // Buscar el .env en la raíz del monorepo subiendo hasta encontrar pnpm-workspace.yaml
  function findMonorepoRoot(): string {
    let dir = __dirname;
    for (let i = 0; i < 8; i++) {
      if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
      dir = path.join(dir, '..');
    }
    throw new Error('No se encontró la raíz del monorepo');
  }
  const root = findMonorepoRoot();
  const env = loadEnv(mode, root, 'VITE_');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      // Expone las env vars al cliente
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL ?? 'http://localhost:3000/api',
      ),
    },
    optimizeDeps: {
      include: ['@pos-pyme/validation', '@pos-pyme/business-rules', '@pos-pyme/supabase-types'],
    },
    server: {
      port: 5173,
      host: true,
    },
  };
});
