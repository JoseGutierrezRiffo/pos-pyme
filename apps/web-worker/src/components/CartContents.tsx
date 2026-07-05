import { formatCLP } from '@pos-pyme/business-rules';
import type { PaymentMethod } from '@pos-pyme/validation';
import type { CartItem } from '@/atoms';

interface CartContentsProps {
  cart: CartItem[];
  count: number;
  total: number;
  payment: PaymentMethod;
  processing: boolean;
  onClose: () => void;
  onClearCart: () => void;
  onChangeQty: (productId: string, delta: number) => void;
  onSetPayment: (p: PaymentMethod) => void;
  onCheckout: () => void | Promise<void>;
  showCloseButton: boolean;
  asModal?: boolean;
}

const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  label: string;
  icon: string;
}> = [
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'transferencia', label: 'Transfer.', icon: '📲' },
  { value: 'tarjeta', label: 'Tarjeta', icon: '💳' },
];

/**
 * Contenido del carrito reutilizable.
 * - Modo normal (sidebar desktop): se renderiza dentro de un <aside>
 * - Modo modal (slideover mobile): se renderiza como overlay deslizable
 */
export function CartContents({
  cart,
  count,
  total,
  payment,
  processing,
  onClose,
  onClearCart,
  onChangeQty,
  onSetPayment,
  onCheckout,
  showCloseButton,
  asModal = false,
}: CartContentsProps) {
  const body = (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <h2 className="font-bold text-slate-900 flex items-center gap-2">
          <span>🛍️</span>
          Carrito
          {count > 0 && (
            <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button
              onClick={onClearCart}
              className="text-xs text-slate-400 hover:text-red-600 font-medium"
            >
              Vaciar
            </button>
          )}
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
              aria-label="Cerrar"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {cart.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-5xl mb-2 opacity-20">🛒</div>
            <p className="text-slate-400 text-sm">Carrito vacío</p>
            <p className="text-slate-300 text-xs mt-1">Toca un producto para agregar</p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.product_id}
              className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {item.product_name}
                </div>
                <div className="text-xs text-slate-500">{formatCLP(item.sale_price)} c/u</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onChangeQty(item.product_id, -1)}
                  className="w-7 h-7 bg-white border border-slate-200 rounded-md text-lg font-bold text-slate-700 active:scale-90"
                >
                  −
                </button>
                <span className="w-7 text-center font-bold text-sm tabular-nums">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onChangeQty(item.product_id, 1)}
                  className="w-7 h-7 gradient-brand text-white rounded-md text-lg font-bold active:scale-90"
                >
                  +
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer: payment + total + cobrar */}
      <div className="p-3 border-t border-slate-200 space-y-3 bg-slate-50 flex-shrink-0">
        <div className="grid grid-cols-3 gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => onSetPayment(m.value)}
              className={`py-2.5 rounded-lg text-xs font-semibold transition-all ${
                payment === m.value
                  ? 'gradient-brand text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-base mb-0.5">{m.icon}</div>
              <div>{m.label}</div>
            </button>
          ))}
        </div>

        <div className="flex items-baseline justify-between pt-1">
          <span className="text-sm text-slate-500 font-medium">Total</span>
          <span className="text-3xl font-bold text-slate-900 tabular-nums">{formatCLP(total)}</span>
        </div>

        <button
          onClick={onCheckout}
          disabled={processing || cart.length === 0}
          className="btn-success w-full py-3.5 text-base shadow-md"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Procesando…
            </>
          ) : (
            <>Cobrar {formatCLP(total)}</>
          )}
        </button>
      </div>
    </div>
  );

  if (!asModal) {
    return body;
  }

  return (
    <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      {/* Slideover */}
      <div className="absolute inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {body}
      </div>
    </div>
  );
}
