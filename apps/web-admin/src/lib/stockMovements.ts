import { apiFetch } from './api-with-business';

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

export async function fetchPendingMovements() {
  return apiFetch<StockMovement[]>('/stock-movements/pending');
}

export async function fetchMovementHistory(
  opts: {
    status?: MovementStatus;
    productId?: string;
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.productId) params.set('product_id', opts.productId);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch<StockMovement[]>(`/stock-movements${qs ? `?${qs}` : ''}`);
}

export async function approveMovement(id: string, notes?: string) {
  return apiFetch<StockMovement>(`/stock-movements/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}

export async function rejectMovement(id: string, notes?: string) {
  return apiFetch<StockMovement>(`/stock-movements/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}

export async function fetchPendingCount(): Promise<number> {
  const result = await apiFetch<{ count: number }>('/stock-movements/pending/count');
  return result.count;
}
