/**
 * Mapeo de prefijos de SKU → categoría legible.
 * Si el SKU no tiene prefijo conocido, devuelve "Otros".
 */
const CATEGORY_BY_PREFIX: Record<string, string> = {
  BEB: 'Bebidas',
  SNK: 'Snacks',
  DUL: 'Dulces',
  GOL: 'Galletas',
  CER: 'Cervezas',
  VIN: 'Vinos',
  PAN: 'Panadería',
  LAC: 'Lácteos',
  CAR: 'Carnes',
  FRU: 'Frutas',
  VER: 'Verduras',
  LIM: 'Limpieza',
  ASEO: 'Aseo',
  HIG: 'Higiene',
  TAB: 'Tabaco',
  MED: 'Medicamentos',
};

export function getCategoryFromSku(sku: string): string {
  if (!sku) return 'Otros';
  // Tomamos el prefijo antes del primer guion: "BEB-001" → "BEB"
  const prefix = sku.split('-')[0]?.toUpperCase() ?? '';
  return CATEGORY_BY_PREFIX[prefix] ?? 'Otros';
}

export const KNOWN_CATEGORIES = Object.values(CATEGORY_BY_PREFIX);
