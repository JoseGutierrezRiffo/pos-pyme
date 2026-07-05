import { useEffect, useState } from 'react';
import { formatCLP, formatNumberCL } from '@pos-pyme/business-rules';
import {
  fetchPendingMovements,
  approveMovement,
  rejectMovement,
  type StockMovement,
} from '@/lib/stockMovements';

function getRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'recién';
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

export function PendingApprovals() {
  const [items, setItems] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPendingMovements();
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000); // refresca cada 30s
    return () => clearInterval(id);
  }, []);

  async function handleApprove(m: StockMovement) {
    setProcessing(m.id);
    try {
      await approveMovement(m.id, reviewNotes[m.id] || undefined);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(m: StockMovement) {
    setProcessing(m.id);
    try {
      await rejectMovement(m.id, reviewNotes[m.id] || undefined);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="card p-4">
        <div className="text-sm text-slate-400">Cargando aprobaciones…</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <span className="text-3xl">✅</span>
        <div>
          <div className="font-semibold text-emerald-800">Todo al día</div>
          <div className="text-sm text-emerald-700">No hay solicitudes de stock pendientes</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b bg-amber-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⏳</span>
          <div>
            <div className="font-bold text-amber-900">Aprobaciones pendientes ({items.length})</div>
            <div className="text-xs text-amber-700">Solicitudes de movimiento de stock</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm p-3">⚠️ {error}</div>
      )}

      <div className="divide-y divide-slate-100">
        {items.map((m) => {
          const isIn = m.type === 'in';
          const wouldUpdate = isIn ? m.product!.stock + m.quantity : m.product!.stock - m.quantity;
          return (
            <div key={m.id} className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl flex-shrink-0">{isIn ? '📦' : '🗑️'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="font-mono text-xs text-slate-500">{m.product?.sku}</div>
                      <div className="font-semibold text-slate-900">{m.product?.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div
                        className={`text-xl font-bold tabular-nums ${
                          isIn ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {isIn ? '+' : '−'}
                        {m.quantity}
                      </div>
                      <div className="text-xs text-slate-500">unidades</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 mb-2">
                    Stock actual: <strong>{m.product?.stock}</strong> → quedaría en{' '}
                    <strong
                      className={
                        wouldUpdate < 0
                          ? 'text-red-700'
                          : isIn
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                      }
                    >
                      {wouldUpdate}
                    </strong>
                  </div>

                  <div className="text-sm text-slate-700 bg-slate-50 rounded p-2 mb-2">
                    <div className="text-xs text-slate-500 mb-0.5">
                      💬 {m.user?.full_name} · {getRelativeTime(m.requested_at)}
                    </div>
                    "{m.reason}"
                  </div>

                  <input
                    type="text"
                    value={reviewNotes[m.id] ?? ''}
                    onChange={(e) =>
                      setReviewNotes((prev) => ({
                        ...prev,
                        [m.id]: e.target.value,
                      }))
                    }
                    placeholder="Nota (opcional)..."
                    className="input text-xs mb-2"
                    maxLength={500}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(m)}
                      disabled={processing === m.id}
                      className="flex-1 bg-slate-200 hover:bg-red-100 hover:text-red-700 text-slate-700 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {processing === m.id ? '…' : '✕ Rechazar'}
                    </button>
                    <button
                      onClick={() => handleApprove(m)}
                      disabled={processing === m.id}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {processing === m.id ? '…' : '✓ Aprobar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-slate-50 border-t text-xs text-slate-500 text-center">
        Auto-refresca cada 30 segundos
      </div>
    </div>
  );
}
