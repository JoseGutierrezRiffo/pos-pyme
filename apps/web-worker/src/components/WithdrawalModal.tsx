import { useState } from 'react';
import { CashWithdrawalSchema, type CashWithdrawalDto } from '@pos-pyme/validation';
import { formatCLP } from '@pos-pyme/business-rules';
import { parseCLP } from '@pos-pyme/business-rules';
import { apiFetch } from '@/lib/api-with-business';

interface WithdrawalModalProps {
  shiftId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const REASONS: Array<{
  value: CashWithdrawalDto['reason'];
  label: string;
  emoji: string;
}> = [
  { value: 'gasto_operativo', label: 'Gasto operativo', emoji: '💡' },
  { value: 'compra_insumos', label: 'Compra de insumos', emoji: '🛒' },
  { value: 'pago_proveedor', label: 'Pago a proveedor', emoji: '🤝' },
  { value: 'otro', label: 'Otro', emoji: '📦' },
];

const QUICK_PRESETS: Array<{ label: string; amount: number; emoji: string }> = [
  { label: 'Gas', amount: 15000, emoji: '🔥' },
  { label: 'Agua', amount: 10000, emoji: '💧' },
  { label: 'Luz', amount: 25000, emoji: '⚡' },
  { label: 'Pan', amount: 5000, emoji: '🥖' },
];

export function WithdrawalModal({ shiftId, onClose, onSuccess }: WithdrawalModalProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<CashWithdrawalDto['reason']>('gasto_operativo');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(preset: (typeof QUICK_PRESETS)[number]) {
    setAmount(preset.amount.toString());
    setNote(preset.label);
  }

  async function submit() {
    setError(null);
    const num = parseCLP(amount);
    const parsed = CashWithdrawalSchema.safeParse({
      amount: num,
      reason,
      note: note || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/shifts/withdrawal', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">💸 Registrar gasto</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Quick presets */}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2 uppercase">Accesos rápidos</div>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-lg p-2 text-center"
              >
                <div className="text-2xl">{p.emoji}</div>
                <div className="text-xs font-medium">{p.label}</div>
                <div className="text-xs text-slate-500">{formatCLP(p.amount)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Monto</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-8 pr-3 py-3 text-2xl font-bold text-right rounded-lg border border-slate-300"
              autoFocus
            />
          </div>
          {amount && (
            <p className="mt-1 text-xs text-slate-500 text-right">{formatCLP(parseCLP(amount))}</p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Motivo</label>
          <div className="grid grid-cols-2 gap-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={`p-2 rounded-lg text-sm text-left flex items-center gap-2 ${
                  reason === r.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{r.emoji}</span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">
            Nota (opcional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Recibo #123, mes de junio"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            maxLength={200}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 text-slate-800 py-3 rounded-lg font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading || !amount}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold disabled:opacity-50"
          >
            {loading ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
