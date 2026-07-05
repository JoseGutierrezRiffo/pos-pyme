# Performance Benchmarks — business-rules

Ejecutar con: `pnpm vitest bench` desde este package.

## Resultados (baseline 2026-07-03, M3 Pro, single thread)

### Cash reconciliation hot path

| Función | ops/seg | p99 (ns) | Notas |
|---------|--------:|---------:|-------|
| `calculateExpectedCash` | ~21M | 100 | Fórmula simple, función pura |
| `calculateDiscrepancy` | ~20M | 100 | Suma/resta |
| `classifyDiscrepancy` | ~20M | 100 | Branch check + abs |
| `evaluateShiftClose` (full) | ~19M | 200 | Compone las 3 anteriores |

**Conclusión:** El cierre completo de turno toma ~50ns. Sin riesgo de performance incluso en高峰期.

### Formatting hot path

| Función | ops/seg | p99 (ns) | Notas |
|---------|--------:|---------:|-------|
| `formatCLP` | ~55K | 70 | Intl.NumberFormat con opciones |
| `parseCLP` | ~5M | 300 | Regex + Number |
| `formatCLP + parseCLP roundtrip` | ~55K | 70 | Dominado por formatCLP |

**Conclusión:** `formatCLP` es ~90x más lento que `parseCLP` (Intl overhead).
Para 1000 ventas/día → ~18ms total de formatting — despreciable.

### Inventory classification

| Función | ops/seg | p99 (ns) | Notas |
|---------|--------:|---------:|-------|
| `isLowStock` | ~19M | 200 | Comparación |
| `classifyStock` | ~19M | 200 | Switch |
| `calculateMargin` | ~19M | 200 | División |

**Conclusión:** Todas sub-microsegundo. Sin preocupación.

## Recomendaciones

- **No prematuramente optimizar.** Estas funciones son O(1) y ~50ns.
- **Si el dashboard renderiza 100+ filas:** considerar memoización con `useMemo`.
- **Si se importa en lotes grandes:** usar `formatCLP` solo en la última milla (display), no en transformación de datos.
- **Monitorear en prod** con métricas reales antes de optimizar.

## Cómo correr

```bash
cd packages/business-rules
pnpm vitest bench
```

Para benchmark específico:

```bash
pnpm vitest bench -t "formatCLP"
```
