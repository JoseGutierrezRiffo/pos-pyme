import { useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import { currentShiftAtom } from '@/atoms';
import { apiFetch } from '@/lib/api-with-business';

export function ColacionScreen() {
  const setShift = useSetAtom(currentShiftAtom);
  const shift = useAtomValueSafe();
  const breakStart = shift?.break_started_at;

  // useState para forzar re-render cada segundo
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!breakStart) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [breakStart]);

  async function volver() {
    try {
      const updated = await apiFetch<any>('/shifts/break/end', { method: 'POST' });
      setShift(updated);
    } catch (err) {
      console.error('Error al volver:', err);
    }
  }

  if (!breakStart) return null;

  const start = new Date(breakStart);
  const elapsed = formatElapsed(start);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-300/20 blur-3xl animate-pulse" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-orange-300/20 blur-3xl" />

      <div className="relative text-center max-w-sm animate-slide-up">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl gradient-amber shadow-xl mb-6 animate-pulse-strong">
          <span className="text-5xl">🍽️</span>
        </div>

        <h1 className="text-3xl font-bold text-amber-900 mb-2">En colación</h1>
        <p className="text-amber-700 mb-1">
          Inicio: <strong>{formatTime(start)}</strong>
        </p>

        <div className="my-8 bg-white/70 backdrop-blur rounded-3xl p-8 shadow-xl border border-amber-200">
          <div className="text-xs uppercase tracking-wider font-semibold text-amber-700 mb-2">
            Tiempo transcurrido
          </div>
          <div className="text-6xl font-bold font-mono text-amber-900 tracking-tight tabular-nums">
            {elapsed.large}
          </div>
        </div>

        <button onClick={volver} className="btn-warning w-full py-4 text-lg shadow-lg">
          ↩️ Volver de colación
        </button>

        <p className="text-xs text-amber-700 mt-4">El sistema queda bloqueado hasta tu regreso</p>
      </div>
    </div>
  );
}

// Hook helper: obtener shift de forma segura
import { useAtomValue } from 'jotai';
function useAtomValueSafe() {
  return useAtomValue(currentShiftAtom);
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatElapsed(start: Date, end: Date = new Date()): { large: string } {
  const ms = Math.max(0, end.getTime() - start.getTime());
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const large =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { large };
}
