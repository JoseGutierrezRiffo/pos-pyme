import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../common/supabase.module';
import { CreateProductDto, UpdateProductDto } from '@pos-pyme/validation';
import { calculateMargin } from '@pos-pyme/business-rules';

@Injectable()
export class ProductsService {
  constructor(@Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient) {}

  /**
   * Lista productos públicos (sin cost_price) para workers.
   * Filtra por business_id si se proporciona.
   */
  async findAllPublic(businessId?: string) {
    let query = this.admin.from('products_public').select('*').eq('is_active', true).order('name');

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Productos activos con stock bajo (stock < min_stock).
   * Filtra por business_id si se proporciona.
   */
  async findLowStock(businessId?: string) {
    const query = this.admin
      .from('products')
      .select('id, name, sku, stock, min_stock, business_id')
      .eq('is_active', true)
      .lt('stock', this.admin.rpc('get_min_stock', { product_id: 'id' })); // Esto no funciona así

    if (businessId) {
      const { data, error } = await this.admin
        .from('products')
        .select('id, name, sku, stock, min_stock, business_id')
        .eq('is_active', true)
        .eq('business_id', businessId);

      if (error) throw error;
      return (data ?? []).filter((p) => p.stock < p.min_stock);
    }

    const { data, error } = await this.admin
      .from('products')
      .select('id, name, sku, stock, min_stock, business_id')
      .eq('is_active', true);

    if (error) throw error;
    return (data ?? []).filter((p) => p.stock < p.min_stock);
  }

  /**
   * Lista productos CON cost_price (para admins/owners).
   * Filtra por business_id si se proporciona.
   */
  async findAllWithCosts(businessId?: string) {
    let query = this.admin.from('products').select('*').order('name');

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((p) => ({
      ...p,
      margin: calculateMargin(Number(p.cost_price), Number(p.sale_price)),
    }));
  }

  /**
   * Busca productos por nombre o SKU.
   */
  async search(query: string, businessId?: string, limit = 20) {
    let dbQuery = this.admin
      .from('products_public')
      .select('*')
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
      .eq('is_active', true)
      .order('name')
      .limit(limit);

    if (businessId) {
      dbQuery = dbQuery.eq('business_id', businessId);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.admin.from('products').select('*').eq('id', id).single();
    if (error || !data) throw new NotFoundException('Producto no encontrado');
    return data;
  }

  async create(dto: CreateProductDto & { business_id?: string }) {
    const { data, error } = await this.admin.from('products').insert(dto).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: string, dto: UpdateProductDto) {
    const { data, error } = await this.admin
      .from('products')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('Producto no encontrado');
    return data;
  }

  async remove(id: string) {
    // Soft delete
    const { error } = await this.admin
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { id, deleted: true };
  }
}
