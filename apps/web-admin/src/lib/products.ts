import { apiFetch } from './api-with-business';
import type { CreateProductDto, UpdateProductDto } from '@pos-pyme/validation';

export interface ProductAdmin {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  cost_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  margin: number; // calculado por el backend
}

export interface LowStockProduct {
  id: string;
  sku: string;
  name: string;
  stock: number;
  min_stock: number;
  sale_price: number;
  updated_at: string;
}

export async function fetchAllProductsWithCosts(): Promise<ProductAdmin[]> {
  return apiFetch<ProductAdmin[]>('/products/admin/full');
}

export async function fetchLowStock(): Promise<LowStockProduct[]> {
  return apiFetch<LowStockProduct[]>('/products/low-stock');
}

export async function createProduct(dto: CreateProductDto) {
  return apiFetch<ProductAdmin>('/products', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateProduct(id: string, dto: UpdateProductDto) {
  return apiFetch<ProductAdmin>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export async function deleteProduct(id: string) {
  return apiFetch<{ id: string; deleted: boolean }>(`/products/${id}`, {
    method: 'DELETE',
  });
}
