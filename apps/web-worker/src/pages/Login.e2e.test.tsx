import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../pages/Login';

const { mockSignIn, mockGetSession, mockSetSession } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockGetSession: vi.fn(),
  mockSetSession: vi.fn(),
}));

// Mock supabase + api-with-business ANTES de importar Login
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
      signOut: vi.fn().mockResolvedValue({ error: null }),
      setSession: mockSetSession,
      getSession: mockGetSession,
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-uuid-001', email: 'worker@test.cl' } },
        error: null,
      }),
    },
  },
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/api-with-business', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: mockGetSession,
    },
  },
  apiFetch: vi.fn(),
  setGlobalBusinessId: vi.fn(),
}));

// Default success response
mockSignIn.mockResolvedValue({
  data: {
    user: { id: 'user-uuid-001', email: 'worker@test.cl' },
    session: { access_token: 'mock-jwt-token' },
  },
  error: null,
});
mockGetSession.mockResolvedValue({
  data: { session: { access_token: 'mock-jwt-token' } },
  error: null,
});
mockSetSession.mockResolvedValue({ data: {}, error: null });

// Reset entre tests
beforeEach(() => {
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue({
    data: {
      user: { id: 'user-uuid-001', email: 'worker@test.cl' },
      session: { access_token: 'mock-jwt-token' },
    },
    error: null,
  });
  apiFetchMock.mockReset();
});

vi.mock('@pos-pyme/business-rules', async () => {
  const actual = await vi.importActual<typeof import('@pos-pyme/business-rules')>(
    '@pos-pyme/business-rules',
  );
  return { ...actual };
});

import { apiFetch as apiFetchFromSupabase } from '@/lib/supabase';
import { apiFetch as apiFetchFromApi } from '@/lib/api-with-business';
const apiFetchMock = apiFetchFromApi as ReturnType<typeof vi.fn>;
// Silence unused warning
void apiFetchFromSupabase;

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>,
  );
}

describe('E2E: Login page', () => {
  it('renderiza form de login con email y password', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/tu@email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/•+/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('muestra error si el backend devuelve error de auth', async () => {
    // We mock the actual supabase.auth.signInWithPassword to return error
    const { supabase } = await import('@/lib/supabase');
    (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText(/tu@email/i), 'wrong@test.cl');
    await user.type(screen.getByPlaceholderText(/•+/), 'badpassword');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid|credenciales|error/i)).toBeInTheDocument();
    });
  });

  it('login exitoso llama a /auth/me', async () => {
    // Mock /auth/me response
    apiFetchMock.mockResolvedValueOnce({
      id: 'user-uuid-001',
      email: 'worker@test.cl',
      full_name: 'Test Worker',
      role: 'worker',
      memberships: [
        {
          membership_id: 'mb-001',
          business: { id: 'biz-001', name: 'Negocio', is_active: true },
          role: 'owner',
          is_active: true,
        },
      ],
    });

    // Mock /shifts/current to indicate no open shift
    apiFetchMock.mockResolvedValueOnce(null);

    renderLogin();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/tu@email/i), 'worker@test.cl');
    await user.type(screen.getByPlaceholderText(/•+/), 'password123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(
      () => {
        expect(apiFetchMock).toHaveBeenCalledWith('/auth/me');
      },
      { timeout: 3000 },
    );
  });
});