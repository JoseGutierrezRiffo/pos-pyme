/**
 * Smoke test E2E: simula un turno completo usando solo las reglas de negocio.
 * Sin backend, sin Supabase — solo lógica pura.
 *
 * Cobertura:
 *   - Apertura de turno con validación Zod
 *   - Múltiples ventas con métodos de pago mixtos
 *   - Retiros parciales
 *   - Cierre con conteo ciego
 *   - Cálculo de descuadre y status
 *   - Reporte diario agregado
 *
 * Si este test pasa, las reglas core del flujo de caja son correctas.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateShiftClose,
  classifyStock,
  isLowStock,
  formatCLP,
  parseCLP,
  classifyDiscrepancy,
} from '@pos-pyme/business-rules';
import {
  OpenShiftSchema,
  CloseShiftSchema,
  CashWithdrawalSchema,
  CreateSaleSchema,
} from '@pos-pyme/validation';

const SHIFT_ID = '550e8400-e29b-41d4-a716-446655440000';
const PRODUCT_COCA = '660e8400-e29b-41d4-a716-446655440000';
const PRODUCT_PAPAS = '770e8400-e29b-41d4-a716-446655440000';

describe('Smoke E2E: Turno completo de trabajador', () => {
  it('escenario feliz: turno cuadra exacto', () => {
    // 1. Apertura de turno con $20.000
    const open = OpenShiftSchema.safeParse({ cash_initial: 20000 });
    expect(open.success).toBe(true);
    if (!open.success) return;

    // 2. Venta #1: 2 cocas en efectivo ($5.000)
    const sale1 = CreateSaleSchema.safeParse({
      shift_id: SHIFT_ID,
      cash_amount: 5000,
      card_amount: 0,
      transfer_amount: 0,
      items: [{ product_id: PRODUCT_COCA, quantity: 2 }],
    });
    expect(sale1.success).toBe(true);
    if (!sale1.success) return;

    // 3. Venta #2: mixto - $2.000 efectivo + $1.500 tarjeta
    const sale2 = CreateSaleSchema.safeParse({
      shift_id: SHIFT_ID,
      cash_amount: 2000,
      card_amount: 1500,
      transfer_amount: 0,
      items: [{ product_id: PRODUCT_PAPAS, quantity: 1 }],
    });
    expect(sale2.success).toBe(true);
    if (!sale2.success) return;

    // 4. Retiro de $3.000 para compra de insumos
    const withdrawal = CashWithdrawalSchema.safeParse({
      amount: 3000,
      reason: 'compra_insumos',
      note: 'bolsas',
    });
    expect(withdrawal.success).toBe(true);
    if (!withdrawal.success) return;

    // 5. Cierre: el trabajador cuenta $24.000 (cuadra exacto)
    const close = CloseShiftSchema.safeParse({
      cash_declared: 24000,
      notes: 'OK',
    });
    expect(close.success).toBe(true);
    if (!close.success) return;

    // Verificación
    const result = evaluateShiftClose(20000, 7000, 3000, 24000);
    expect(result.expectedCash).toBe(24000);
    expect(result.discrepancy).toBe(0);
    expect(result.status).toBe('OK');
    expect(result.direction).toBe('cuadra');

    // Reporte
    expect(formatCLP(result.expectedCash)).toBe('$24.000');
  });

  it('turno con descuadre CRITICO (sobra dinero)', () => {
    // $10.000 inicial, $5.000 en ventas efectivo, $0 retiros
    // Calcula esperado: $15.000
    // Trabajador cuenta $18.500 (sobran $3.500)
    const result = evaluateShiftClose(10000, 5000, 0, 18500);

    expect(result.expectedCash).toBe(15000);
    expect(result.discrepancy).toBe(3500);
    expect(result.status).toBe('CRITICO'); // > 3 * $1.000 = $3.000
    expect(result.direction).toBe('sobra');
    expect(formatCLP(result.discrepancy)).toBe('$3.500');
  });

  it('turno con descuadre menor ATENCION (falta poco)', () => {
    // $20.000 inicial, $8.000 ventas efectivo, $1.000 retiros
    // Esperado: $27.000
    // Cuenta $25.500 (faltan $1.500)
    const result = evaluateShiftClose(20000, 8000, 1000, 25500);

    expect(result.expectedCash).toBe(27000);
    expect(result.discrepancy).toBe(-1500);
    expect(result.status).toBe('ATENCION');
    expect(result.direction).toBe('falta');
  });

  it('turno sin ventas (solo apertura y cierre)', () => {
    // Trabajador abrió turno y se fue sin ventas
    const result = evaluateShiftClose(20000, 0, 0, 20000);
    expect(result.expectedCash).toBe(20000);
    expect(result.discrepancy).toBe(0);
    expect(result.status).toBe('OK');
  });

  it('rechaza apertura con monto cero o negativo', () => {
    expect(OpenShiftSchema.safeParse({ cash_initial: 0 }).success).toBe(false);
    expect(OpenShiftSchema.safeParse({ cash_initial: -100 }).success).toBe(false);
  });

  it('rechaza venta sin items', () => {
    const r = CreateSaleSchema.safeParse({
      shift_id: SHIFT_ID,
      cash_amount: 1000,
      card_amount: 0,
      transfer_amount: 0,
      items: [],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza venta sin monto en ningún método', () => {
    const r = CreateSaleSchema.safeParse({
      shift_id: SHIFT_ID,
      cash_amount: 0,
      card_amount: 0,
      transfer_amount: 0,
      items: [{ product_id: PRODUCT_COCA, quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza retiro sin razón válida', () => {
    expect(
      CashWithdrawalSchema.safeParse({
        amount: 1000,
        reason: 'regalo_al_jefe',
      }).success,
    ).toBe(false);
  });

  it('flujo de inventario: clasifica productos correctamente', () => {
    const items = [
      { name: 'Coca-Cola', stock: 50, minStock: 5 },
      { name: 'Papas Lays', stock: 2, minStock: 5 },
      { name: 'Sprite', stock: 0, minStock: 5 },
      { name: 'Fanta', stock: 200, minStock: 5 },
    ];

    const clasificados = items.map((i) => ({
      ...i,
      status: classifyStock(i.stock, i.minStock),
      alerta: isLowStock(i.stock, i.minStock),
    }));

    expect(clasificados[0]).toMatchObject({ name: 'Coca-Cola', status: 'disponible', alerta: false });
    expect(clasificados[1]).toMatchObject({ name: 'Papas Lays', status: 'bajo', alerta: true });
    expect(clasificados[2]).toMatchObject({ name: 'Sprite', status: 'agotado', alerta: true });
    expect(clasificados[3]).toMatchObject({ name: 'Fanta', status: 'exceso', alerta: false });
  });

  it('roundtrip parseCLP/formatCLP con valores del flujo', () => {
    // Simula input del POS con formato CLP
    const inputs = ['$20.000', '5.500', '$1.234.567', '0'];
    const expected = [20000, 5500, 1234567, 0];

    inputs.forEach((input, i) => {
      const parsed = parseCLP(input);
      expect(parsed).toBe(expected[i]);
      const reformatted = formatCLP(parsed);
      // Roundtrip: re-parsear el formato debe dar el mismo número
      expect(parseCLP(reformatted)).toBe(expected[i]);
    });
  });

  it('cierre respeta validación Zod', () => {
    // Cierre con monto declarado válido
    expect(
      CloseShiftSchema.safeParse({
        cash_declared: 25000,
        notes: 'Cierre normal',
      }).success,
    ).toBe(true);

    // Cierre con monto negativo: rechazado
    expect(
      CloseShiftSchema.safeParse({
        cash_declared: -100,
      }).success,
    ).toBe(false);

    // Cierre sin monto declarado: rechazado
    expect(CloseShiftSchema.safeParse({}).success).toBe(false);
  });

  it('agregación de resumen diario (simulado)', () => {
    // Simula 2 turnos cerrados en el día
    const turnos = [
      {
        total_sales: 25000,
        total_cash_sales: 25000,
        total_card_sales: 0,
        total_transfer_sales: 0,
        cash_withdrawals: 0,
        discrepancy: 0,
        break_started_at: null,
        break_ended_at: null,
      },
      {
        total_sales: 18000,
        total_cash_sales: 8000,
        total_card_sales: 7000,
        total_transfer_sales: 3000,
        cash_withdrawals: 5000,
        discrepancy: -500,
        break_started_at: '2026-07-03T13:00:00Z',
        break_ended_at: '2026-07-03T13:30:00Z',
      },
    ];

    const resumen = turnos.reduce(
      (acc, t) => ({
        ventas: acc.ventas + t.total_sales,
        efectivo: acc.efectivo + t.total_cash_sales,
        tarjeta: acc.tarjeta + t.total_card_sales,
        transferencia: acc.transferencia + t.total_transfer_sales,
        retiros: acc.retiros + t.cash_withdrawals,
        breaks: acc.breaks + (t.break_started_at && t.break_ended_at ? 1 : 0),
        discrepancias: [...acc.discrepancias, t.discrepancy],
      }),
      { ventas: 0, efectivo: 0, tarjeta: 0, transferencia: 0, retiros: 0, breaks: 0, discrepancias: [] as number[] },
    );

    expect(resumen.ventas).toBe(43000);
    expect(resumen.efectivo).toBe(33000);
    expect(resumen.tarjeta).toBe(7000);
    expect(resumen.transferencia).toBe(3000);
    expect(resumen.retiros).toBe(5000);
    expect(resumen.breaks).toBe(1);

    // Status del peor descuadre del día
    const peorDiscrepancia = Math.max(...resumen.discrepancias.map(Math.abs));
    expect(classifyDiscrepancy(peorDiscrepancia)).toBe('OK'); // 500 está dentro de tolerance 1000
  });
});