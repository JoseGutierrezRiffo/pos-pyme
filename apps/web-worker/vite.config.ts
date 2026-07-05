import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { existsSync } from 'node:fs';

export default defineConfig(({ mode }) => {
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
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'POS Pyme — Trabajador',
          short_name: 'POS',
          description: 'Sistema POS para trabajadores',
          theme_color: '#0ea5e9',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
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
      port: 5174,
      host: true,
    },
  };
});
