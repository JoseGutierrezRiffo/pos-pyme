import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { supabase, apiFetch, setGlobalBusinessId } from '@/lib/api-with-business';
import { currentUserAtom, selectedBusinessAtom, CurrentUser } from '@/atoms/auth';

/**
 * AuthGate: mantiene la sesión activa del usuario.
 *
 * - Al montar, chequea si hay sesión de Supabase
 * - Si hay, carga el profile + memberships desde /api/auth/me
 * - Suscribe a onAuthStateChange para mantener sincronizado
 * - Muestra "Cargando…" mientras valida (evita parpadeo del login)
 * - Redirige según estado: sin sesión → /login, con sesión → /dashboard
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useAtom(currentUserAtom);
  const selectedBusiness = useAtomValue(selectedBusinessAtom);
  const setSelectedBusiness = useSetAtom(selectedBusinessAtom);
  const [ready, setReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const { data } = await supabase.auth.getSession();

        if (!mounted) return;

        if (data.session?.user) {
          // Hay sesión → cargar perfil + memberships desde /api/auth/me
          try {
            const profile = await apiFetch<{
              id: string;
              email: string;
              role: string;
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

            if (!mounted) return;

            if (!profile.is_active) {
              // Usuario deshabilitado, cerrar sesión
              await supabase.auth.signOut();
              setUser(null);
              setSelectedBusiness(null);
              return;
            }

            // Filtrar memberships activos
            const activeMemberships = profile.memberships.filter(
              (m) => m.is_active && m.business.is_active,
            );

            const userData: CurrentUser = {
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

            setUser(userData);

            // Auto-seleccionar primer negocio
            const firstMembership = activeMemberships[0];
            if (firstMembership) {
              setSelectedBusiness(firstMembership.business);
            } else {
              setSelectedBusiness(null);
            }
          } catch (apiErr) {
            // Si falla /auth/me, usar fallback local
            console.warn('No se pudo cargar memberships desde API:', apiErr);
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, email, role, full_name, is_active')
              .eq('id', data.session.user.id)
              .single();

            if (!mounted) return;

            if (!profile) {
              setUser(null);
              return;
            }

            setUser({
              id: profile.id,
              email: profile.email,
              role: profile.role as 'admin' | 'worker',
              full_name: profile.full_name,
              memberships: [],
            });
          }
        }
        // Si no hay sesión, user queda null y el LoginGate redirige
      } catch (err) {
        console.error('Error cargando sesión:', err);
      } finally {
        if (mounted) setReady(true);
      }
    }

    loadSession();

    // Mantener el atom sincronizado con cambios de auth
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        setUser(null);
        setSelectedBusiness(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [setUser, setSelectedBusiness]);

  // Sincronizar selectedBusiness con globalBusinessId
  useEffect(() => {
    if (selectedBusiness?.id) {
      setGlobalBusinessId(selectedBusiness.id);
    } else {
      setGlobalBusinessId(null);
    }
  }, [selectedBusiness]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500">Cargando…</span>
        </div>
      </div>
    );
  }

  const hasSession = !!user;
  const isOnLoginPage = location.pathname === '/login';

  // Sin sesión → forzar login
  if (!hasSession && !isOnLoginPage) {
    return <Navigate to="/login" replace />;
  }

  // Con sesión pero en login → ir al dashboard
  if (hasSession && isOnLoginPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
