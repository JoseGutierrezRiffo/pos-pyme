import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { LoginSchema } from '@pos-pyme/validation';
import { formatCLP } from '@pos-pyme/business-rules';
import { parseCLP } from '@pos-pyme/business-rules';
import { supabase } from '@/lib/supabase';
import { apiFetch, setGlobalBusinessId } from '@/lib/api-with-business';
import {
  currentWorkerAtom,
  selectedBusinessAtom,
  businessVersionAtom,
  CurrentWorker,
} from '@/atoms';

export function Login() {
  const navigate = useNavigate();
  const setWorker = useSetAtom(currentWorkerAtom);
  const setSelectedBusiness = useSetAtom(selectedBusinessAtom);
  const setBusinessVersion = useSetAtom(businessVersionAtom);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    try {
      // 1) Login con Supabase
      const { data, error: authErr } = await supabase.auth.signInWithPassword(parsed.data);
      if (authErr) throw authErr;

      if (data.session) {
        await supabase.auth.setSession(data.session);
      }

      console.log('[Worker Login] Auth successful, user ID:', data.user?.id);

      // 2) Cargar perfil + memberships desde /api/auth/me
      const profile = await apiFetch<{
        id: string;
        email: string;
        full_name: string;
        is_active: boolean;
        memberships: Array<{
          membership_id: string;
          role: string;
          is_active: boolean;
          business: {
            id: string;
            name: string;
            slug: string;
            is_active: boolean;
          };
        }>;
      }>('/auth/me');

      console.log('[Worker Login] /auth/me response:', profile);

      // 3) Verificar que tiene al menos un membership
      const memberships = profile.memberships ?? [];
      if (memberships.length === 0) {
        throw new Error('No tienes negocios asignados');
      }

      // 4) Filtrar memberships activos
      const activeMemberships = memberships.filter((m) => m.is_active && m.business.is_active);

      if (activeMemberships.length === 0) {
        throw new Error('No tienes negocios activos');
      }

      // 5) Auto-seleccionar el primer negocio
      const firstMembership = activeMemberships[0];
      if (!firstMembership) {
        throw new Error('No tienes negocios activos');
      }
      const firstBusiness = firstMembership.business;

      const workerData: CurrentWorker = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        memberships: activeMemberships.map((m) => ({
          membership_id: m.membership_id,
          role: m.role as 'owner' | 'admin' | 'worker',
          is_active: m.is_active,
          business: m.business,
        })),
      };

      // 6) Setear el state global
      setWorker(workerData);
      setSelectedBusiness(firstBusiness);
      setGlobalBusinessId(firstBusiness.id);
      setBusinessVersion((v) => v + 1);

      // 7) Navegar a la pantalla principal
      navigate('/pos');
    } catch (err) {
      console.error('[Worker Login] Error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />

      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 space-y-5 animate-slide-up"
      >
        {/* Logo / Brand */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-brand shadow-lg mb-4">
            <span className="text-3xl">🛒</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">POS Pyme</h1>
          <p className="text-sm text-slate-500 mt-1">Punto de venta</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="input text-base"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="input text-base"
              required
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 animate-fade-in">
            <div className="flex items-start gap-2">
              <span className="text-base">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Ingresando…
            </>
          ) : (
            <>Ingresar →</>
          )}
        </button>

        <div className="text-center text-xs text-slate-400 pt-2">¿Problemas? Contactá al dueño</div>
      </form>
    </div>
  );
}
