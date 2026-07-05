import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { formatCLP, calculateMargin, formatPercent } from '@pos-pyme/business-rules';
import { apiFetch } from '@/lib/api-with-business';
import { currentUserAtom, businessVersionAtom } from '@/atoms/auth';
import { LowStockAlert } from '@/components/LowStockAlert';
import { PendingApprovals } from '@/components/PendingApprovals';
import { BarChart } from '@/components/BarChart';

interface ProductAdmin {
  id: string;
  sku: string;
  name: string;
  cost_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  margin: number;
}

interface DailySummary {
  date: string;
  shifts_count: number;
  total_sales: number;
  total_cash_sales: number;
  total_card_sales: number;
  total_transfer_sales: number;
  cash_withdrawals: number;
  status: 'OK' | 'ATENCION' | 'CRITICO';
}

export function Dashboard() {
  const navigate = useNavigate();
  const user = useAtomValue(currentUserAtom);
  const businessVersion = useAtomValue(businessVersionAtom);
  const [products, setProducts] = useState<ProductAdmin[]>([]);
  const [last7Days, setLast7Days] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<ProductAdmin[]>('/products/admin/full')
      .then(setProducts)
      .catch((err) => console.error('Error cargando productos:', err))
      .finally(() => setLoading(false));

    // Cargar últimos 7 días para el chart
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const from = sevenDaysAgo.toISOString().slice(0, 10);
    const to = today.toISOString().slice(0, 10);
    apiFetch<DailySummary[]>(`/shifts/daily-summary?from=${from}&to=${to}`)
      .then(setLast7Days)
      .catch((err) => console.error('Error cargando resumen diario:', err));
  }, [businessVersion]);

  const activeProducts = products.length;
  const totalInventoryValue = products.reduce((acc, p) => acc + Number(p.cost_price) * p.stock, 0);
  const totalSaleValue = products.reduce((acc, p) => acc + Number(p.sale_price) * p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock < p.min_stock).length;
  const avgMargin =
    products.length > 0 ? products.reduce((acc, p) => acc + p.margin, 0) / products.length : 0;

  const displayName = user?.full_name || 'Hola';
  const firstName = user?.full_name?.split(/\s+/)[0] || 'amigo';
  const greeting =
    new Date().getHours() < 12
      ? 'Buenos días'
      : new Date().getHours() < 19
        ? 'Buenas tardes'
        : 'Buenas noches';

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl gradient-hero border border-slate-200/60 p-8">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="absolute -right-4 bottom-0 w-32 h-32 rounded-full bg-emerald-200/30 blur-2xl" />

        <div className="relative">
          <div className="text-sm font-medium text-brand-600 uppercase tracking-wider mb-1">
            {greeting} 👋
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{displayName}</h1>
          <p className="text-slate-600 max-w-xl">
            {firstName}, acá tenés un resumen de tu negocio. Revisá las ventas, alertas de stock y
            los turnos de hoy.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          icon="📦"
          label="Productos"
          value={activeProducts.toString()}
          color="brand"
          loading={loading}
        />
        <KPICard
          icon="💰"
          label="Valor (costo)"
          value={formatCLP(totalInventoryValue)}
          color="slate"
          loading={loading}
        />
        <KPICard
          icon="🏷️"
          label="Valor (venta)"
          value={formatCLP(totalSaleValue)}
          color="emerald"
          loading={loading}
        />
        <KPICard
          icon="📊"
          label="Margen prom."
          value={formatPercent(avgMargin)}
          color="purple"
          loading={loading}
        />
        <KPICard
          icon="⚠️"
          label="Stock bajo"
          value={lowStockCount.toString()}
          color={lowStockCount > 0 ? 'red' : 'slate'}
          loading={loading}
        />
      </div>

      {/* Chart de ventas */}
      <SalesChartCard summaries={last7Days} />

      {/* Alertas + Aprobaciones + Inventario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-700 mb-3">Aprobaciones</h2>
            <PendingApprovals />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-700 mb-3">Stock bajo</h2>
            <LowStockAlert />
          </div>
        </div>

        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-700">Inventario</h2>
            <button
              onClick={() => navigate('/products')}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Ver todos →
            </button>
          </div>
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">SKU</th>
                    <th className="text-left px-4 py-3 font-semibold">Producto</th>
                    <th className="text-right px-4 py-3 font-semibold">Venta</th>
                    <th className="text-right px-4 py-3 font-semibold">Margen</th>
                    <th className="text-right px-4 py-3 font-semibold">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 6).map((p) => (
                    <tr
                      key={p.id}
                      className={`border-t border-slate-100 transition-colors hover:bg-slate-50 ${
                        p.stock < p.min_stock ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.sku}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {formatCLP(Number(p.sale_price))}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-700">
                        {formatPercent(p.margin)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-semibold ${
                          p.stock < p.min_stock ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {p.stock}
                        {p.stock < p.min_stock && <span className="ml-1">⚠️</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

interface KPICardProps {
  icon: string;
  label: string;
  value: string;
  color: 'brand' | 'emerald' | 'slate' | 'purple' | 'red';
  loading?: boolean;
}

function KPICard({ icon, label, value, color, loading }: KPICardProps) {
  const colorMap = {
    brand: 'from-brand-500/10 to-brand-500/0 text-brand-600',
    emerald: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600',
    purple: 'from-purple-500/10 to-purple-500/0 text-purple-600',
    red: 'from-red-500/10 to-red-500/0 text-red-600',
    slate: 'from-slate-500/10 to-slate-500/0 text-slate-700',
  };

  return (
    <div className="card card-hover p-5 relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${colorMap[color]} opacity-60`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
          {label}
        </div>
        {loading ? (
          <div className="skeleton h-7 w-20" />
        ) : (
          <div className="text-xl font-bold text-slate-900 truncate">{value}</div>
        )}
      </div>
    </div>
  );
}

function SalesChartCard({ summaries }: { summaries: DailySummary[] }) {
  // Generar últimos 7 días (incluso si no hay datos)
  const last7Days = useMemo(() => {
    const days: DailySummary[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const found = summaries.find((s) => s.date === iso);
      days.push(
        found ?? {
          date: iso,
          shifts_count: 0,
          total_sales: 0,
          total_cash_sales: 0,
          total_card_sales: 0,
          total_transfer_sales: 0,
          cash_withdrawals: 0,
          status: 'OK',
        },
      );
    }
    return days;
  }, [summaries]);

  const chartData = last7Days.map((d) => ({
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('es-CL', {
      weekday: 'short',
      day: 'numeric',
    }),
    value: d.total_sales,
    highlight: (d.total_sales === 0
      ? 'neutral'
      : d.status === 'CRITICO'
        ? 'bad'
        : d.status === 'ATENCION'
          ? 'warn'
          : 'good') as 'good' | 'warn' | 'bad' | 'neutral',
  }));

  const weekTotal = last7Days.reduce((acc, d) => acc + d.total_sales, 0);
  const weekDays = last7Days.filter((d) => d.shifts_count > 0).length;
  const avgPerDay = weekDays > 0 ? Math.round(weekTotal / weekDays) : 0;
  const firstDay = last7Days[0];
  const bestDay = firstDay
    ? last7Days.reduce<DailySummary>(
        (best, d) => (d.total_sales > best.total_sales ? d : best),
        firstDay,
      )
    : undefined;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-700">📊 Ventas últimos 7 días</h2>
          <p className="text-xs text-slate-500 mt-0.5">Resumen de actividad reciente</p>
        </div>
        <Link to="/calendar" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
          Ver calendario →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-slate-100">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total semana</div>
          <div className="text-lg font-bold text-slate-900">{formatCLP(weekTotal)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Días activos</div>
          <div className="text-lg font-bold text-slate-900">{weekDays} / 7</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Promedio</div>
          <div className="text-lg font-bold text-slate-900">{formatCLP(avgPerDay)}</div>
        </div>
      </div>

      <BarChart
        data={chartData}
        height={180}
        formatValue={(v) => formatCLP(v)}
        emptyMessage="Sin ventas en los últimos 7 días"
      />

      {bestDay && bestDay.total_sales > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <span>🏆 Mejor día:</span>
          <span className="font-mono font-semibold text-slate-700">
            {new Date(bestDay.date + 'T00:00:00').toLocaleDateString('es-CL', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            })}{' '}
            · {formatCLP(bestDay.total_sales)}
          </span>
        </div>
      )}
    </div>
  );
}
