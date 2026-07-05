import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../common/supabase.module';

export type MovementStatus = 'pending' | 'approved' | 'rejected';
export type MovementType = 'in' | 'out';

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

@Injectable()
export class StockMovementsService {
  constructor(@Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient) {}

  /**
   * Crea una solicitud de movimiento de stock (status = pending).
   * NO toca el stock hasta que el admin apruebe.
   */
  async create(
    userId: string,
    dto: {
      product_id: string;
      shift_id?: string;
      type: MovementType;
      quantity: number;
      reason: string;
      photo_url?: string;
    },
  ): Promise<StockMovement> {
    // Validar que el producto existe y está activo
    const { data: product, error: pErr } = await this.admin
      .from('products')
      .select('id, name, is_active')
      .eq('id', dto.product_id)
      .single();

    if (pErr || !product) {
      throw new NotFoundException('Producto no encontrado');
    }
    if (!product.is_active) {
      throw new BadRequestException('Producto inactivo');
    }

    // Validar que para 'out' haya stock suficiente
    if (dto.type === 'out') {
      const { data: stock } = await this.admin
        .from('products')
        .select('stock')
        .eq('id', dto.product_id)
        .single();
      if (stock && dto.quantity > stock.stock) {
        throw new BadRequestException(
          `Stock insuficiente: hay ${stock.stock} unidades, querés retirar ${dto.quantity}`,
        );
      }
    }

    const { data, error } = await this.admin
      .from('stock_movements')
      .insert({
        product_id: dto.product_id,
        user_id: userId,
        shift_id: dto.shift_id ?? null,
        type: dto.type,
        quantity: dto.quantity,
        reason: dto.reason,
        photo_url: dto.photo_url ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data as StockMovement;
  }

  /**
   * Solicitudes pendientes (con info del producto y del worker).
   * Solo admins.
   */
  async listPending(): Promise<StockMovement[]> {
    const { data, error } = await this.admin
      .from('stock_movements')
      .select(
        `*,
         product:products(id, sku, name, sale_price, stock),
         user:profiles!stock_movements_user_id_fkey(full_name, email)`,
      )
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as StockMovement[];
  }

  /**
   * Histórico de movimientos (todos los estados, filtrable).
   */
  async listAll(opts: {
    limit?: number;
    productId?: string;
    status?: MovementStatus;
    userId?: string;
  }): Promise<StockMovement[]> {
    let q = this.admin
      .from('stock_movements')
      .select(
        `*,
         product:products(id, sku, name, sale_price, stock),
         user:profiles!stock_movements_user_id_fkey(full_name, email),
         reviewer:profiles!stock_movements_reviewed_by_fkey(full_name)`,
      )
      .order('requested_at', { ascending: false })
      .limit(opts.limit ?? 50);

    if (opts.status) q = q.eq('status', opts.status);
    if (opts.productId) q = q.eq('product_id', opts.productId);
    if (opts.userId) q = q.eq('user_id', opts.userId);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as StockMovement[];
  }

  /**
   * Aprueba una solicitud pendiente. El trigger de DB actualiza el stock.
   */
  async approve(id: string, reviewerId: string, notes?: string): Promise<StockMovement> {
    const { data, error } = await this.admin
      .from('stock_movements')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: notes ?? null,
      })
      .eq('id', id)
      .eq('status', 'pending') // solo aprobar pending
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Solicitud no encontrada o ya procesada');
      }
      throw error;
    }
    return data as StockMovement;
  }

  /**
   * Rechaza una solicitud pendiente.
   */
  async reject(id: string, reviewerId: string, notes?: string): Promise<StockMovement> {
    const { data, error } = await this.admin
      .from('stock_movements')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: notes ?? null,
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Solicitud no encontrada o ya procesada');
      }
      throw error;
    }
    return data as StockMovement;
  }

  /**
   * Cantidad de solicitudes pendientes (para badge).
   */
  async countPending(): Promise<number> {
    const { count, error } = await this.admin
      .from('stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) throw error;
    return count ?? 0;
  }
}
