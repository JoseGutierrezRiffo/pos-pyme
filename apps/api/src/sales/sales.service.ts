import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../common/supabase.module';
import { CreateSaleDto } from '@pos-pyme/validation';

@Injectable()
export class SalesService {
  constructor(@Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient) {}

  async create(userId: string, dto: CreateSaleDto, businessId?: string) {
    // 1) Validar que el turno existe y está abierto
    const { data: shift, error: shiftErr } = await this.admin
      .from('shifts')
      .select('id, user_id, shift_status, business_id')
      .eq('id', dto.shift_id)
      .single();

    if (shiftErr || !shift) throw new NotFoundException('Turno no encontrado');
    if (shift.user_id !== userId) {
      throw new BadRequestException('El turno no pertenece al usuario');
    }
    if (shift.shift_status === 'closed') {
      throw new BadRequestException('El turno está cerrado');
    }
    if (shift.shift_status === 'break') {
      throw new BadRequestException('No se pueden registrar ventas en colación');
    }

    // 2) Obtener productos con precios y costo
    const productIds = dto.items.map((i) => i.product_id);
    const { data: products, error: prodErr } = await this.admin
      .from('products')
      .select('id, name, sale_price, cost_price, stock, is_active')
      .in('id', productIds);

    if (prodErr) throw prodErr;
    if (!products || products.length !== productIds.length) {
      throw new NotFoundException('Uno o más productos no existen');
    }

    // 3) Validar stock y calcular totales
    const lineItems: any[] = [];
    let totalLineAmount = 0;

    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) throw new NotFoundException(`Producto ${item.product_id} no encontrado`);
      if (!product.is_active)
        throw new BadRequestException(`Producto ${product.name} no está activo`);
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para ${product.name} (disponible: ${product.stock})`,
        );
      }
      const lineTotal = Number(product.sale_price) * item.quantity;
      totalLineAmount += lineTotal;
      lineItems.push({
        product_id: product.id,
        quantity: item.quantity,
        price_at_sale: product.sale_price,
        cost_at_sale: product.cost_price,
        line_total: lineTotal,
      });
    }

    // 4) Crear venta con montos por método
    const { data: sale, error: saleErr } = await this.admin
      .from('sales')
      .insert({
        shift_id: dto.shift_id,
        user_id: userId,
        business_id: businessId || shift.business_id,
        cash_amount: dto.cash_amount,
        card_amount: dto.card_amount,
        transfer_amount: dto.transfer_amount,
        total: dto.cash_amount + dto.card_amount + dto.transfer_amount,
        items_count: dto.items.reduce((acc, i) => acc + i.quantity, 0),
      })
      .select()
      .single();

    if (saleErr) throw saleErr;

    // 5) Insertar items (el trigger descuenta stock atómicamente)
    const itemsWithSaleId = lineItems.map((li) => ({ ...li, sale_id: sale.id }));
    const { error: itemsErr } = await this.admin.from('sale_items').insert(itemsWithSaleId);

    if (itemsErr) {
      // Rollback manual si falló
      await this.admin.from('sales').delete().eq('id', sale.id);
      throw itemsErr;
    }

    // 6) Descontar ingredientes según recetas (si el producto tiene receta)
    // Esto se ejecuta DESPUÉS de crear los sale_items para asegurar atomicidad
    for (const item of dto.items) {
      try {
        await this.admin.rpc('deduct_recipe_ingredients', {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
          p_sale_id: sale.id,
        });
      } catch (recipeErr) {
        // Si falla la receta, hacer rollback completo
        await this.admin.from('sales').delete().eq('id', sale.id);
        throw new BadRequestException(
          `Stock insuficiente de ingredientes para producto. ${(recipeErr as any)?.message ?? ''}`,
        );
      }
    }

    // 7) Actualizar totales agregados en el turno
    await this.refreshShiftTotals(dto.shift_id);

    return { ...sale, items: itemsWithSaleId };
  }

  private async refreshShiftTotals(shiftId: string) {
    const { data: sales } = await this.admin
      .from('sales')
      .select('cash_amount, card_amount, transfer_amount')
      .eq('shift_id', shiftId);

    const totalSales = (sales ?? []).reduce(
      (a, s) =>
        a +
        Number(s.cash_amount || 0) +
        Number(s.card_amount || 0) +
        Number(s.transfer_amount || 0),
      0,
    );
    const totalCashSales = (sales ?? []).reduce((a, s) => a + Number(s.cash_amount || 0), 0);
    const totalCardSales = (sales ?? []).reduce((a, s) => a + Number(s.card_amount || 0), 0);
    const totalTransferSales = (sales ?? []).reduce(
      (a, s) => a + Number(s.transfer_amount || 0),
      0,
    );

    await this.admin
      .from('shifts')
      .update({
        total_sales: totalSales,
        total_cash_sales: totalCashSales,
        total_card_sales: totalCardSales,
        total_transfer_sales: totalTransferSales,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shiftId);
  }

  async findByShift(shiftId: string) {
    const { data, error } = await this.admin
      .from('sales')
      .select('*, items:sale_items(*)')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async findByBusiness(businessId: string, limit = 50) {
    const { data, error } = await this.admin
      .from('sales')
      .select(
        `
        *,
        user:profiles!sales_user_id_fkey(full_name),
        shift:shifts(id, shift_date)
      `,
      )
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }
}
