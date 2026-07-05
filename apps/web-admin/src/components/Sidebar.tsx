import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { currentUserAtom } from '@/atoms/auth';
import { NotificationBell } from './NotificationBell';
import { ProfileSlideover } from './ProfileSlideover';
import { supabase } from '@/lib/supabase';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/products', label: 'Productos', icon: '📦' },
  { to: '/calendar', label: 'Calendario', icon: '📅' },
  { to: '/notifications', label: 'Notificaciones', icon: '🔔' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const user = useAtomValue(currentUserAtom);
  const [openMobile, setOpenMobile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  function getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    return (first + last).toUpperCase() || '?';
  }

  return (
    <>
      {/* Mobile backdrop */}
      {openMobile && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-30 animate-fade-in"
          onClick={() => setOpenMobile(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 z-40
          flex flex-col transition-transform duration-200
          ${openMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gradient-brand flex items-center justify-center text-white font-bold shadow-sm">
              P
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-tight">POS Pyme</div>
              <div className="text-xs text-slate-500">Admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpenMobile(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* NotificationBell integrado en el sidebar también */}
          <div className="lg:hidden mt-2 pt-2 border-t border-slate-200">
            <NotificationBell />
          </div>
        </nav>

        {/* User section */}
        <div className="px-3 py-3 border-t border-slate-200">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full bg-slate-50 hover:bg-slate-100 rounded-lg p-3 mb-2 text-left transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              {/* Avatar con iniciales */}
              <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user ? getInitials(user.full_name) : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">
                  {user?.full_name || 'Usuario'}
                </div>
                <div className="text-xs text-slate-500 truncate">{user?.email}</div>
              </div>
              <span className="opacity-0 group-hover:opacity-100 text-slate-400 text-xs transition-opacity">
                ✎
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="badge-success text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {user?.role}
              </span>
            </div>
          </button>
          <button
            onClick={signOut}
            className="w-full btn-ghost text-sm text-slate-600 hover:text-red-600 hover:bg-red-50"
          >
            <span>🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Profile slideover */}
      {profileOpen && user && (
        <ProfileSlideover user={user} onClose={() => setProfileOpen(false)} />
      )}

      {/* Mobile menu button */}
      <button
        onClick={() => setOpenMobile(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-white border border-slate-200 rounded-lg shadow-soft flex items-center justify-center"
      >
        <span className="text-lg">☰</span>
      </button>
    </>
  );
}
