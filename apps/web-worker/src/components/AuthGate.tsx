import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { supabase, apiFetch, setGlobalBusinessId } from '@/lib/api-with-business';
import { currentWorkerAtom, selectedBusinessAtom, CurrentWorker } from '@/atoms';

/**
 * AuthGate del worker: mantiene la sesión y carga memberships.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [worker, setWorker] = useAtom(currentWorkerAtom);
  const selectedBusiness = useAtomValue(selectedBusinessAtom);
  const setSelectedBusiness = useSetAtom(selectedBusinessAtom);
  const [ready, setReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (data.session?.user) {
          // Cargar perfil + memberships desde /api/auth/me
          try {
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

            if (!mounted) return;

            if (!profile.is_active) {
              await supabase.auth.signOut();
              setWorker(null);
              return;
            }

            // Filtrar memberships activos
            const activeMemberships = profile.memberships.filter(
              (m) => m.is_active && m.business.is_active,
            );

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

            setWorker(workerData);

            // Auto-seleccionar primer negocio si hay worker/owner
            const firstBusiness = activeMemberships[0]?.business;
            if (firstBusiness) {
              setSelectedBusiness(firstBusiness);
              setGlobalBusinessId(firstBusiness.id);
            }
          } catch (apiErr) {
            console.warn('No se pudo cargar memberships:', apiErr);
            // Fallback: solo perfil básico
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, email, full_name, is_active')
              .eq('id', data.session.user.id)
              .single();

            if (!mounted) return;

            if (!profile) {
              setWorker(null);
              return;
            }

            setWorker({
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name,
              memberships: [],
            });
          }
        }
      } finally {
        if (mounted) setReady(true);
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (!session) {
        setWorker(null);
        setSelectedBusiness(null);
        setGlobalBusinessId(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [setWorker, setSelectedBusiness]);

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
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500">Cargando...</span>
        </div>
      </div>
    );
  }

  const hasSession = !!worker;
  const onLogin = location.pathname === '/login';
  if (!hasSession && !onLogin) return <Navigate to="/login" replace />;
  if (hasSession && onLogin) return <Navigate to="/pos" replace />;
  return <>{children}</>;
}
