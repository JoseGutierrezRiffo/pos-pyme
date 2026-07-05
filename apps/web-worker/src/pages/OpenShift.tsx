import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { OpenShiftSchema } from '@pos-pyme/validation';
import { formatCLP, parseCLP } from '@pos-pyme/business-rules';
import { apiFetch, setGlobalBusinessId } from '@/lib/api-with-business';
import {
  currentShiftAtom,
  currentWorkerAtom,
  selectedBusinessAtom,
  businessVersionAtom,
} from '@/atoms';
import { BusinessSelector } from '@/components/BusinessSelector';

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000];

export function OpenShift() {
  const navigate = useNavigate();
  const setShift = useSetAtom(currentShiftAtom);
  const worker = useAtomValue(currentWorkerAtom);
  const [selectedBusiness] = useAtom(selectedBusinessAtom);
  const [, setBusinessVersion] = useAtom(businessVersionAtom);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const num = parseCLP(amount);
  const valid = num > 0;

  async function handleBusinessChange(businessId: string) {
    const biz = worker?.memberships.find((m) => m.business.id === businessId);
    if (biz) {
      setGlobalBusinessId(biz.business.id);
    } else {
      setGlobalBusinessId(null);
    }
    setBusinessVersion((v) => v + 1);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedBusiness) {
      setError('Por favor selecciona un negocio antes de abrir turno');
      return;
    }

    const parsed = OpenShiftSchema.safeParse({ cash_initial: num });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Monto inválido');
      return;
    }

    setLoading(true);
    try {
      const shift = await apiFetch<any>('/shifts/open', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });

      setShift({
        id: shift.id,
        user_id: shift.user_id,
        shift_status: 'open',
        cash_initial: Number(shift.cash_initial),
        total_sales: 0,
        cash_withdrawals: 0,
        total_cash_sales: 0,
        total_card_sales: 0,
        total_transfer_sales: 0,
        opened_at: shift.opened_at,
        closed_at: null,
        break_started_at: null,
        break_ended_at: null,
        cash_expected: null,
        cash_declared: null,
        discrepancy: null,
      });
      navigate('/pos');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 animate-slide-up"
      >
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-emerald shadow-lg mb-3">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Abrir caja</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ingresá el efectivo inicial con el que empezás el turno
          </p>
        </div>

        {/* Business selector */}
        {worker && worker.memberships.length > 1 && (
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Negocio
            </div>
            <select
              value={selectedBusiness?.id ?? ''}
              onChange={(e) => handleBusinessChange(e.target.value)}
              className="w-full text-sm border-2 border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="">Seleccionar negocio...</option>
              {worker.memberships.map((m) => (
                <option key={m.business.id} value={m.business.id}>
                  {m.business.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Amount input */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
            Efectivo inicial (CLP)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-2xl font-bold">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-12 pr-4 py-5 text-4xl font-bold text-right rounded-2xl border-2 border-slate-200 bg-slate-50 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none transition-all"
              autoFocus
            />
          </div>
          {valid && (
            <p className="mt-2 text-sm text-emerald-700 text-right font-medium animate-fade-in">
              {formatCLP(num)}
            </p>
          )}
        </div>

        {/* Quick amounts */}
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
            Montos rápidos
          </div>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((preset) => {
              const presetNum = preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(presetNum.toString())}
                  className="py-2.5 rounded-lg bg-slate-100 hover:bg-brand-100 hover:text-brand-700 text-slate-700 font-semibold text-sm transition-colors active:scale-95"
                >
                  {formatCLP(presetNum).replace('$', '')}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 animate-fade-in">
            <div className="flex items-start gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !valid || !selectedBusiness}
          className="btn-success w-full py-4 text-lg"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Abriendo…
            </>
          ) : (
            <>Abrir turno →</>
          )}
        </button>
      </form>
    </div>
  );
}
