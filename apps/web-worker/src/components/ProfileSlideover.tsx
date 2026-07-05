import { useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import { currentWorkerAtom, type CurrentWorker } from '@/atoms';
import { updateMyProfile } from '@/lib/profile';

interface ProfileSlideoverProps {
  worker: CurrentWorker;
  onClose: () => void;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export function ProfileSlideover({ worker, onClose }: ProfileSlideoverProps) {
  const setWorker = useSetAtom(currentWorkerAtom);
  const [fullName, setFullName] = useState(worker.full_name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(worker.full_name);
    setError(null);
    setSaved(false);
  }, [worker.full_name]);

  const dirty = fullName.trim() !== worker.full_name && fullName.trim().length >= 2;
  const valid = fullName.trim().length >= 2 && fullName.trim().length <= 100;

  async function save() {
    setError(null);
    setLoading(true);
    try {
      const updated = await updateMyProfile({ full_name: fullName.trim() });
      setWorker({
        ...worker,
        full_name: updated.full_name,
      });
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full sm:w-[28rem] bg-white shadow-2xl flex flex-col animate-slide-in-right">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">👤 Mi perfil</h2>
            <p className="text-xs text-slate-500 mt-0.5">Tu información personal</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-3">
              {getInitials(fullName || worker.full_name)}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">
              Vista previa del avatar
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <div className="input bg-slate-50 cursor-not-allowed text-slate-500">
              {worker.email}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Nombre completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre"
              className="input"
              maxLength={100}
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">
              Cómo te verán los demás en notificaciones y mensajes
            </p>
            {!valid && fullName.length > 0 && (
              <p className="text-xs text-red-600 mt-1">⚠️ Mínimo 2 caracteres</p>
            )}
          </div>

          {saved && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-3 text-sm flex items-center gap-2 animate-fade-in">
              <span className="text-lg">✅</span>
              <span>Perfil actualizado</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm animate-fade-in">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-xl font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!dirty || !valid || loading || saved}
            className="flex-1 btn-primary py-3 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
