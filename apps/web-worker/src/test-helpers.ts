import { vi, beforeEach } from 'vitest';

/**
 * Helpers para mockear Supabase y fetch en tests e2e.
 *
 * El código real usa:
 *   - `supabase.auth.signInWithPassword(...)` para login
 *   - `supabase.auth.signOut()` para logout
 *   - `apiFetch<T>(path, options)` que hace `fetch()` con headers JWT
 *
 * Estos mocks los proveen sin necesidad de un backend real.
 */

const SUPABASE_URL = 'https://test.supabase.co';

export function setupSupabaseMock() {
  vi.mock('@/lib/api-with-business', () => ({
    supabase: {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-uuid-001', email: 'worker@test.cl' },
            session: { access_token: 'mock-jwt-token' },
          },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-uuid-001', email: 'worker@test.cl' } },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'mock-jwt-token' } },
          error: null,
        }),
      },
    },
    apiFetch: vi.fn(),
    setGlobalBusinessId: vi.fn(),
  }));
}

export const apiFetchMock = vi.fn();

export function mockApiResponse<T>(data: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
  };
}

export const mockUser = {
  id: 'user-uuid-001',
  email: 'worker@test.cl',
  role: 'worker' as const,
  full_name: 'Test Worker',
  memberships: [
    {
      membership_id: 'mb-001',
      business: {
        id: 'biz-uuid-001',
        name: 'Negocio Test',
        slug: 'negocio-test',
        is_active: true,
      },
      role: 'owner' as const,
      is_active: true,
    },
  ],
};

export const mockShift = {
  id: 'shift-uuid-001',
  user_id: 'user-uuid-001',
  shift_status: 'open' as const,
  cash_initial: 20000,
  total_sales: 0,
  cash_withdrawals: 0,
  total_cash_sales: 0,
  total_card_sales: 0,
  total_transfer_sales: 0,
  opened_at: '2026-07-03T10:00:00.000Z',
  closed_at: null,
  break_started_at: null,
  break_ended_at: null,
  cash_expected: null,
  cash_declared: null,
  discrepancy: null,
};

export const mockProducts = [
  {
    id: 'prod-001',
    name: 'Coca-Cola',
    sku: 'BEB-001',
    cost_price: 800,
    sale_price: 1500,
    stock: 50,
    min_stock: 5,
    business_id: 'biz-uuid-001',
    is_active: true,
  },
  {
    id: 'prod-002',
    name: 'Papas Lays',
    sku: 'SNK-001',
    cost_price: 600,
    sale_price: 1200,
    stock: 30,
    min_stock: 5,
    business_id: 'biz-uuid-001',
    is_active: true,
  },
];

export function resetAllMocks() {
  apiFetchMock.mockReset();
}

beforeEach(() => {
  resetAllMocks();
});

export const TEST_BASE_URL = SUPABASE_URL;