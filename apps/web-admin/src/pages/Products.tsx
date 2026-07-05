import { useEffect, useMemo, useState } from 'react';
import { formatCLP, formatPercent, isLowStock, classifyStock } from '@pos-pyme/business-rules';
import { fetchAllProductsWithCosts, deleteProduct, type ProductAdmin } from '@/lib/products';
import { ProductFormModal } from '@/components/ProductFormModal';

type SortKey = 'sku' | 'name' | 'stock' | 'sale_price' | 'margin';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'all' | 'low' | 'out' | 'inactive';

export function Products() {
  const [products, setProducts] = useState<ProductAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('sku');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [editingProduct, setEditingProduct] = useState<ProductAdmin | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ProductAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAllProductsWithCosts();
      setProducts(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      await deleteProduct(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadProducts();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function openNew() {
    setEditingProduct(null);
    setShowForm(true);
  }

  function openEdit(p: ProductAdmin) {
    setEditingProduct(p);
    setShowForm(true);
  }

  // Filtrar y ordenar
  const visibleProducts = useMemo(() => {
    let list = products;

    // Filtro por estado
    if (filterStatus === 'low') {
      list = list.filter((p) => p.is_active && isLowStock(p.stock, p.min_stock));
    } else if (filterStatus === 'out') {
      list = list.filter((p) => p.is_active && p.stock === 0);
    } else if (filterStatus === 'inactive') {
      list = list.filter((p) => !p.is_active);
    }

    // Búsqueda
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'sku':
          cmp = a.sku.localeCompare(b.sku);
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'stock':
          cmp = a.stock - b.stock;
          break;
        case 'sale_price':
          cmp = Number(a.sale_price) - Number(b.sale_price);
          break;
        case 'margin':
          cmp = a.margin - b.margin;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [products, search, sortKey, sortDir, filterStatus]);

  // Métricas resumen
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.is_active).length;
  const lowStockCount = products.filter(
    (p) => p.is_active && isLowStock(p.stock, p.min_stock),
  ).length;
  const outOfStockCount = products.filter((p) => p.is_active && p.stock === 0).length;
  const totalInventoryValue = products.reduce((acc, p) => acc + Number(p.cost_price) * p.stock, 0);
  const avgMargin =
    products.length > 0 ? products.reduce((acc, p) => acc + p.margin, 0) / products.length : 0;

  function getStockBadge(p: ProductAdmin) {
    if (!p.is_active) {
      return (
        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-xs font-medium">
          Inactivo
        </span>
      );
    }
    const status = classifyStock(p.stock, p.min_stock);
    if (status === 'agotado') {
      return (
        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
          🔴 Agotado
        </span>
      );
    }
    if (status === 'bajo') {
      return (
        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
          ⚠️ Bajo
        </span>
      );
    }
    if (status === 'exceso') {
      return (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          Exceso
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
        OK
      </span>
    );
  }

  function SortHeader({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => handleSort(k)}
        className={`flex items-center gap-1 hover:text-slate-900 ${
          active ? 'text-slate-900 font-semibold' : 'text-slate-500'
        }`}
      >
        {label}
        {active && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📦 Productos</h1>
          <p className="text-sm text-slate-500 mt-1">Gestioná tu catálogo, precios y stock</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <span>➕</span>
          <span>Nuevo producto</span>
        </button>
      </div>
      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <SummaryCard
          label="Total productos"
          value={totalProducts}
          subtitle={`${activeProducts} activos`}
        />
        <SummaryCard
          label="Stock bajo"
          value={lowStockCount}
          alert={lowStockCount > 0}
          subtitle="Necesitan reposición"
        />
        <SummaryCard label="Agotados" value={outOfStockCount} alert={outOfStockCount > 0} />
        <SummaryCard label="Valor inventario" value={formatCLP(totalInventoryValue)} />
        <SummaryCard label="Margen promedio" value={formatPercent(avgMargin)} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre o SKU..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2"
        />
        <div className="flex gap-1 bg-white rounded-lg border border-slate-300 p-1">
          {(['all', 'low', 'out', 'inactive'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded text-xs font-medium ${
                filterStatus === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s === 'all' && 'Todos'}
              {s === 'low' && `⚠️ Bajo (${lowStockCount})`}
              {s === 'out' && `🔴 Agotados (${outOfStockCount})`}
              {s === 'inactive' && 'Inactivos'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-slate-400">
          Cargando productos…
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-4xl mb-2">📦</div>
          <p className="text-slate-500">
            {search
              ? `Sin resultados para "${search}"`
              : filterStatus !== 'all'
                ? `Sin productos con filtro "${filterStatus}"`
                : 'No hay productos. Creá el primero con ➕ Nuevo'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="text-left p-3">
                  <SortHeader k="sku" label="SKU" />
                </th>
                <th className="text-left p-3">
                  <SortHeader k="name" label="Producto" />
                </th>
                <th className="text-right p-3">
                  <SortHeader k="sale_price" label="Venta" />
                </th>
                <th className="text-right p-3">Costo</th>
                <th className="text-right p-3">
                  <SortHeader k="margin" label="Margen" />
                </th>
                <th className="text-right p-3">
                  <SortHeader k="stock" label="Stock" />
                </th>
                <th className="text-center p-3">Estado</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs">{p.sku}</td>
                  <td className="p-3">
                    <div
                      className={`font-medium ${!p.is_active ? 'text-slate-400 line-through' : ''}`}
                    >
                      {p.name}
                    </div>
                    {p.description && (
                      <div className="text-xs text-slate-500 line-clamp-1">{p.description}</div>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold">
                    {formatCLP(Number(p.sale_price))}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-600">
                    {formatCLP(Number(p.cost_price))}
                  </td>
                  <td className="p-3 text-right font-mono text-green-700">
                    {formatPercent(p.margin)}
                  </td>
                  <td
                    className={`p-3 text-right font-mono font-bold ${
                      isLowStock(p.stock, p.min_stock) ? 'text-red-600' : ''
                    }`}
                  >
                    {p.stock}
                    <span className="text-xs text-slate-400 font-normal"> / {p.min_stock}</span>
                  </td>
                  <td className="p-3 text-center">{getStockBadge(p)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded font-medium"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(p)}
                        className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded font-medium"
                        disabled={!p.is_active}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {showForm && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => setShowForm(false)}
          onSuccess={loadProducts}
        />
      )}

      {/* Modal confirmar borrado */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <h3 className="text-lg font-bold mb-2">🗑️ Eliminar producto</h3>
            <p className="text-sm text-slate-600 mb-1">
              ¿Seguro que querés eliminar <strong>{deleteConfirm.name}</strong>?
            </p>
            <p className="text-xs text-slate-500 mb-4">
              El producto se marcará como <strong>inactivo</strong> y no aparecerá en el POS. No se
              borra del histórico de ventas.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-slate-200 py-2 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
  alert,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-3 shadow ${alert ? 'bg-red-50 border border-red-200' : 'bg-white'}`}
    >
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-lg font-bold ${alert ? 'text-red-700' : 'text-slate-900'}`}>
        {value}
      </div>
      {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}
