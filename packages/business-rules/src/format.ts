/**
 * Formateo de moneda y números para Chile (CLP).
 */

/**
 * Formatea un número como peso chileno.
 * 1500 → "$1.500"
 */
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea un número como peso chileno SIN símbolo.
 * 1500 → "1.500"
 */
export function formatNumberCL(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parsea un string de input a número CLP.
 * Acepta "$1.500", "1.500", "1500", "1.500,50"
 */
export function parseCLP(input: string): number {
  if (!input) return 0;
  // Quitar símbolo de peso y espacios
  const cleaned = input.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formatea un porcentaje.
 * 0.234 → "23,4%"
 */
export function formatPercent(value: number, decimals = 1): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
