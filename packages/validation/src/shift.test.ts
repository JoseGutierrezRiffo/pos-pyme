import { describe, expect, it } from 'vitest';
import { OpenShiftSchema, CloseShiftSchema, CashWithdrawalSchema } from './shift';

describe('OpenShiftSchema', () => {
  it('acepta cash_initial positivo', () => {
    const r = OpenShiftSchema.safeParse({ cash_initial: 20000 });
    expect(r.success).toBe(true);
  });

  it('rechaza cash_initial cero', () => {
    const r = OpenShiftSchema.safeParse({ cash_initial: 0 });
    expect(r.success).toBe(false);
  });

  it('rechaza cash_initial negativo', () => {
    const r = OpenShiftSchema.safeParse({ cash_initial: -100 });
    expect(r.success).toBe(false);
  });

  it('rechaza falta de cash_initial', () => {
    const r = OpenShiftSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe('CloseShiftSchema', () => {
  it('acepta cash_declared y notes opcionales', () => {
    const r = CloseShiftSchema.safeParse({
      cash_declared: 25500,
      notes: 'OK',
    });
    expect(r.success).toBe(true);
  });

  it('acepta cash_declared cero (cierre sin ventas)', () => {
    const r = CloseShiftSchema.safeParse({ cash_declared: 0 });
    expect(r.success).toBe(true);
  });

  it('rechaza cash_declared negativo', () => {
    const r = CloseShiftSchema.safeParse({ cash_declared: -1 });
    expect(r.success).toBe(false);
  });

  it('acepta notes ausentes', () => {
    const r = CloseShiftSchema.safeParse({ cash_declared: 100 });
    expect(r.success).toBe(true);
  });

  it('rechaza notes > 500 chars', () => {
    const r = CloseShiftSchema.safeParse({
      cash_declared: 100,
      notes: 'x'.repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe('CashWithdrawalSchema', () => {
  it('acepta retiro válido', () => {
    const r = CashWithdrawalSchema.safeParse({
      amount: 5000,
      reason: 'compra_insumos',
      note: 'bolsas de basura',
    });
    expect(r.success).toBe(true);
  });

  it('acepta razones válidas', () => {
    for (const reason of ['compra_insumos', 'gasto_operativo', 'pago_proveedor', 'otro']) {
      const r = CashWithdrawalSchema.safeParse({ amount: 1000, reason });
      expect(r.success).toBe(true);
    }
  });

  it('rechaza razón inválida', () => {
    const r = CashWithdrawalSchema.safeParse({
      amount: 1000,
      reason: 'compra_alcohol',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza amount cero o negativo', () => {
    expect(CashWithdrawalSchema.safeParse({ amount: 0, reason: 'otro' }).success).toBe(false);
    expect(CashWithdrawalSchema.safeParse({ amount: -100, reason: 'otro' }).success).toBe(false);
  });

  it('note es opcional', () => {
    const r = CashWithdrawalSchema.safeParse({ amount: 1000, reason: 'otro' });
    expect(r.success).toBe(true);
  });

  it('rechaza note > 200 chars', () => {
    const r = CashWithdrawalSchema.safeParse({
      amount: 1000,
      reason: 'otro',
      note: 'x'.repeat(201),
    });
    expect(r.success).toBe(false);
  });
});