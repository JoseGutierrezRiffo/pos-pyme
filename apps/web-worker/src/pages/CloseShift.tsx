import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { CloseShiftSchema } from '@pos-pyme/validation';
import { formatCLP, parseCLP } from '@pos-pyme/business-rules';
import { apiFetch, supabase } from '@/lib/api-with-business';
import { currentShiftAtom, currentWorkerAtom, cartAtom } from '@/atoms';
import { BreakDuration } from '@/components/BreakTimer';

type Step = 'summary' | 'count' | 'result';

export function CloseShift() {
  const navigate = useNavigate();
  const shift = useAtomValue(currentShiftAtom);
  const setShift = useSetAtom(currentShiftAtom);
  const worker = useAtomValue(currentWorkerAtom);
  const setWorker = useSetAtom(currentWorkerAtom);
  const setCart = useSetAtom(cartAtom);
  const [step, setStep] = useState<Step>('summary');
  const [declared, setDeclared] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shift) navigate('/open-shift');
  }, [shift]);

  if (!shift) return null;

  async function signOutAndExit() {
    setCart([]);
    setShift(null);
    setWorker(null);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  async function submitClose() {
    const final = parseCLP(declared);
    const parsed = CloseShiftSchema.safeParse({ cash_declared: final, notes });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Monto inválido');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any>('/shifts/close', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      setResult(res);
      setShift(null);
      setStep('result');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Pantalla de resultado
  if (step === 'result' && result) {
    const disc = Number(result.discrepancy ?? 0);
    const status: 'OK' | 'ATENCION' | 'CRITICO' =
      Math.abs(disc) > 3000 ? 'CRITICO' : Math.abs(disc) > 1000 ? 'ATENCION' : 'OK';
    const directionText =
      disc === 0
        ? '✅ Cuadra exacto'
        : disc > 0
          ? `↑ Sobra ${formatCLP(Math.abs(disc))}`
          : `↓ Falta ${formatCLP(Math.abs(disc))}`;
    const statusConfig = {
      OK: {
        emoji: '✅',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-300',
      },
      ATENCION: {
        emoji: '⚠️',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-300',
      },
      CRITICO: { emoji: '🚨', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
    }[status];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 animate-slide-up">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-100 mb-3 text-5xl">
              {statusConfig.emoji}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {status === 'OK'
                ? '¡Buen trabajo'
                : status === 'ATENCION'
                  ? 'Casi cuadra'
                  : 'Atención requerida'}
            </h1>
            {worker?.full_name && <p className="text-sm text-slate-500 mt-1">{worker.full_name}</p>}
          </div>

          {/* Status badge */}
          <div
            className={`rounded-2xl p-5 text-center border-2 ${statusConfig.bg} ${statusConfig.border}`}
          >
            <div className={`text-xs font-bold uppercase tracking-wider ${statusConfig.text} mb-1`}>
              {status}
            </div>
            <div className={`text-2xl font-bold ${statusConfig.text}`}>{directionText}</div>
          </div>

          {/* Detalles */}
          <dl className="space-y-2 text-sm bg-slate-50 rounded-xl p-4">
            <Row label="Efectivo declarado" value={formatCLP(Number(result.cash_declared))} />
            <Row label="Esperado por sistema" value={formatCLP(Number(result.cash_expected))} />
            <div className="border-t border-slate-200 pt-2 mt-2">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                💳 Ventas por método
              </div>
              <Row
                label={
                  <span className="flex items-center gap-1.5">
                    <span>💵</span>Efectivo
                  </span>
                }
                value={formatCLP(Number(result.total_cash_sales ?? 0))}
                mono
              />
              <Row
                label={
                  <span className="flex items-center gap-1.5">
                    <span>💳</span>Tarjeta
                  </span>
                }
                value={formatCLP(Number(result.total_card_sales ?? 0))}
                mono
              />
              <Row
                label={
                  <span className="flex items-center gap-1.5">
                    <span>📲</span>Transfer.
                  </span>
                }
                value={formatCLP(Number(result.total_transfer_sales ?? 0))}
                mono
              />
              <Row label="Total ventas" value={formatCLP(Number(result.total_sales))} bold />
            </div>
            <div className="border-t border-slate-200 pt-2 mt-2">
              <Row label="Retiros" value={formatCLP(Number(result.cash_withdrawals))} />
              {result.break_started_at && result.break_ended_at && (
                <Row
                  label="⏱️ Tiempo de colación"
                  value={
                    <BreakDuration
                      startedAt={result.break_started_at}
                      endedAt={result.break_ended_at}
                    />
                  }
                />
              )}
            </div>
          </dl>

          <button onClick={signOutAndExit} className="btn-primary w-full py-3.5 text-base">
            🚪 Salir y cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // Pantalla de count (ciego para expected_cash, pero con desglose por método)
  if (step === 'count') {
    const totalCash = Number(shift.total_cash_sales);
    const totalCard = Number(shift.total_card_sales ?? 0);
    const totalTransfer = Number(shift.total_transfer_sales ?? 0);
    const hasNonCashSales = totalCard > 0 || totalTransfer > 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 flex items-center justify-center relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative w-full max-w-md space-y-5 animate-slide-up">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-3 text-3xl">
              🔒
            </div>
            <h1 className="text-2xl font-bold mb-1">
              {worker?.full_name
                ? `${worker.full_name.split(' ')[0]}, cuenta el efectivo`
                : 'Cuenta el efectivo'}
            </h1>
            <p className="text-sm text-slate-400">Abre la caja y cuenta solo el efectivo físico</p>
          </div>

          {/* Desglose de ventas del turno */}
          <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Ventas del turno
            </div>

            {/* Efectivo — VA A LA CAJA */}
            <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-3 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💵</span>
                  <div>
                    <div className="text-sm font-bold">Efectivo</div>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-300">
                      Esto va a la caja
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-lg tabular-nums">
                  {formatCLP(totalCash)}
                </div>
              </div>
            </div>

            {/* Tarjeta — VA AL BANCO, NO CONTAR */}
            {totalCard > 0 && (
              <div className="bg-slate-700/30 border border-slate-500/20 rounded-xl p-3 mb-2 opacity-70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💳</span>
                    <div>
                      <div className="text-sm font-bold">Tarjeta</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">
                        Va al banco · no contar
                      </div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-lg tabular-nums">
                    {formatCLP(totalCard)}
                  </div>
                </div>
              </div>
            )}

            {/* Transferencia — VA AL BANCO, NO CONTAR */}
            {totalTransfer > 0 && (
              <div className="bg-slate-700/30 border border-slate-500/20 rounded-xl p-3 mb-2 opacity-70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📲</span>
                    <div>
                      <div className="text-sm font-bold">Transferencia</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">
                        Va al banco · no contar
                      </div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-lg tabular-nums">
                    {formatCLP(totalTransfer)}
                  </div>
                </div>
              </div>
            )}

            {/* Mensaje claro si no hubo ventas en efectivo */}
            {totalCash === 0 && (
              <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl p-3 text-amber-200 text-xs">
                <strong>No hubo ventas en efectivo.</strong> La caja debería tener solo el efectivo
                inicial menos los retiros.
              </div>
            )}
          </div>

          {/* Input del conteo */}
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              {hasNonCashSales
                ? 'Total de efectivo contado en la caja'
                : 'Total contado en la caja'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-2xl font-bold">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={declared}
                onChange={(e) => setDeclared(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full pl-12 pr-4 py-5 text-4xl font-bold text-slate-900 text-right rounded-2xl bg-white border-0 focus:ring-4 focus:ring-brand-500/30 focus:outline-none tabular-nums"
              />
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas (opcional, ej: 'billete roto')"
              rows={2}
              className="w-full mt-3 rounded-xl bg-white text-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
              maxLength={500}
            />
          </div>

          {/* Mensaje de ayuda */}
          <div className="bg-brand-500/10 border border-brand-400/30 rounded-xl p-3 text-brand-100 text-xs flex items-start gap-2">
            <span className="text-base">💡</span>
            <span>
              <strong>Recuerda:</strong> solo cuentas el dinero físico que hay en la caja. Las
              ventas con tarjeta y transferencia ya fueron acreditadas en tu cuenta bancaria.
            </span>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-sm rounded-xl p-3 animate-fade-in">
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep('summary')}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              ← Volver
            </button>
            <button
              onClick={submitClose}
              disabled={loading}
              className="flex-1 gradient-brand text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Cerrando…' : 'Cerrar caja'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step: summary
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-emerald-50 p-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 animate-slide-up">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-brand shadow-lg mb-3 text-3xl">
            📋
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Resumen del turno</h1>
          <p className="text-sm text-slate-500 mt-1">
            Revisá los números antes de contar el efectivo
          </p>
        </div>

        <dl className="space-y-2 text-sm bg-slate-50 rounded-xl p-4">
          <Row label="Efectivo inicial" value={formatCLP(Number(shift.cash_initial))} />
          <div className="border-t border-slate-200 pt-2 mt-2">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              💳 Ventas por método
            </div>
            <Row
              label={
                <span className="flex items-center gap-1.5">
                  <span>💵</span>Efectivo
                </span>
              }
              value={formatCLP(Number(shift.total_cash_sales))}
              mono
            />
            <Row
              label={
                <span className="flex items-center gap-1.5">
                  <span>💳</span>Tarjeta
                </span>
              }
              value={formatCLP(Number(shift.total_card_sales ?? 0))}
              mono
            />
            <Row
              label={
                <span className="flex items-center gap-1.5">
                  <span>📲</span>Transfer.
                </span>
              }
              value={formatCLP(Number(shift.total_transfer_sales ?? 0))}
              mono
            />
            <Row label="Total ventas" value={formatCLP(Number(shift.total_sales))} bold />
          </div>
          <div className="border-t border-slate-200 pt-2 mt-2">
            <Row label="Retiros del turno" value={formatCLP(Number(shift.cash_withdrawals))} />
            {shift.break_started_at && shift.break_ended_at && (
              <Row
                label="⏱️ Tiempo de colación"
                value={
                  <BreakDuration
                    startedAt={shift.break_started_at}
                    endedAt={shift.break_ended_at}
                  />
                }
              />
            )}
          </div>
        </dl>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
            ⚠️ {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => navigate('/pos')}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button onClick={() => setStep('count')} className="flex-1 btn-primary py-3">
            Contar efectivo →
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  mono,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center ${
        bold ? 'font-bold text-base text-slate-900' : 'text-slate-700'
      }`}
    >
      <dt className="text-slate-500 text-sm">{label}</dt>
      <dd className={`tabular-nums ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
