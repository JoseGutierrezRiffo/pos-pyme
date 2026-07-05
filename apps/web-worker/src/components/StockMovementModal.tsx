import { useState, useEffect } from 'react';
import { CreateStockMovementSchema } from '@pos-pyme/validation';
import { parseCLP, formatCLP } from '@pos-pyme/business-rules';
import { apiFetch } from '@/lib/api-with-business';
import { createStockMovement, type MovementType } from '@/lib/stockMovements';

interface StockMovementModalProps {
  shiftId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const TYPE_OPTIONS: Array<{
  value: MovementType;
  label: string;
  emoji: string;
  description: string;
}> = [
  {
    value: 'in',
    label: 'Mercadería recibida',
    emoji: '📦',
    description: 'Sumar al stock (proveedor entregó)',
  },
  {
    value: 'out',
    label: 'Retirar / Dañado',
    emoji: '🗑️',
    description: 'Restar del stock (dañado, obsequio, vencimiento)',
  },
];

const QUICK_REASONS = [
  'Recepción proveedor',
  'Factura #',
  'Producto dañado',
  'Vencimiento',
  'Obsequio / muestra',
  'Conteo físico',
];

interface Product {
  id: string;
  sku: string;
  name: string;
  stock: number;
  sale_price: number;
}

export function StockMovementModal({ shiftId, onClose, onSuccess }: StockMovementModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [type, setType] = useState<MovementType>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Product[]>('/products')
      .then(setProducts)
      .catch((err) => console.error('Error cargando productos:', err));
  }, []);

  const selected = products.find((p) => p.id === selectedId);
  const num = parseCLP(quantity);
  const wouldExceed = type === 'out' && selected && num > selected.stock;

  async function submit() {
    setError(null);

    const payload = {
      product_id: selectedId,
      shift_id: shiftId,
      type,
      quantity: num,
      reason,
    };

    const parsed = CreateStockMovementSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    if (wouldExceed) {
      setError(`Stock insuficiente: hay ${selected!.stock} unidades`);
      return;
    }

    setLoading(true);
    try {
      await createStockMovement(parsed.data);
      onSuccess(
        type === 'in'
          ? `✅ Solicitud de +${num} ${selected!.name} enviada al dueño`
          : `✅ Solicitud de -${num} ${selected!.name} enviada al dueño`,
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function applyQuickReason(q: string) {
    setReason((prev) => (prev ? `${prev} | ${q}` : q));
  }

  const canSubmit = selectedId && num > 0 && reason.length >= 3 && !wouldExceed;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">📦 Movimiento de stock</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quedará pendiente hasta que el dueño apruebe
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Tipo de movimiento
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`p-3 rounded-xl text-left transition-all border-2 ${
                    type === t.value
                      ? 'bg-brand-50 border-brand-500 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{t.emoji}</div>
                  <div className="font-bold text-sm text-slate-900">{t.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Producto */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Producto
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="input"
            >
              <option value="">— Seleccioná un producto —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} (stock: {p.stock})
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Cantidad de unidades
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                {type === 'in' ? '+' : '−'}
              </span>
              <input
                type="number"
                value={quantity || ''}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                min="1"
                step="1"
                className="w-full pl-9 pr-3 py-3 text-2xl font-bold rounded-lg border-2 border-slate-200 bg-slate-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
            </div>
            {selected && num > 0 && (
              <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded p-2">
                Stock actual: <strong>{selected.stock}</strong>
                {type === 'in' && (
                  <>
                    {' '}
                    → quedaría en{' '}
                    <strong className="text-emerald-700">{selected.stock + num}</strong>
                  </>
                )}
                {type === 'out' && (
                  <>
                    {' '}
                    → quedaría en{' '}
                    <strong className={wouldExceed ? 'text-red-700' : 'text-amber-700'}>
                      {Math.max(0, selected.stock - num)}
                    </strong>
                  </>
                )}
              </div>
            )}
            {wouldExceed && (
              <div className="mt-2 text-xs text-red-700 bg-red-50 rounded p-2 font-medium">
                ⚠️ No hay suficiente stock ({selected?.stock} disponibles)
              </div>
            )}
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Motivo
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Recepción factura #1234 del proveedor X"
              rows={3}
              className="input resize-none"
              maxLength={500}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => applyQuickReason(r)}
                  className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
                >
                  + {r}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 animate-fade-in">
              ⚠️ {error}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <div className="font-semibold mb-1">📌 Importante</div>
            Esta solicitud queda <strong>pendiente</strong> hasta que el dueño la apruebe. El stock{' '}
            <strong>NO se modifica</strong> hasta entonces.
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-slate-200 flex-shrink-0 bg-slate-50">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-xl font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading || !canSubmit}
            className="flex-1 btn-primary py-3 disabled:opacity-50"
          >
            {loading ? 'Enviando…' : '📤 Enviar al dueño'}
          </button>
        </div>
      </div>
    </div>
  );
}
