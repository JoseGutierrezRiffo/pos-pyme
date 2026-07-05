import { describe, expect, it } from 'vitest';
import { CreateSaleSchema, SaleItemSchema, PaymentMethod } from './sale';

describe('PaymentMethod', () => {
  it('tiene los 3 métodos canónicos', () => {
    expect(PaymentMethod.efectivo).toBe('efectivo');
    expect(PaymentMethod.tarjeta).toBe('tarjeta');
    expect(PaymentMethod.transferencia).toBe('transferencia');
  });
});

describe('SaleItemSchema', () => {
  it('acepta product_id uuid + quantity positivo', () => {
    const r = SaleItemSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 2,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza product_id no-uuid', () => {
    const r = SaleItemSchema.safeParse({ product_id: 'abc', quantity: 1 });
    expect(r.success).toBe(false);
  });

  it('rechaza quantity cero o negativo', () => {
    expect(SaleItemSchema.safeParse({ product_id: '550e8400-e29b-41d4-a716-446655440000', quantity: 0 }).success).toBe(false);
    expect(SaleItemSchema.safeParse({ product_id: '550e8400-e29b-41d4-a716-446655440000', quantity: -1 }).success).toBe(false);
  });

  it('acepta quantity decimal (productos por peso)', () => {
    const r = SaleItemSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 0.5,
    });
    expect(r.success).toBe(true);
  });
});

describe('CreateSaleSchema', () => {
  const validItem = {
    product_id: '550e8400-e29b-41d4-a716-446655440000',
    quantity: 1,
  };
  const validShiftId = '660e8400-e29b-41d4-a716-446655440000';

  it('acepta venta 100% efectivo', () => {
    const r = CreateSaleSchema.safeParse({
      shift_id: validShiftId,
      cash_amount: 5000,
      card_amount: 0,
      transfer_amount: 0,
      items: [validItem],
    });
    expect(r.success).toBe(true);
  });

  it('acepta venta mixta (efectivo + tarjeta)', () => {
    const r = CreateSaleSchema.safeParse({
      shift_id: validShiftId,
      cash_amount: 2500,
      card_amount: 2500,
      transfer_amount: 0,
      items: [validItem],
    });
    expect(r.success).toBe(true);
  });

  it('acepta venta 100% tarjeta', () => {
    const r = CreateSaleSchema.safeParse({
      shift_id: validShiftId,
      cash_amount: 0,
      card_amount: 5000,
      transfer_amount: 0,
      items: [validItem],
    });
    expect(r.success).toBe(true);
  });

  it('rechaza venta sin items', () => {
    const r = CreateSaleSchema.safeParse({
      shift_id: validShiftId,
      cash_amount: 5000,
      card_amount: 0,
      transfer_amount: 0,
      items: [],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza venta con todos los montos en 0 (refine)', () => {
    const r = CreateSaleSchema.safeParse({
      shift_id: validShiftId,
      cash_amount: 0,
      card_amount: 0,
      transfer_amount: 0,
      items: [validItem],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('método de pago'))).toBe(true);
    }
  });

  it('rechaza monto negativo', () => {
    const r = CreateSaleSchema.safeParse({
      shift_id: validShiftId,
      cash_amount: -100,
      card_amount: 0,
      transfer_amount: 0,
      items: [validItem],
    });
    expect(r.success).toBe(false);
  });

  it('acepta múltiples items', () => {
    const r = CreateSaleSchema.safeParse({
      shift_id: validShiftId,
      cash_amount: 10000,
      card_amount: 0,
      transfer_amount: 0,
      items: [
        validItem,
        { product_id: '770e8400-e29b-41d4-a716-446655440000', quantity: 3 },
      ],
    });
    expect(r.success).toBe(true);
  });
});