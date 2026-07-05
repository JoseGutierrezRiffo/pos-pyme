import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCLP } from '@pos-pyme/business-rules';
import { fetchLowStock, type LowStockProduct } from '@/lib/products';

/**
 * Widget que muestra productos con stock bajo.
 * Auto-refresca cada 60 segundos para mantener actualizado.
 */
export function LowStockAlert() {
  const [items, setItems] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await fetchLowStock();
        if (mounted) setItems(data);
      } catch (err) {
        console.error('Error cargando stock bajo:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60_000); // refresca cada 60s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-slate-400">Cargando alertas de stock…</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
        <span className="text-3xl">✅</span>
        <div>
          <div className="font-semibold text-green-800">Todo en orden</div>
          <div className="text-sm text-green-700">No hay productos con stock bajo</div>
        </div>
      </div>
    );
  }

  // Mostrar hasta 5
  const visible = items.slice(0, 5);
  const remaining = items.length - visible.length;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b bg-amber-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-bold text-amber-900">Stock bajo ({items.length})</div>
            <div className="text-xs text-amber-700">Productos que necesitan reposición</div>
          </div>
        </div>
        {items.length > 5 && (
          <Link to="/products" className="text-xs text-amber-700 hover:text-amber-900 font-medium">
            Ver todos ({items.length}) →
          </Link>
        )}
      </div>

      <div className="divide-y">
        {visible.map((p) => {
          const ratio = p.stock / Math.max(p.min_stock, 1);
          const severity = ratio <= 0.25 ? 'critical' : ratio <= 0.5 ? 'high' : 'medium';
          const colors =
            severity === 'critical'
              ? 'bg-red-50 border-l-4 border-red-500'
              : severity === 'high'
                ? 'bg-amber-50 border-l-4 border-amber-500'
                : 'bg-yellow-50 border-l-4 border-yellow-400';

          return (
            <div key={p.id} className={`p-3 flex items-center gap-3 ${colors}`}>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-slate-500">{p.sku}</div>
                <div className="font-medium truncate">{p.name}</div>
              </div>
              <div className="text-right">
                <div
                  className={`font-bold text-lg ${
                    severity === 'critical'
                      ? 'text-red-700'
                      : severity === 'high'
                        ? 'text-amber-700'
                        : 'text-yellow-700'
                  }`}
                >
                  {p.stock}
                </div>
                <div className="text-xs text-slate-500">/ {p.min_stock} mín</div>
              </div>
              <div className="text-right text-xs text-slate-500 hidden sm:block">
                {formatCLP(Number(p.sale_price))}
              </div>
            </div>
          );
        })}
        {remaining > 0 && (
          <Link
            to="/products"
            className="block p-3 text-center text-sm text-slate-600 hover:bg-slate-50 font-medium"
          >
            +{remaining} productos más — Ver todos →
          </Link>
        )}
      </div>

      <div className="p-3 bg-slate-50 border-t">
        <Link
          to="/products"
          className="block w-full text-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-lg text-sm"
        >
          📦 Ir a Productos para reabastecer
        </Link>
      </div>
    </div>
  );
}
