import { atom } from 'jotai';

export interface Business {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface Membership {
  membership_id: string;
  role: 'owner' | 'admin' | 'worker';
  is_active: boolean;
  business: Business;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: 'admin' | 'worker';
  full_name: string;
  memberships: Membership[];
}

// Estado global: usuario actual
export const currentUserAtom = atom<CurrentUser | null>(null);

// Estado global: negocio seleccionado
export const selectedBusinessAtom = atom<Business | null>(null);

// Contador que se incrementa cada vez que cambia el negocio
// Útil para disparar useEffect que necesiten recargar datos
export const businessVersionAtom = atom(0);

// Selector derivado: obtener rol del usuario en el negocio seleccionado
export const currentRoleInBusinessAtom = atom((get) => {
  const user = get(currentUserAtom);
  const business = get(selectedBusinessAtom);

  if (!user || !business) return null;

  const membership = user.memberships.find((m) => m.business.id === business.id);
  return membership?.role ?? null;
});
