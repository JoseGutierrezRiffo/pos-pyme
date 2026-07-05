/**
 * Reglas de negocio de inventario.
 */

/** Stock mínimo por defecto (umbral de alerta) */
export const DEFAULT_MIN_STOCK = 3;

/**
 * Determina si un producto está en nivel bajo de stock.
 */
export function isLowStock(stock: number, minStock: number = DEFAULT_MIN_STOCK): boolean {
  return stock <= minStock;
}

/**
 * Clasifica el estado del stock.
 */
export type StockStatus = 'agotado' | 'bajo' | 'disponible' | 'exceso';

export function classifyStock(stock: number, minStock: number): StockStatus {
  if (stock === 0) return 'agotado';
  if (stock <= minStock) return 'bajo';
  if (stock > minStock * 10) return 'exceso';
  return 'disponible';
}

/**
 * Calcula el margen de ganancia.
 * margen = (precio_venta - costo) / precio_venta
 * Retorna un valor entre 0 y 1.
 */
export function calculateMargin(costPrice: number, salePrice: number): number {
  if (salePrice <= 0) return 0;
  return (salePrice - costPrice) / salePrice;
}

/**
 * Calcula la ganancia bruta en CLP.
 */
export function calculateProfit(costPrice: number, salePrice: number, quantity = 1): number {
  return (salePrice - costPrice) * quantity;
}
