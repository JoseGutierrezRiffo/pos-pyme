import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue } from 'jotai';
import { useAtom as useJotai } from 'jotai';
import { businessVersionAtom } from '@/atoms/auth';
import { CreateSaleSchema } from '@pos-pyme/validation';
import { formatCLP } from '@pos-pyme/business-rules';
import { apiFetch } from '@/lib/api-with-business';
import { getCategoryFromSku } from '@/lib/categories';
import {
  cartAtom,
  cartTotalAtom,
  cartCountAtom,
  currentShiftAtom,
  currentWorkerAtom,
  paymentMethodAtom,
} from '@/atoms';
import { WithdrawalModal } from '@/components/WithdrawalModal';
import { StockMovementModal } from '@/components/StockMovementModal';
import { CartContents } from '@/components/CartContents';
import { ProfileSlideover } from '@/components/ProfileSlideover';
import { ColacionScreen } from './ColacionScreen';

interface Product {
  id: string;
  sku: string;
  name: string;
  sale_price: number;
  available_portions: number | null; // null = sin receta, usar stock directo
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
}

const ALL_CATEGORIES = '__ALL__';

export function POS() {
  const navigate = useNavigate();
  const worker = useAtomValue(currentWorkerAtom);
  const [cart, setCart] = useAtom(cartAtom);
  const total = useAtomValue(cartTotalAtom);
  const count = useAtomValue(cartCountAtom);
  const [shift, setShift] = useAtom(currentShiftAtom);
  const [payment, setPayment] = useAtom(paymentMethodAtom);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [processingSale, setProcessingSale] = useState(false);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [showStockMovement, setShowStockMovement] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Recargar datos cuando cambie el negocio
  const businessVersion = useJotai(businessVersionAtom)[0];

  useEffect(() => {
    apiFetch<any>('/shifts/current')
      .then((s) => {
        if (!s) navigate('/open-shift');
        else setShift(s);
      })
      .catch((err) => showToast('error', (err as Error).message));

    reloadAll();
  }, [businessVersion]);

  async function reloadAll() {
    try {
      setLoadingProducts(true);
      // Cargar stock calculado por recetas
      const stockData = await apiFetch<Product[]>('/ingredients/product-stock');
      setProducts(stockData);

      // Cargar ingredientes para badges de alerta
      try {
        const ing = await apiFetch<Ingredient[]>('/ingredients');
        setIngredients(ing);
      } catch (err) {
        console.warn('No se pudieron cargar ingredientes:', err);
      }

      // Cargar productos con stock bajo
      try {
        const low = await apiFetch<Product[]>('/ingredients/low-stock-products');
        setLowStockProducts(low);
      } catch (err) {
        // Si el endpoint no existe, calcular del stock
        const lowComputed = stockData.filter((p) => {
          const stk = p.available_portions ?? 0;
          return stk > 0 && stk < 5;
        });
        setLowStockProducts(lowComputed);
      }
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setLoadingProducts(false);
    }
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  // Categorías detectadas
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(getCategoryFromSku(p.sku)));
    return Array.from(set);
  }, [products]);

  // Productos filtrados
  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory !== ALL_CATEGORIES) {
      list = list.filter((p) => getCategoryFromSku(p.sku) === activeCategory);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
      );
    }
    return list;
  }, [products, activeCategory, search]);

  function addToCart(p: Product) {
    const available = p.available_portions ?? 0;
    if (available <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        if (existing.quantity >= available) return prev;
        return prev.map((i) => (i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          sale_price: Number(p.sale_price),
          quantity: 1,
          stock: available,
        },
      ];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product_id === productId) {
            const product = products.find((p) => p.id === productId);
            const max = product?.available_portions ?? Infinity;
            return { ...i, quantity: Math.min(Math.max(0, i.quantity + delta), max) };
          }
          return i;
        })
        .filter((i) => i.quantity > 0),
    );
  }

  async function checkout() {
    if (!shift || cart.length === 0) return;
    setProcessingSale(true);
    try {
      const parsed = CreateSaleSchema.safeParse({
        shift_id: shift.id,
        cash_amount: payment === 'efectivo' ? total : 0,
        card_amount: payment === 'tarjeta' ? total : 0,
        transfer_amount: payment === 'transferencia' ? total : 0,
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      if (!parsed.success) {
        showToast('error', parsed.error.issues[0]?.message ?? 'Datos inválidos');
        return;
      }
      await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      setCart([]);
      showToast('success', '✅ Venta registrada. Stock actualizado');
      await reloadAll(); // Recargar stock calculado
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setProcessingSale(false);
    }
  }

  async function toggleBreak() {
    if (!shift) return;
    const path = shift.shift_status === 'break' ? '/shifts/break/end' : '/shifts/break/start';
    try {
      const updated = await apiFetch<any>(path, { method: 'POST' });
      setShift(updated);
    } catch (err) {
      showToast('error', (err as Error).message);
    }
  }

  async function onWithdrawalSuccess() {
    try {
      const fresh = await apiFetch<any>('/shifts/current');
      if (fresh) setShift(fresh);
    } catch (err) {
      console.error(err);
    }
    showToast('success', '✅ Gasto registrado');
  }

  // Si está en colación, mostrar pantalla bloqueada
  if (shift?.shift_status === 'break') {
    return <ColacionScreen />;
  }

  // Calcular alertas
  const ingredientsLow = ingredients.filter((i) => Number(i.stock) < Number(i.min_stock));
  const ingredientsCritical = ingredients.filter((i) => Number(i.stock) === 0);
  const totalLowStock = lowStockProducts.length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header con gradient */}
      <header className="gradient-brand text-white shadow-lg sticky top-0 z-20">
        <div className="px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-sm font-bold flex-shrink-0">
              {worker?.full_name ? getInitials(worker.full_name) : '🛒'}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider opacity-80 truncate">
                {worker?.full_name ? `Turno de ${worker.full_name.split(' ')[0]}` : 'Turno activo'}
              </div>
              <div className="font-bold truncate">
                {shift ? formatCLP(Number(shift.cash_initial)) : '—'}
              </div>
              {shift && Number(shift.cash_withdrawals) > 0 && (
                <div className="text-xs text-amber-200 mt-0.5">
                  Gastos: {formatCLP(Number(shift.cash_withdrawals))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-1.5 flex-shrink-0">
            {totalLowStock > 0 && (
              <div
                className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                title={`${totalLowStock} productos con stock bajo`}
              >
                ⚠️ {totalLowStock}
              </div>
            )}
            <button
              onClick={() => setShowProfile(true)}
              className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur flex items-center justify-center text-sm font-bold flex-shrink-0 active:scale-95 transition-all"
              title="Mi perfil"
            >
              {worker?.full_name ? getInitials(worker.full_name) : '👤'}
            </button>
            <button
              onClick={() => setShowStockMovement(true)}
              className="bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold px-3 py-2 rounded-lg active:scale-95 transition-all"
              title="Solicitar mercadería / ajustar stock"
            >
              📦 <span className="hidden sm:inline">Stock</span>
            </button>
            <button
              onClick={() => setShowWithdrawal(true)}
              className="bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold px-3 py-2 rounded-lg active:scale-95 transition-all"
              title="Registrar gasto"
            >
              💸 <span className="hidden sm:inline">Gasto</span>
            </button>
            <button
              onClick={toggleBreak}
              className="bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold px-3 py-2 rounded-lg active:scale-95 transition-all"
            >
              🍽️ <span className="hidden sm:inline">Colación</span>
            </button>
            <button
              onClick={() => navigate('/close-shift')}
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-3 py-2 rounded-lg active:scale-95 transition-all shadow"
            >
              Cerrar
            </button>
          </div>
        </div>
      </header>

      {/* Stock alerts banner */}
      {(ingredientsCritical.length > 0 || ingredientsLow.length > 0) && (
        <div className="bg-amber-50 border-b-2 border-amber-300 px-4 py-2 text-xs overflow-x-auto whitespace-nowrap">
          {ingredientsCritical.length > 0 && (
            <span className="inline-block mr-3 text-red-700 font-semibold">
              🚨 Sin stock: {ingredientsCritical.map((i) => i.name).join(', ')}
            </span>
          )}
          {ingredientsLow.length > 0 && (
            <span className="inline-block text-amber-700">
              ⚠️ Stock bajo:{' '}
              {ingredientsLow
                .slice(0, 5)
                .map((i) => i.name)
                .join(', ')}
              {ingredientsLow.length > 5 && `, +${ingredientsLow.length - 5} más...`}
            </span>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="p-3 bg-white border-b border-slate-200 sticky top-[68px] z-10 shadow-sm">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto (nombre o SKU)…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none text-base transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="bg-white border-b border-slate-200 overflow-x-auto">
        <div className="flex gap-1.5 px-3 py-2 min-w-max">
          <CategoryTab
            label="Todas"
            count={products.length}
            active={activeCategory === ALL_CATEGORIES}
            onClick={() => setActiveCategory(ALL_CATEGORIES)}
          />
          {categories.map((cat) => {
            const count = products.filter((p) => getCategoryFromSku(p.sku) === cat).length;
            return (
              <CategoryTab
                key={cat}
                label={cat}
                count={count}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              />
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex relative">
        {/* Product grid */}
        <div className="flex-1 p-3 overflow-y-auto pb-24 lg:pb-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-semibold text-slate-700">
              {activeCategory === ALL_CATEGORIES ? 'Todos los productos' : activeCategory}
            </h2>
            <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
              {filteredProducts.length}
            </span>
          </div>

          {loadingProducts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-3 h-28 animate-pulse">
                  <div className="h-3 bg-slate-200 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                  <div className="h-5 bg-slate-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-2 opacity-30">📦</div>
              <p className="text-slate-400 text-sm">
                {search ? `Sin resultados para "${search}"` : 'Sin productos en esta categoría'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredProducts.map((p) => {
                const stock = p.available_portions ?? 0;
                const lowStock = stock > 0 && stock < 5;
                const outOfStock = stock === 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={outOfStock}
                    className={`card p-3 text-left transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden ${
                      !outOfStock ? 'active:bg-brand-50 hover:shadow-md' : ''
                    } ${lowStock ? 'ring-2 ring-amber-200' : ''}`}
                  >
                    {outOfStock && (
                      <div className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        AGOTADO
                      </div>
                    )}
                    {lowStock && !outOfStock && (
                      <div className="absolute top-1 right-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        POCO
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                    <div className="font-semibold text-sm text-slate-900 line-clamp-2 min-h-[2.5rem] leading-tight">
                      {p.name}
                    </div>
                    <div className="mt-1.5 flex items-end justify-between">
                      <div className="font-bold text-base text-brand-600">
                        {formatCLP(Number(p.sale_price))}
                      </div>
                      <div
                        className={`text-[11px] font-medium flex items-center gap-1 ${
                          outOfStock
                            ? 'text-red-600'
                            : lowStock
                              ? 'text-amber-600'
                              : 'text-slate-400'
                        }`}
                      >
                        📦 {stock}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart sidebar desktop */}
        <aside className="hidden lg:flex w-72 xl:w-80 bg-white border-l border-slate-200 flex-col shadow-[-4px_0_12px_rgba(0,0,0,0.04)]">
          <CartContents
            cart={cart}
            count={count}
            total={total}
            payment={payment}
            processing={processingSale}
            onClose={() => {}}
            onClearCart={() => setCart([])}
            onChangeQty={changeQty}
            onSetPayment={setPayment}
            onCheckout={async () => {
              await checkout();
              setCartOpen(false);
            }}
            showCloseButton={false}
          />
        </aside>

        {/* Floating cart button - mobile only */}
        {cart.length > 0 && (
          <button
            onClick={() => setCartOpen(true)}
            className="lg:hidden fixed bottom-4 left-4 right-4 z-30 gradient-brand text-white py-4 rounded-2xl shadow-2xl flex items-center justify-between px-5 active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🛒</span>
              <span className="font-bold">Ver carrito</span>
              <span className="bg-white/25 backdrop-blur text-xs font-bold px-2 py-0.5 rounded-full">
                {count}
              </span>
            </div>
            <span className="font-bold text-lg tabular-nums">{formatCLP(total)}</span>
          </button>
        )}

        {/* Cart slideover - mobile only */}
        {cartOpen && (
          <CartContents
            cart={cart}
            count={count}
            total={total}
            payment={payment}
            processing={processingSale}
            onClose={() => setCartOpen(false)}
            onClearCart={() => setCart([])}
            onChangeQty={changeQty}
            onSetPayment={setPayment}
            onCheckout={async () => {
              await checkout();
              setCartOpen(false);
            }}
            showCloseButton={true}
            asModal
          />
        )}
      </div>

      {/* Withdrawal modal */}
      {showWithdrawal && shift && (
        <WithdrawalModal
          shiftId={shift.id}
          onClose={() => setShowWithdrawal(false)}
          onSuccess={onWithdrawalSuccess}
        />
      )}

      {/* Stock movement modal */}
      {showStockMovement && shift && (
        <StockMovementModal
          shiftId={shift.id}
          onClose={() => setShowStockMovement(false)}
          onSuccess={(msg) => showToast('success', msg)}
        />
      )}

      {/* Profile slideover */}
      {showProfile && worker && (
        <ProfileSlideover worker={worker} onClose={() => setShowProfile(false)} />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-2xl font-medium text-sm animate-slide-up ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function CategoryTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
        active
          ? 'gradient-brand text-white shadow-md'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {label}
      <span
        className={`text-xs px-1.5 rounded-full font-bold ${
          active ? 'bg-white/25' : 'bg-slate-200 text-slate-600'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}
