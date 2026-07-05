import { useMemo } from 'react';

interface BarDatum {
  label: string; // ej: "Lun", "15"
  value: number;
  highlight?: 'good' | 'warn' | 'bad' | 'neutral';
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  /** Formatea el valor para mostrar en tooltip y eje */
  formatValue?: (v: number) => string;
  /** Eje Y custom (por defecto currency) */
  yAxisFormatter?: (v: number) => string;
  /** Mensaje cuando no hay datos */
  emptyMessage?: string;
}

/**
 * Bar chart minimalista en SVG puro (sin libs).
 * - Responsive: width 100%
 * - Muestra valor encima de cada barra
 * - Hover con tooltip nativo
 */
export function BarChart({
  data,
  height = 200,
  formatValue = (v) => v.toString(),
  yAxisFormatter,
  emptyMessage = 'Sin datos',
}: BarChartProps) {
  const yFmt = yAxisFormatter ?? formatValue;

  const { max, bars } = useMemo(() => {
    if (data.length === 0) return { max: 0, bars: [] };
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const niceMax = niceNumber(maxVal);
    const bars = data.map((d, i) => {
      const heightPct = (d.value / niceMax) * 100;
      return {
        ...d,
        heightPct,
        x: (i / data.length) * 100,
        width: 100 / data.length - 2, // gap de 2%
        isZero: d.value === 0,
      };
    });
    return { max: niceMax, bars };
  }, [data]);

  if (data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-slate-400 text-sm">
        {emptyMessage}
      </div>
    );
  }

  const colorFor = (highlight?: BarDatum['highlight']) => {
    switch (highlight) {
      case 'good':
        return '#10b981';
      case 'warn':
        return '#f59e0b';
      case 'bad':
        return '#ef4444';
      default:
        return '#0ea5e9';
    }
  };

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        {/* Líneas de grid horizontales (4 niveles) */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y}
            y2={y}
            stroke="#e2e8f0"
            strokeWidth="0.2"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Barras */}
        {bars.map((b, i) => (
          <g key={i}>
            <rect
              x={`${b.x + 1}%`}
              y={100 - b.heightPct}
              width={`${b.width}%`}
              height={`${b.heightPct}%`}
              fill={b.isZero ? '#e2e8f0' : colorFor(b.highlight)}
              rx="0.5"
              vectorEffect="non-scaling-stroke"
              style={{ transition: 'all 0.3s ease' }}
            >
              <title>{`${b.label}: ${formatValue(b.value)}`}</title>
            </rect>
          </g>
        ))}
      </svg>

      {/* Labels X */}
      <div className="flex justify-between mt-2 text-xs text-slate-500">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center truncate px-0.5" title={d.label}>
            {d.label}
          </div>
        ))}
      </div>

      {/* Footer con min/max */}
      <div className="flex justify-between mt-2 text-[10px] text-slate-400">
        <span>mín: {yFmt(0)}</span>
        <span>máx: {yFmt(max)}</span>
      </div>
    </div>
  );
}

function niceNumber(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const base = Math.pow(10, exp);
  const norm = n / base;
  let nice;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}
