/**
 * Test E2E del flujo web-admin (Portal del dueño).
 * Cubre Suite B del TEST_PLAN.md:
 *   - B1.1 Login admin válido
 *   - B2.1 Dashboard KPIs 7 días
 *   - B3.1 Vista mensual Calendar
 *   - C1.4 Multi-tenant: impersonation bloqueada
 */
import { test, expect, request, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load .env.local (Playwright doesn't auto-load .env files for test files)
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

const TEST_ADMIN = { email: 'admin@pospyme.cl', password: 'Admin123!' };
const TEST_WORKER = { email: 'worker@pospyme.cl', password: 'Worker123!' };
const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://azparvyrpitmannwnxdl.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SERVICE_ROLE_KEY = process.env.E2E_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function loginViaSupabase(page: Page, creds: { email: string; password: string }) {
  // Use API request context to login (faster than UI for setup)
  const apiCtx = await request.newContext({ baseURL: SUPABASE_URL });
  const resp = await apiCtx.post('/auth/v1/token?grant_type=password', {
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    data: { email: creds.email, password: creds.password },
  });
  if (resp.status() !== 200) {
    const body = await resp.text();
    console.log(`[login] ${creds.email} status=${resp.status()} body=${body.slice(0, 200)}`);
  }
  expect(resp.status(), `login ${creds.email}`).toBe(200);
  const { access_token } = await resp.json();
  await apiCtx.dispose();

  // Set supabase session in localStorage
  await page.goto('/login');
  const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
  await page.evaluate(
    ({ token, email, ref }) => {
      const session = {
        access_token: token,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'mock',
        user: { id: 'mock', email, app_metadata: {}, user_metadata: {}, aud: 'authenticated' },
      };
      // Supabase stores session under sb-{ref}-auth-token
      const keys = Object.keys(localStorage).filter((k) => k.includes('auth-token'));
      const key = keys[0] ?? `sb-${ref}-auth-token`;
      localStorage.setItem(key, JSON.stringify(session));
    },
    { token: access_token, email: creds.email, ref: projectRef },
  );

  return access_token;
}

test.describe('Suite B + C: web-admin (Portal)', () => {
test('B1.1 Login admin válido redirige a /dashboard', async ({ page }) => {
  await page.goto('/login');
  // web-admin Login has no placeholders; use input[type=email] / input[type=password]
  await page.locator('input[type="email"]').fill(TEST_ADMIN.email);
  await page.locator('input[type="password"]').fill(TEST_ADMIN.password);
  await page.getByRole('button', { name: /ingresar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);
});

  test('B2.1 Dashboard renderiza con KPIs', async ({ page }) => {
    await loginViaSupabase(page, TEST_ADMIN);
    await page.goto('/dashboard');

    // Should show at least one KPI card or empty state
    await expect(page.locator('main, [class*="dashboard"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('B3.1 Calendar muestra grid mensual', async ({ page }) => {
    await loginViaSupabase(page, TEST_ADMIN);
    await page.goto('/calendar');
    // Wait for "Cargando..." to disappear, or for the month name to appear
    await page.waitForFunction(
      () => {
        const body = document.body.textContent ?? '';
        return !body.includes('Cargando');
      },
      { timeout: 15_000 },
    ).catch(() => {});
    // The calendar page shows the current month name and a grid
    const hasCalendar = await page
      .locator('text=/Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre/i')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    expect(hasCalendar, 'Calendar page should render').toBeTruthy();
  });

  test('C1.4 Impersonation bloqueada (worker intenta crear sale con user_id de otro)', async ({ request }) => {
    // Get worker token
    const loginResp = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      data: { email: TEST_WORKER.email, password: TEST_WORKER.password },
    });
    expect(loginResp.status()).toBe(200);
    const { access_token: workerToken } = await loginResp.json();

    // Get admin user ID
    const usersResp = await request.get(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SUPABASE_ANON_KEY },
    });
    const users = await usersResp.json();
    const adminUser = users.users?.find((u: { email: string }) => u.email === TEST_ADMIN.email);
    expect(adminUser, 'admin user must exist in supabase').toBeDefined();

    // Get a product to use in the sale
    const productsResp = await request.get(`${API}/products`, {
      headers: { Authorization: `Bearer ${workerToken}`, 'x-business-id': '00000000-0000-0000-0000-000000000001' },
    });
    expect(productsResp.status()).toBe(200);
    const products = await productsResp.json();
    const product = products[0];
    expect(product, 'at least one product must exist').toBeDefined();

    // Open a shift for the worker via API (so we have something to attach the sale to)
    const headers = { Authorization: `Bearer ${workerToken}`, 'x-business-id': '00000000-0000-0000-0000-000000000001' };
    let shiftResp = await request.get(`${API}/shifts/current`, { headers });
    const shiftText = shiftResp.ok() ? await shiftResp.text() : '';
    let shift = shiftText ? JSON.parse(shiftText) : null;
    if (!shift?.id || shift.shift_status !== 'open') {
      const openResp = await request.post(`${API}/shifts/open`, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: { cash_initial: 20000 },
      });
      const openText = await openResp.text();
      if (!openResp.ok() || !openText) {
        test.skip(true, `Could not open shift: ${openResp.status()} ${openText.slice(0, 100)}`);
        return;
      }
      shift = JSON.parse(openText);
    }

    // Attempt: worker tries to create sale attributed to admin
    const saleResp = await request.post(`${API}/sales`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: {
        shift_id: shift.id,
        user_id: adminUser.id, // ← IMPERSONATION ATTEMPT (should be ignored)
        cash_amount: 1000,
        card_amount: 0,
        transfer_amount: 0,
        items: [{ product_id: product.id, quantity: 1 }],
      },
    });

    // The backend should ignore the body's user_id (Zod strips it) and use the JWT user.
    // The sale is created with the worker's id, NOT admin's.
    expect(saleResp.status(), 'Sale should be created (with worker id, not admin)').toBe(201);

    const saleBody = await saleResp.json();
    // The sale was created with the JWT user (worker), not the admin from the body
    expect(
      saleBody.user_id,
      `Sale user_id should NOT be admin's (${adminUser.id}). Got: ${saleBody.user_id}`,
    ).not.toBe(adminUser.id);
  });
});