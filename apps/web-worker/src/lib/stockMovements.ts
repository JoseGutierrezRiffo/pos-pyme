import { apiFetch } from './supabase';

export type MovementType = 'in' | 'out';
export type MovementStatus = 'pending' | 'approved' | 'rejected';

export interface StockMovement {
  id: string;
  product_id: string;
  shift_id: string | null;
  user_id: string;
  type: MovementType;
  quantity: number;
  reason: string;
  photo_url: string | null;
  status: MovementStatus;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  product?: {
    id: string;
    sku: string;
    name: string;
    sale_price: number;
    stock: number;
  };
  user?: {
    full_name: string;
    email: string;
  };
  reviewer?: {
    full_name: string;
  };
}

export interface CreateStockMovementPayload {
  product_id: string;
  shift_id?: string;
  type: MovementType;
  quantity: number;
  reason: string;
  photo_url?: string;
}

export async function createStockMovement(payload: CreateStockMovementPayload) {
  return apiFetch<StockMovement>('/stock-movements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMyMovements() {
  return apiFetch<StockMovement[]>('/stock-movements');
}
