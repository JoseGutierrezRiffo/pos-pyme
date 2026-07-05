/**
 * Reglas de negocio para el cuadre de caja.
 * Fuente de verdad: obsidian/04_Business_Rules/REGLA_Cuadre_Caja.md
 */

/**
 * Calcula el efectivo esperado en caja al final del turno.
 * E = I + V_c - W
 *
 * @param initialCash       I - Efectivo inicial con el que se abre la caja
 * @param cashSales         V_c - Suma de ventas en efectivo del turno
 * @param withdrawals       W - Suma de retiros parciales del turno
 * @returns Efectivo esperado (teórico)
 */
export function calculateExpectedCash(
  initialCash: number,
  cashSales: number,
  withdrawals: number,
): number {
  if (initialCash < 0) throw new Error('initialCash must be >= 0');
  if (cashSales < 0) throw new Error('cashSales must be >= 0');
  if (withdrawals < 0) throw new Error('withdrawals must be >= 0');
  return initialCash + cashSales - withdrawals;
}

/**
 * Calcula el descuadre: diferencia entre lo declarado y lo esperado.
 * D = D_decl - E
 *
 * Positivo: sobra dinero
 * Negativo: falta dinero
 * Cero: cuadre perfecto
 */
export function calculateDiscrepancy(declaredCash: number, expectedCash: number): number {
  return declaredCash - expectedCash;
}

/** Estado de clasificación del descuadre */
export type DiscrepancyStatus = 'OK' | 'ATENCION' | 'CRITICO';

export interface DiscrepancyConfig {
  /** Umbral de tolerancia. Default: $1.000 CLP */
  tolerance: number;
  /** Multiplicador para "ATENCION". Default: 3x tolerance */
  attentionMultiplier: number;
}

export const DEFAULT_DISCREPANCY_CONFIG: DiscrepancyConfig = {
  tolerance: 1000,
  attentionMultiplier: 3,
};

/**
 * Clasifica el descuadre según su magnitud.
 *
 * |D| <= tolerance          → OK
 * tolerance < |D| <= 3*tolerance → ATENCION
 * |D| > 3*tolerance         → CRITICO
 */
export function classifyDiscrepancy(
  discrepancy: number,
  config: DiscrepancyConfig = DEFAULT_DISCREPANCY_CONFIG,
): DiscrepancyStatus {
  const abs = Math.abs(discrepancy);
  if (abs <= config.tolerance) return 'OK';
  if (abs <= config.tolerance * config.attentionMultiplier) return 'ATENCION';
  return 'CRITICO';
}

/**
 * Calcula el resultado completo del cierre de caja.
 * Helper que combina las 3 funciones anteriores.
 */
export interface ShiftCloseResult {
  expectedCash: number;
  discrepancy: number;
  status: DiscrepancyStatus;
  direction: 'sobra' | 'falta' | 'cuadra';
}

export function evaluateShiftClose(
  initialCash: number,
  cashSales: number,
  withdrawals: number,
  declaredCash: number,
  config: DiscrepancyConfig = DEFAULT_DISCREPANCY_CONFIG,
): ShiftCloseResult {
  const expectedCash = calculateExpectedCash(initialCash, cashSales, withdrawals);
  const discrepancy = calculateDiscrepancy(declaredCash, expectedCash);
  const status = classifyDiscrepancy(discrepancy, config);
  const direction = discrepancy === 0 ? 'cuadra' : discrepancy > 0 ? 'sobra' : 'falta';

  return { expectedCash, discrepancy, status, direction };
}
