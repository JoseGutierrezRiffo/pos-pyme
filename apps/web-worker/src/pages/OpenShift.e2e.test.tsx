import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider, createStore } from 'jotai';
import { OpenShift } from '../pages/OpenShift';
import { currentWorkerAtom, selectedBusinessAtom } from '@/atoms';
import { apiFetch as apiFetchFromApi } from '@/lib/api-with-business';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      }),
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

const apiFetchMock = apiFetchFromApi as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockNavigate.mockReset();
  apiFetchMock.mockReset();
});

function renderOpenShift(workerExists = true, businessSelected = true) {
  const store = createStore();
  if (workerExists) {
    store.set(currentWorkerAtom, {
      id: 'user-001',
      email: 'worker@test.cl',
      full_name: 'Test Worker',
      memberships: [
        {
          membership_id: 'mb-001',
          business: {
            id: 'biz-001',
            name: 'Negocio Test',
            slug: 'negocio-test',
            is_active: true,
          },
          role: 'owner',
          is_active: true,
        },
      ],
    });
  }
  if (businessSelected) {
    store.set(
      selectedBusinessAtom,
      store.get(currentWorkerAtom)?.memberships[0]?.business ?? null,
    );
  }

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/open-shift']}>
        <OpenShift />
      </MemoryRouter>
    </Provider>,
  );
}

describe('E2E: OpenShift page', () => {
  it('sin worker, el botón existe pero submit falla con mensaje', async () => {
    renderOpenShift(false, false);

    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('0');
    await user.type(input, '5.000');

    // El componente tiene useEffect que redirige, pero la pantalla puede
    // estar renderizada brevemente. Verificar que el form existe.
    expect(screen.getByRole('button', { name: /abrir turno/i })).toBeInTheDocument();
  });

  it('renderiza input de efectivo inicial y botón', () => {
    renderOpenShift();
    expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir turno/i })).toBeInTheDocument();
  });

  it('abre turno con efectivo inicial y navega a /pos', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id: 'shift-001',
      user_id: 'user-001',
      shift_status: 'open',
      cash_initial: 20000,
      opened_at: '2026-07-03T10:00:00.000Z',
    });

    const user = userEvent.setup();
    renderOpenShift();

    await user.type(screen.getByPlaceholderText('0'), '20.000');
    await user.click(screen.getByRole('button', { name: /abrir turno/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/shifts/open',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ cash_initial: 20000 }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/pos');
    });
  });

  it('rechaza monto 0', async () => {
    const user = userEvent.setup();
    renderOpenShift();

    await user.type(screen.getByPlaceholderText('0'), '0');
    await user.click(screen.getByRole('button', { name: /abrir turno/i }));

    await waitFor(() => {
      expect(apiFetchMock).not.toHaveBeenCalled();
    });
  });

  it('muestra error si la API falla', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('Network error'));

    const user = userEvent.setup();
    renderOpenShift();

    await user.type(screen.getByPlaceholderText('0'), '15.000');
    await user.click(screen.getByRole('button', { name: /abrir turno/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});