import { describe, expect, it } from 'vitest';
import { formatCLP, formatNumberCL, parseCLP, formatPercent } from './format';

describe('formatCLP', () => {
  it('formatea con símbolo $ y separador de miles', () => {
    expect(formatCLP(1500)).toBe('$1.500');
    expect(formatCLP(1234567)).toBe('$1.234.567');
  });

  it('cero se formatea como $0', () => {
    expect(formatCLP(0)).toBe('$0');
  });

  it('no muestra decimales (CLP no usa centavos)', () => {
    expect(formatCLP(1500.99)).toMatch(/\$1\.501|\$1\.500/); // Intl puede redondear
  });

  it('acepta números negativos', () => {
    const result = formatCLP(-500);
    expect(result).toContain('500');
    expect(result).toContain('-');
  });
});

describe('formatNumberCL', () => {
  it('formatea sin símbolo de peso', () => {
    expect(formatNumberCL(1500)).toBe('1.500');
    expect(formatNumberCL(1234567)).toBe('1.234.567');
  });
});

describe('parseCLP', () => {
  it('parsea formatos comunes', () => {
    expect(parseCLP('$1.500')).toBe(1500);
    expect(parseCLP('1.500')).toBe(1500);
    expect(parseCLP('1500')).toBe(1500);
    expect(parseCLP('$1.234.567')).toBe(1234567);
  });

  it('parsea con decimales (coma como separador)', () => {
    expect(parseCLP('1.500,50')).toBe(1500.5);
  });

  it('retorna 0 para string vacío', () => {
    expect(parseCLP('')).toBe(0);
  });

  it('retorna 0 para input inválido', () => {
    expect(parseCLP('abc')).toBe(0);
    expect(parseCLP('$')).toBe(0);
  });

  it('maneja espacios', () => {
    expect(parseCLP('$ 1.500')).toBe(1500);
  });

  it('roundtrip con formatCLP', () => {
    const original = 1234567;
    const formatted = formatCLP(original);
    const parsed = parseCLP(formatted);
    expect(parsed).toBe(original);
  });
});

describe('formatPercent', () => {
  it('formatea como porcentaje', () => {
    expect(formatPercent(0.234)).toMatch(/23[,.]4\s?%/);
    expect(formatPercent(0.5)).toMatch(/50[,.]0\s?%/);
    expect(formatPercent(1)).toMatch(/100[,.]0\s?%/);
  });

  it('respeta el parámetro decimals', () => {
    expect(formatPercent(0.23456, 0)).toMatch(/23\s?%/);
    expect(formatPercent(0.23456, 2)).toMatch(/23[,.]46\s?%/);
  });

  it('acepta cero', () => {
    expect(formatPercent(0)).toMatch(/0[,.]0\s?%/);
  });
});