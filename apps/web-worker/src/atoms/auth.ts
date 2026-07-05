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

export interface CurrentWorker {
  id: string;
  email: string;
  full_name: string;
  memberships: Membership[];
}

export const currentWorkerAtom = atom<CurrentWorker | null>(null);

export const selectedBusinessAtom = atom<Business | null>(null);

// Contador que se incrementa cuando cambia el negocio seleccionado
export const businessVersionAtom = atom(0);
