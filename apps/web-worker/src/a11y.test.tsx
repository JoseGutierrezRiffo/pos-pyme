import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// @ts-expect-error - jest-axe no tiene tipos declarados; funciona en runtime
import { axe, toHaveNoViolations } from 'jest-axe';
import { Login } from './pages/Login';
import { OpenShift } from './pages/OpenShift';
import { Provider, createStore } from 'jotai';
import { currentWorkerAtom, selectedBusinessAtom } from './atoms';

// Extend expect with jest-axe matchers (works at runtime via Vitest)
expect.extend(
  toHaveNoViolations as unknown as Parameters<typeof expect.extend>[0],
);

// Mock supabase + api-with-business
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      }),
      signInWithPassword: vi.fn(),
    },
  },
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/api-with-business', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      }),
    },
  },
  apiFetch: vi.fn(),
  setGlobalBusinessId: vi.fn(),
}));

describe('A11y: axe-core audits', () => {
  it('Login page no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );
    const results = await axe(container);
    // Cast to any: jest-axe extends expect at runtime but TS doesn't see it
    (expect(results) as any).toHaveNoViolations();
  });

  it('OpenShift page no tiene violaciones de accesibilidad', async () => {
    const store = createStore();
    store.set(currentWorkerAtom, {
      id: 'user-001',
      email: 'worker@test.cl',
      full_name: 'Test Worker',
      memberships: [
        {
          membership_id: 'mb-001',
          business: {
            id: 'biz-001',
            name: 'Negocio',
            slug: 'n',
            is_active: true,
          },
          role: 'owner',
          is_active: true,
        },
      ],
    });
    store.set(
      selectedBusinessAtom,
      store.get(currentWorkerAtom)?.memberships[0]?.business ?? null,
    );

    const { container } = render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/open-shift']}>
          <OpenShift />
        </MemoryRouter>
      </Provider>,
    );
    const results = await axe(container);
    (expect(results) as any).toHaveNoViolations();
  });
});