/**
 * Setup global: limpia estado antes de cada test.
 * - Cierra cualquier shift abierto
 * - Limpia localStorage
 */
import { chromium, request, FullConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load .env.local manually (Playwright doesn't auto-load .env for globalSetup)
function loadEnv() {
  try {
    const envPath = join(process.cwd(), 'tests/e2e/.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://azparvyrpitmannwnxdl.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const BIZ = '00000000-0000-0000-0000-000000000001';
const TEST_WORKER = { email: 'worker@pospyme.cl', password: 'Worker123!' };

export default async function globalSetup(_config: FullConfig) {
  // Login as worker
  const apiCtx = await request.newContext({ baseURL: SUPABASE_URL });
  const loginResp = await apiCtx.post('/auth/v1/token?grant_type=password', {
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    data: { email: TEST_WORKER.email, password: TEST_WORKER.password },
  });
  if (!loginResp.ok()) {
    console.warn('[setup] worker login failed:', loginResp.status());
    return;
  }
  const { access_token } = await loginResp.json();
  await apiCtx.dispose();

  // Close any open shift
  const shiftResp = await fetch(`${API}/shifts/current`, {
    headers: { Authorization: `Bearer ${access_token}`, 'x-business-id': BIZ },
  });
  if (shiftResp.status === 200) {
    const shiftText = await shiftResp.text();
    let shift;
    try {
      shift = shiftText ? JSON.parse(shiftText) : null;
    } catch {
      shift = null;
    }
    if (shift?.id && shift.shift_status === 'open') {
      const closeResp = await fetch(`${API}/shifts/close`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'x-business-id': BIZ,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cash_declared: shift.cash_initial, notes: 'reset for tests' }),
      });
      console.log(`[setup] closed open shift: ${closeResp.status}`);
    } else {
      console.log('[setup] no open shift to close');
    }
  } else {
    console.log(`[setup] no current shift (${shiftResp.status})`);
  }
}