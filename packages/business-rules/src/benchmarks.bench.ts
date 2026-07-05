/**
 * Benchmarks de performance para los hot paths del negocio.
 * Ejecutar con: pnpm test:bench (configurar en package.json)
 *
 * Mide:
 *  - evaluateShiftClose: cierre completo de turno (3 sumas + comparación)
 *  - calculateExpectedCash: fórmula E = I + V - W
 *  - classifyDiscrepancy: threshold check con abs
 *  - formatCLP: Intl.NumberFormat (cold + warm)
 *  - parseCLP + formatCLP roundtrip: validación de input
 *
 * Baseline esperado: todas las funciones < 1µs en hardware moderno.
 */

import { bench, describe } from 'vitest';
import {
  calculateExpectedCash,
  calculateDiscrepancy,
  classifyDiscrepancy,
  evaluateShiftClose,
  formatCLP,
  parseCLP,
  calculateMargin,
  isLowStock,
  classifyStock,
} from './index';

describe('Cash reconciliation hot path', () => {
  bench('calculateExpectedCash', () => {
    calculateExpectedCash(20000, 5000, 1000);
  });

  bench('calculateDiscrepancy', () => {
    calculateDiscrepancy(25500, 24500);
  });

  bench('classifyDiscrepancy', () => {
    classifyDiscrepancy(1500);
  });

  bench('evaluateShiftClose (full close flow)', () => {
    evaluateShiftClose(20000, 5000, 1000, 25500);
  });
});

describe('Formatting hot path', () => {
  bench('formatCLP', () => {
    formatCLP(1234567);
  });

  bench('parseCLP', () => {
    parseCLP('$1.234.567');
  });

  bench('formatCLP + parseCLP roundtrip', () => {
    const formatted = formatCLP(1234567);
    parseCLP(formatted);
  });
});

describe('Inventory classification', () => {
  bench('isLowStock', () => {
    isLowStock(2, 5);
  });

  bench('classifyStock', () => {
    classifyStock(2, 5);
  });

  bench('calculateMargin', () => {
    calculateMargin(800, 1500);
  });
});