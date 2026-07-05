import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { LoginSchema } from '@pos-pyme/validation';
import { supabase, apiFetch } from '@/lib/api-with-business';
import { currentUserAtom, selectedBusinessAtom, CurrentUser } from '@/atoms/auth';

export function Login() {
  const navigate = useNavigate();
  const setUser = useSetAtom(currentUserAtom);
  const setSelectedBusiness = useSetAtom(selectedBusinessAtom);
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
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (authErr) throw authErr;

      console.log('[Login] Auth successful, user ID:', data.user?.id);

      // Obtener perfil con memberships desde /api/auth/me
      const profile = await apiFetch<{
        id: string;
        email: string;
        role: string;
        full_name: string;
        memberships?: Array<{
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

      console.log('[Login] /auth/me response:', profile);

      // Verificar que tiene al menos un membership
      const memberships = profile.memberships ?? [];
      if (memberships.length === 0) {
        console.error('[Login] No memberships in response');
        throw new Error('No tienes negocios asignados');
      }

      // Filtrar memberships activos
      const activeMemberships = memberships.filter((m) => m.is_active && m.business.is_active);
      if (activeMemberships.length === 0) {
        throw new Error('No tienes negocios activos');
      }

      // Auto-seleccionar el primer negocio
      const firstMembership = activeMemberships[0];
      if (!firstMembership) {
        throw new Error('No tienes negocios activos');
      }
      const firstBusiness = firstMembership.business;

      const user: CurrentUser = {
        id: profile.id,
        email: profile.email,
        role: profile.role as 'admin' | 'worker',
        full_name: profile.full_name,
        memberships: activeMemberships.map((m) => ({
          membership_id: m.membership_id,
          role: m.role as 'owner' | 'admin' | 'worker',
          is_active: m.is_active,
          business: m.business,
        })),
      };

      setUser(user);
      setSelectedBusiness(firstBusiness);

      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-lg shadow-md p-6 space-y-4"
      >
        <h1 className="text-2xl font-bold text-slate-900">POS Pyme — Admin</h1>

        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border-slate-300 border px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border-slate-300 border px-3 py-2"
            required
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
