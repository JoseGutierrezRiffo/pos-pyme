import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIN_STOCK,
  isLowStock,
  classifyStock,
  calculateMargin,
  calculateProfit,
} from './inventory';

describe('DEFAULT_MIN_STOCK', () => {
  it('es 3', () => {
    expect(DEFAULT_MIN_STOCK).toBe(3);
  });
});

describe('isLowStock', () => {
  it('retorna true si stock <= minStock', () => {
    expect(isLowStock(0, 3)).toBe(true);
    expect(isLowStock(3, 3)).toBe(true);
    expect(isLowStock(2, 3)).toBe(true);
  });

  it('retorna false si stock > minStock', () => {
    expect(isLowStock(4, 3)).toBe(false);
    expect(isLowStock(100, 3)).toBe(false);
  });

  it('usa DEFAULT_MIN_STOCK como minStock por defecto', () => {
    expect(isLowStock(3)).toBe(true);  // 3 <= 3
    expect(isLowStock(4)).toBe(false); // 4 > 3
  });
});

describe('classifyStock', () => {
  it('agotado si stock === 0', () => {
    expect(classifyStock(0, 5)).toBe('agotado');
  });

  it('bajo si 0 < stock <= minStock', () => {
    expect(classifyStock(1, 5)).toBe('bajo');
    expect(classifyStock(5, 5)).toBe('bajo');
  });

  it('disponible si minStock < stock <= 10*minStock', () => {
    expect(classifyStock(6, 5)).toBe('disponible');
    expect(classifyStock(50, 5)).toBe('disponible');
  });

  it('exceso si stock > 10*minStock', () => {
    expect(classifyStock(51, 5)).toBe('exceso');
    expect(classifyStock(1000, 5)).toBe('exceso');
  });
});

describe('calculateMargin', () => {
  it('calcula margen como (venta - costo) / venta', () => {
    expect(calculateMargin(70, 100)).toBeCloseTo(0.3, 5);
    expect(calculateMargin(50, 100)).toBeCloseTo(0.5, 5);
    expect(calculateMargin(0, 100)).toBe(1);
  });

  it('retorna 0 si venta <= 0', () => {
    expect(calculateMargin(100, 0)).toBe(0);
    expect(calculateMargin(100, -10)).toBe(0);
  });

  it('margen negativo si costo > venta', () => {
    expect(calculateMargin(120, 100)).toBeCloseTo(-0.2, 5);
  });

  it('retorna 1 si costo = 0', () => {
    expect(calculateMargin(0, 100)).toBe(1);
  });
});

describe('calculateProfit', () => {
  it('calcula ganancia bruta = (venta - costo) * qty', () => {
    expect(calculateProfit(70, 100, 1)).toBe(30);
    expect(calculateProfit(70, 100, 5)).toBe(150);
  });

  it('default qty = 1', () => {
    expect(calculateProfit(70, 100)).toBe(30);
  });

  it('negativo si costo > venta', () => {
    expect(calculateProfit(120, 100, 1)).toBe(-20);
  });

  it('cero si costo = venta', () => {
    expect(calculateProfit(100, 100, 10)).toBe(0);
  });
});