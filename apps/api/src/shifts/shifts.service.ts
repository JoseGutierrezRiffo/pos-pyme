import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../common/supabase.module';
import { EmailService } from '../common/email.service';
import { OpenShiftDto, CloseShiftDto, CashWithdrawalDto } from '@pos-pyme/validation';
import { evaluateShiftClose } from '@pos-pyme/business-rules';

@Injectable()
export class ShiftsService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient,
    private readonly emailService: EmailService,
  ) {}

  async getCurrentOpenShift(userId: string, businessId?: string) {
    const baseQuery = this.admin
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .in('shift_status', ['open', 'break'])
      .order('opened_at', { ascending: false })
      .limit(1);

    const query = businessId
      ? baseQuery.eq('business_id', businessId).maybeSingle()
      : baseQuery.maybeSingle();

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async open(userId: string, dto: OpenShiftDto, businessId: string) {
    const existing = await this.getCurrentOpenShift(userId, businessId);
    if (existing) {
      throw new BadRequestException('Ya tienes un turno abierto');
    }

    const { data, error } = await this.admin
      .from('shifts')
      .insert({
        user_id: userId,
        cash_initial: dto.cash_initial,
        shift_status: 'open',
        shift_date: new Date().toISOString().slice(0, 10),
        business_id: businessId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async startBreak(userId: string, businessId?: string) {
    const shift = await this.getCurrentOpenShift(userId, businessId);
    if (!shift) throw new NotFoundException('No hay turno abierto');
    if (shift.shift_status === 'break') {
      throw new BadRequestException('Ya estás en colación');
    }

    const { data, error } = await this.admin
      .from('shifts')
      .update({
        shift_status: 'break',
        break_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', shift.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async endBreak(userId: string, businessId?: string) {
    const shift = await this.getCurrentOpenShift(userId, businessId);
    if (!shift) throw new NotFoundException('No hay turno abierto');
    if (shift.shift_status !== 'break') {
      throw new BadRequestException('No estás en colación');
    }

    const { data, error } = await this.admin
      .from('shifts')
      .update({
        shift_status: 'open',
        break_ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', shift.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async addWithdrawal(userId: string, dto: CashWithdrawalDto, businessId?: string) {
    const shift = await this.getCurrentOpenShift(userId, businessId);
    if (!shift) throw new NotFoundException('No hay turno abierto');

    const { data, error } = await this.admin
      .from('cash_withdrawals')
      .insert({
        shift_id: shift.id,
        user_id: userId,
        amount: dto.amount,
        reason: dto.reason,
        note: dto.note,
      })
      .select()
      .single();
    if (error) throw error;

    // Acumular en el turno
    await this.admin
      .from('shifts')
      .update({
        cash_withdrawals: Number(shift.cash_withdrawals || 0) + dto.amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shift.id);

    return data;
  }

  async close(userId: string, dto: CloseShiftDto, businessId?: string) {
    const shift = await this.getCurrentOpenShift(userId, businessId);
    if (!shift) throw new NotFoundException('No hay turno abierto');
    if (shift.shift_status === 'closed') {
      throw new BadRequestException('El turno ya está cerrado');
    }

    // Recalcular ventas del turno por método de pago
    const { data: salesAgg } = await this.admin
      .from('sales')
      .select('cash_amount, card_amount, transfer_amount')
      .eq('shift_id', shift.id);

    const totalCashSales = (salesAgg ?? []).reduce((acc, s) => acc + Number(s.cash_amount || 0), 0);
    const totalCardSales = (salesAgg ?? []).reduce((acc, s) => acc + Number(s.card_amount || 0), 0);
    const totalTransferSales = (salesAgg ?? []).reduce(
      (acc, s) => acc + Number(s.transfer_amount || 0),
      0,
    );
    const totalSales = totalCashSales + totalCardSales + totalTransferSales;

    // Calcular descuadre (solo ventas en efectivo cuentan para cash_expected)
    const result = evaluateShiftClose(
      Number(shift.cash_initial),
      totalCashSales,
      Number(shift.cash_withdrawals || 0),
      dto.cash_declared,
    );

    const { data, error } = await this.admin
      .from('shifts')
      .update({
        shift_status: 'closed',
        closed_at: new Date().toISOString(),
        cash_declared: dto.cash_declared,
        cash_expected: result.expectedCash,
        discrepancy: result.discrepancy,
        total_sales: totalSales,
        total_cash_sales: totalCashSales,
        total_card_sales: totalCardSales,
        total_transfer_sales: totalTransferSales,
        notes: dto.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shift.id)
      .select()
      .single();
    if (error) throw error;

    // Enviar email a admins notificando cierre
    this.notifyAdminsShiftClosed(shift, result.discrepancy, totalSales).catch((err) =>
      console.error('Error enviando email de cierre:', err),
    );

    return {
      ...data,
      status_label: result.status,
      direction: result.direction,
    };
  }

  async findAll(limit = 50, businessId?: string) {
    let query = this.admin
      .from('shifts')
      .select('*, user:profiles!shifts_user_id_fkey(full_name, email)')
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async findById(id: string) {
    const { data, error } = await this.admin
      .from('shifts')
      .select(
        `
        *,
        user:profiles!shifts_user_id_fkey(full_name, email),
        withdrawals:cash_withdrawals(*),
        sales(*, items:sale_items(*))
      `,
      )
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('Turno no encontrado');
    return data;
  }

  /**
   * Resumen diario agregado para el calendario del admin.
   */
  async getDailySummary(from?: string, to?: string, businessId?: string) {
    let shiftsQuery = this.admin
      .from('shifts')
      .select(
        `
        shift_date, user_id, shift_status, total_sales,
        total_cash_sales, total_card_sales, total_transfer_sales,
        cash_withdrawals, discrepancy, opened_at, closed_at,
        break_started_at, break_ended_at, business_id
      `,
      )
      .eq('shift_status', 'closed')
      .order('shift_date', { ascending: false });

    if (businessId) {
      shiftsQuery = shiftsQuery.eq('business_id', businessId);
    }
    if (from) shiftsQuery = shiftsQuery.gte('shift_date', from);
    if (to) shiftsQuery = shiftsQuery.lte('shift_date', to);

    const { data: shiftsData, error: shiftsErr } = await shiftsQuery;
    if (shiftsErr) throw shiftsErr;

    // Traer ventas
    let salesQuery = this.admin
      .from('sales')
      .select(
        'id, cash_amount, card_amount, transfer_amount, shift:shifts!inner(shift_date), items:sale_items(quantity)',
      );
    if (businessId) salesQuery = salesQuery.eq('business_id', businessId);
    if (from) salesQuery = salesQuery.gte('shift.shift_date', from);
    if (to) salesQuery = salesQuery.lte('shift.shift_date', to);

    const { data: salesData, error: salesErr } = await salesQuery;
    if (salesErr) throw salesErr;

    // Traer retiros
    let withdrawalsQuery = this.admin
      .from('cash_withdrawals')
      .select('amount, shift:shifts!inner(shift_date, business_id)');
    if (businessId) withdrawalsQuery = withdrawalsQuery.eq('shift.business_id', businessId);
    if (from) withdrawalsQuery = withdrawalsQuery.gte('shift.shift_date', from);
    if (to) withdrawalsQuery = withdrawalsQuery.lte('shift.shift_date', to);

    const { data: withdrawalsData, error: withdrawalsErr } = await withdrawalsQuery;
    if (withdrawalsErr) throw withdrawalsErr;

    // Agregar por día
    const byDate = new Map<string, any>();

    const ensureDay = (date: string) => {
      if (!byDate.has(date)) {
        byDate.set(date, {
          date,
          shifts_count: 0,
          workers: new Set<string>(),
          total_sales: 0,
          total_cash_sales: 0,
          total_card_sales: 0,
          total_transfer_sales: 0,
          cash_withdrawals: 0,
          discrepancies: [],
          breaks_count: 0,
          total_break_minutes: 0,
          items_sold: 0,
          sales_count: 0,
          withdrawals_count: 0,
        });
      }
      return byDate.get(date);
    };

    for (const s of shiftsData ?? []) {
      const day = ensureDay(s.shift_date);
      day.shifts_count += 1;
      day.workers.add(s.user_id);
      day.total_sales += Number(s.total_sales || 0);
      day.total_cash_sales += Number(s.total_cash_sales || 0);
      day.total_card_sales += Number(s.total_card_sales || 0);
      day.total_transfer_sales += Number(s.total_transfer_sales || 0);
      day.cash_withdrawals += Number(s.cash_withdrawals || 0);
      if (s.discrepancy !== null) day.discrepancies.push(Number(s.discrepancy));
      if (s.break_started_at && s.break_ended_at) {
        day.breaks_count += 1;
        const minutes = Math.round(
          (new Date(s.break_ended_at).getTime() - new Date(s.break_started_at).getTime()) / 60000,
        );
        day.total_break_minutes += minutes;
      }
    }

    for (const sale of salesData ?? []) {
      const shift = sale.shift as any;
      if (!shift?.shift_date) continue;
      const day = ensureDay(shift.shift_date);
      day.sales_count += 1;
      for (const item of sale.items ?? []) {
        day.items_sold += Number(item.quantity);
      }
    }

    for (const w of withdrawalsData ?? []) {
      const shift = w.shift as any;
      if (!shift?.shift_date) continue;
      const day = ensureDay(shift.shift_date);
      day.withdrawals_count += 1;
    }

    return Array.from(byDate.values())
      .map((d: any) => {
        const abs = d.discrepancies.map((x: number) => Math.abs(x));
        const maxAbs = abs.length ? Math.max(...abs) : 0;
        const avg = abs.length ? abs.reduce((a: number, b: number) => a + b, 0) / abs.length : 0;
        const status: 'OK' | 'ATENCION' | 'CRITICO' =
          maxAbs > 3000 ? 'CRITICO' : maxAbs > 1000 ? 'ATENCION' : 'OK';
        return {
          date: d.date,
          shifts_count: d.shifts_count,
          workers_count: d.workers.size,
          total_sales: d.total_sales,
          total_cash_sales: d.total_cash_sales,
          total_card_sales: d.total_card_sales,
          total_transfer_sales: d.total_transfer_sales,
          cash_withdrawals: d.cash_withdrawals,
          avg_discrepancy: avg,
          max_discrepancy: maxAbs,
          status,
          breaks_count: d.breaks_count,
          total_break_minutes: d.total_break_minutes,
          items_sold: d.items_sold,
          sales_count: d.sales_count,
          withdrawals_count: d.withdrawals_count,
        };
      })
      .sort((a: any, b: any) => b.date.localeCompare(a.date));
  }

  async findByDate(date: string, businessId?: string) {
    let query = this.admin
      .from('shifts')
      .select(
        `
        *,
        user:profiles!shifts_user_id_fkey(full_name, email),
        withdrawals:cash_withdrawals(*),
        sales(
          id, cash_amount, card_amount, transfer_amount, created_at,
          items:sale_items(product_id, quantity, price_at_sale, line_total)
        )
      `,
      )
      .eq('shift_date', date)
      .order('opened_at');

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((s: any) => {
      const sales = s.sales ?? [];
      const items_sold = sales.reduce(
        (acc: number, sale: any) =>
          acc + (sale.items ?? []).reduce((a: number, i: any) => a + Number(i.quantity), 0),
        0,
      );
      return { ...s, items_sold, sales_count: sales.length };
    });
  }

  /**
   * Envía email a todos los admins cuando un turno se cierra.
   */
  private async notifyAdminsShiftClosed(shift: any, discrepancy: number, totalSales: number) {
    if (!shift.business_id) return;

    const { data: admins } = await this.admin
      .from('profiles')
      .select('email, full_name')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (!admins?.length) return;

    const workerName = shift.user?.full_name ?? 'Trabajador';

    for (const admin of admins) {
      try {
        await this.emailService.sendShiftClosedEmail(
          admin.email,
          workerName,
          totalSales,
          discrepancy,
        );
        console.log(`Email enviado a admin: ${admin.email}`);
      } catch (err) {
        console.error(`Error enviando email a ${admin.email}:`, err);
      }
    }
  }
}
