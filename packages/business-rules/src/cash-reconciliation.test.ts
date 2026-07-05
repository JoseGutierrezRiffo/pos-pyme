import { describe, expect, it } from 'vitest';
import {
  calculateExpectedCash,
  calculateDiscrepancy,
  classifyDiscrepancy,
  evaluateShiftClose,
  DEFAULT_DISCREPANCY_CONFIG,
} from './cash-reconciliation';

describe('calculateExpectedCash', () => {
  it('calcula expected = initial + ventas_efectivo - retiros', () => {
    expect(calculateExpectedCash(20000, 4500, 0)).toBe(24500);
    expect(calculateExpectedCash(20000, 15000, 5000)).toBe(30000);
    expect(calculateExpectedCash(0, 0, 0)).toBe(0);
  });

  it('lanza error si initialCash es negativo', () => {
    expect(() => calculateExpectedCash(-100, 0, 0)).toThrow('initialCash must be >= 0');
  });

  it('lanza error si cashSales es negativo', () => {
    expect(() => calculateExpectedCash(0, -100, 0)).toThrow('cashSales must be >= 0');
  });

  it('lanza error si withdrawals es negativo', () => {
    expect(() => calculateExpectedCash(0, 0, -100)).toThrow('withdrawals must be >= 0');
  });
});

describe('calculateDiscrepancy', () => {
  it('positivo cuando sobra', () => {
    expect(calculateDiscrepancy(25500, 24500)).toBe(1000);
  });

  it('negativo cuando falta', () => {
    expect(calculateDiscrepancy(24000, 24500)).toBe(-500);
  });

  it('cero cuando cuadra exacto', () => {
    expect(calculateDiscrepancy(24500, 24500)).toBe(0);
  });
});

describe('classifyDiscrepancy', () => {
  it('OK si |D| <= tolerance (default $1.000)', () => {
    expect(classifyDiscrepancy(0)).toBe('OK');
    expect(classifyDiscrepancy(500)).toBe('OK');
    expect(classifyDiscrepancy(-1000)).toBe('OK');
  });

  it('ATENCION si tolerance < |D| <= 3*tolerance', () => {
    expect(classifyDiscrepancy(1500)).toBe('ATENCION');
    expect(classifyDiscrepancy(3000)).toBe('ATENCION');
    expect(classifyDiscrepancy(-2500)).toBe('ATENCION');
  });

  it('CRITICO si |D| > 3*tolerance', () => {
    expect(classifyDiscrepancy(3500)).toBe('CRITICO');
    expect(classifyDiscrepancy(-10000)).toBe('CRITICO');
  });

  it('acepta config custom', () => {
    const config = { tolerance: 500, attentionMultiplier: 2 };
    expect(classifyDiscrepancy(400, config)).toBe('OK');
    expect(classifyDiscrepancy(800, config)).toBe('ATENCION');
    expect(classifyDiscrepancy(1500, config)).toBe('CRITICO');
  });

  it('usa DEFAULT_DISCREPANCY_CONFIG como default', () => {
    expect(DEFAULT_DISCREPANCY_CONFIG.tolerance).toBe(1000);
    expect(DEFAULT_DISCREPANCY_CONFIG.attentionMultiplier).toBe(3);
  });
});

describe('evaluateShiftClose', () => {
  it('combina expected + discrepancy + status + direction', () => {
    const result = evaluateShiftClose(20000, 5000, 0, 25500);
    expect(result).toEqual({
      expectedCash: 25000,
      discrepancy: 500,
      status: 'OK',
      direction: 'sobra',
    });
  });

  it('cuadre exacto', () => {
    const result = evaluateShiftClose(20000, 5000, 0, 25000);
    expect(result.discrepancy).toBe(0);
    expect(result.status).toBe('OK');
    expect(result.direction).toBe('cuadra');
  });

  it('descuadre CRITICO con direction falta', () => {
    const result = evaluateShiftClose(20000, 5000, 0, 20000);
    expect(result.expectedCash).toBe(25000);
    expect(result.discrepancy).toBe(-5000);
    expect(result.status).toBe('CRITICO');
    expect(result.direction).toBe('falta');
  });
});