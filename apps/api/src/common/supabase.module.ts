import { Global, Module } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_ADMIN = 'SUPABASE_ADMIN';

/**
 * Lee el .env manualmente. Busca subiendo directorios hasta encontrar
 * pnpm-workspace.yaml (raíz del monorepo). Esto evita problemas con
 * process.cwd() y __dirname cuando se ejecuta con tsx watch.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';

function loadEnv(): void {
  if (process.env.SUPABASE_URL) return; // ya cargado

  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const envFile = join(dir, '.env');
    if (existsSync(envFile)) {
      const content = readFileSync(envFile, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
      return;
    }
    dir = dirname(dir);
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    `Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env (URL: ${supabaseUrl ? '✅' : '❌'}, Key: ${supabaseServiceKey ? '✅' : '❌'})`,
  );
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as SupabaseClient;

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_ADMIN,
      useValue: adminClient,
    },
  ],
  exports: [SUPABASE_ADMIN],
})
export class SupabaseModule {}
