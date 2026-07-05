import { atom } from 'jotai';
import type { PaymentMethod } from '@pos-pyme/validation';
import type { CurrentWorker, Business, Membership } from './auth';

// Re-export auth atoms
export { currentWorkerAtom, selectedBusinessAtom, businessVersionAtom } from './auth';
export type { CurrentWorker, Business, Membership } from './auth';

/** Carrito: items en la venta actual */
export interface CartItem {
  product_id: string;
  product_name: string;
  sale_price: number;
  quantity: number;
  stock: number;
}

export const cartAtom = atom<CartItem[]>([]);
export const cartTotalAtom = atom((get) =>
  get(cartAtom).reduce((acc, i) => acc + i.sale_price * i.quantity, 0),
);
export const cartCountAtom = atom((get) => get(cartAtom).reduce((acc, i) => acc + i.quantity, 0));

/** Turno actual */
export type ShiftStatus = 'open' | 'break' | 'closed' | 'none';

export interface CurrentShift {
  id: string;
  user_id: string;
  shift_status: ShiftStatus;
  cash_initial: number;
  total_sales: number;
  cash_withdrawals: number;
  total_cash_sales: number;
  total_card_sales: number;
  total_transfer_sales: number;
  opened_at: string;
  closed_at: string | null;
  break_started_at: string | null;
  break_ended_at: string | null;
  cash_expected: number | null;
  cash_declared: number | null;
  discrepancy: number | null;
}

export const currentShiftAtom = atom<CurrentShift | null>(null);

/** Método de pago seleccionado */
export const paymentMethodAtom = atom<PaymentMethod>('efectivo');
