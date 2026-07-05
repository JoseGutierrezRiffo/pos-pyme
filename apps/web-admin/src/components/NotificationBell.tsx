import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCLP } from '@pos-pyme/business-rules';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
} from '@/lib/notifications';
import type { NotificationItem } from '@/atoms/notifications';

/**
 * Campana de notificaciones + slideover.
 *
 * - Badge rojo con cantidad de no leídas (auto-refresca cada 30s)
 * - Click → slideover desde la derecha con la lista completa
 * - Click en notificación → marca como leída
 * - Sin recarga de página (UX fluida)
 */
export function NotificationBell() {
  const [count, setCount] = useState<number>(0);
  const [open, setOpen] = useState(false);

  // Fetch inicial del count
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const c = await fetchUnreadCount();
        if (mounted) setCount(c);
      } catch (err) {
        console.error('Error cargando notificaciones:', err);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setOpen(true)}
        className="relative bg-white border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
      >
        <span>🔔</span>
        <span className="text-sm hidden sm:inline">Notificaciones</span>
        {count > 0 && (
          <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-pulse">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Slideover */}
      {open && <NotificationsSlideover onClose={() => setOpen(false)} onCountChange={setCount} />}
    </>
  );
}

interface NotificationsSlideoverProps {
  onClose: () => void;
  onCountChange: (n: number) => void;
}

type FilterType = 'all' | 'unread';

function NotificationsSlideover({ onClose, onCountChange }: NotificationsSlideoverProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [filter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications(filter === 'unread');
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await markAsRead(id);
      await load();
      // Actualizar count: leer cantidad actual del backend
      const newCount = await fetchUnreadCount();
      onCountChange(newCount);
    } catch (err) {
      console.error('Error marcando como leída:', err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllAsRead();
      await load();
      const newCount = await fetchUnreadCount();
      onCountChange(newCount);
    } catch (err) {
      console.error('Error marcando todas:', err);
    }
  }

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />

      {/* Slideover panel */}
      <div className="absolute inset-y-0 right-0 w-full sm:w-[28rem] bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              🔔 Notificaciones
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} sin leer
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Eventos importantes de tu negocio</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex gap-1">
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')} label="Todas" />
            <FilterPill
              active={filter === 'unread'}
              onClick={() => setFilter('unread')}
              label={`No leídas${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            />
          </div>
          {items.some((n) => !n.is_read) && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap"
            >
              ✓ Marcar todas
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="inline-block w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mb-2" />
              <div className="text-sm">Cargando...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-5xl mb-3 opacity-30">📭</div>
              <p className="text-slate-500 text-sm">
                {filter === 'unread' ? 'No hay notificaciones sin leer' : 'No hay notificaciones'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((n) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  onMarkRead={() => handleMarkRead(n.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <Link
            to="/notifications"
            onClick={onClose}
            className="block w-full text-center btn-secondary"
          >
            Ver todas las notificaciones →
          </Link>
        </div>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

function NotificationCard({
  notification: n,
  onMarkRead,
}: {
  notification: NotificationItem;
  onMarkRead: () => void;
}) {
  const payload = parsePayload(n.payload);

  function getIcon(type: string): string {
    switch (type) {
      case 'shift_closed':
        return '💰';
      case 'low_stock':
        return '⚠️';
      case 'cash_discrepancy':
        return '🚨';
      case 'stock_movement':
        return '📦';
      default:
        return '🔔';
    }
  }

  function getRelativeTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 30) return 'recién';
    if (diffMins < 1) return `hace ${diffSecs}s`;
    if (diffMins < 60) return `hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `hace ${diffDays} d`;
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  }

  return (
    <div
      onClick={() => !n.is_read && onMarkRead()}
      className={`p-4 transition-colors cursor-pointer ${
        n.is_read ? 'opacity-60' : 'bg-brand-50/40 border-l-4 border-brand-500'
      } hover:bg-slate-50`}
    >
      <div className="flex gap-3">
        <div className="text-2xl flex-shrink-0">{getIcon(n.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3
              className={`text-sm font-semibold ${n.is_read ? 'text-slate-700' : 'text-slate-900'}`}
            >
              {n.title}
            </h3>
            <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
              {getRelativeTime(n.created_at)}
            </span>
          </div>
          <p className="text-sm text-slate-600">{n.message}</p>

          {/* Payload details: shift_closed */}
          {n.type === 'shift_closed' && Object.keys(payload).length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
              {payload.total_sales !== undefined && (
                <div>
                  <span className="text-slate-500">Ventas:</span>{' '}
                  <span className="font-mono font-semibold">
                    {formatCLP(Number(payload.total_sales))}
                  </span>
                </div>
              )}
              {payload.expected_cash !== undefined && (
                <div>
                  <span className="text-slate-500">Esperado:</span>{' '}
                  <span className="font-mono font-semibold">
                    {formatCLP(Number(payload.expected_cash))}
                  </span>
                </div>
              )}
              {payload.final_cash !== undefined && (
                <div>
                  <span className="text-slate-500">Declarado:</span>{' '}
                  <span className="font-mono font-semibold">
                    {formatCLP(Number(payload.final_cash))}
                  </span>
                </div>
              )}
              {payload.discrepancy !== undefined && (
                <div>
                  <span className="text-slate-500">Descuadre:</span>{' '}
                  <span
                    className={`font-mono font-semibold ${
                      Number(payload.discrepancy) === 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {formatCLP(Number(payload.discrepancy))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Payload details: stock_movement */}
          {n.type === 'stock_movement' && (
            <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded p-2">
              {payload.product_name && (
                <div>
                  <strong>{payload.product_name}</strong> ({payload.product_sku})
                </div>
              )}
              {payload.quantity && (
                <div>
                  {payload.type === 'in' ? 'Sumar' : 'Retirar'}:{' '}
                  <strong className="tabular-nums">{payload.quantity}</strong> unidades
                </div>
              )}
              {payload.worker_name && (
                <div className="opacity-70 mt-0.5">Solicitado por: {payload.worker_name}</div>
              )}
            </div>
          )}

          {!n.is_read && (
            <div className="text-xs text-brand-600 mt-1.5 font-medium">
              Toca para marcar como leída
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function parsePayload(p: any): Record<string, any> {
  if (!p) return {};
  if (typeof p === 'string') {
    try {
      return JSON.parse(p);
    } catch {
      return {};
    }
  }
  return p;
}
