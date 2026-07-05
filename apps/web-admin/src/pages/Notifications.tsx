import { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { formatCLP } from '@pos-pyme/business-rules';
import { fetchNotifications, markAsRead, markAllAsRead } from '@/lib/notifications';
import { notificationsAtom, type NotificationItem } from '@/atoms/notifications';

type FilterType = 'all' | 'unread';

export function Notifications() {
  const [notifications, setNotifications] = useAtom(notificationsAtom);
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  async function loadNotifications() {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchNotifications(filter === 'unread');
      setNotifications(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Filtrar por búsqueda localmente
  const filteredNotifications = search.trim()
    ? notifications.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.message.toLowerCase().includes(search.toLowerCase()) ||
          (n.type ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : notifications;

  async function handleMarkRead(id: string) {
    try {
      await markAsRead(id);
      await loadNotifications();
    } catch (err) {
      console.error('Error marcando como leída:', err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllAsRead();
      await loadNotifications();
    } catch (err) {
      console.error('Error marcando todas como leídas:', err);
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

  function getNotificationIcon(type: string): string {
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🔔 Notificaciones</h1>
          <p className="text-sm text-slate-500 mt-1">Eventos importantes de tu negocio</p>
        </div>
        {unreadCount > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
            {unreadCount} sin leer
          </span>
        )}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, mensaje o tipo..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              filter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            No leídas
            {unreadCount > 0 && (
              <span className="bg-red-600 text-white text-xs px-1.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
        {notifications.some((n) => !n.is_read) && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            ✓ Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">{error}</div>
      )}

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-slate-400">
          Cargando notificaciones…
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-slate-500">
            {search
              ? `Sin resultados para "${search}"`
              : filter === 'unread'
                ? 'No hay notificaciones sin leer'
                : 'No hay notificaciones'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((n) => {
            const payload = parsePayload(n.payload);
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                className={`bg-white rounded-lg shadow p-4 flex gap-3 transition cursor-pointer hover:shadow-md ${
                  n.is_read ? 'opacity-60' : 'border-l-4 border-brand-500'
                }`}
              >
                <div className="text-3xl flex-shrink-0">{getNotificationIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3
                      className={`font-semibold ${n.is_read ? 'text-slate-700' : 'text-slate-900'}`}
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
                    <div className="mt-3 bg-slate-50 rounded p-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs">
                      {payload.total_sales !== undefined && (
                        <div>
                          <span className="text-slate-500">Ventas</span>
                          <div className="font-semibold">
                            {formatCLP(Number(payload.total_sales))}
                          </div>
                        </div>
                      )}
                      {payload.expected_cash !== undefined && (
                        <div>
                          <span className="text-slate-500">Esperado</span>
                          <div className="font-semibold">
                            {formatCLP(Number(payload.expected_cash))}
                          </div>
                        </div>
                      )}
                      {payload.final_cash !== undefined && (
                        <div>
                          <span className="text-slate-500">Declarado</span>
                          <div className="font-semibold">
                            {formatCLP(Number(payload.final_cash))}
                          </div>
                        </div>
                      )}
                      {payload.discrepancy !== undefined && (
                        <div>
                          <span className="text-slate-500">Descuadre</span>
                          <div
                            className={`font-semibold ${
                              Number(payload.discrepancy) === 0
                                ? 'text-green-600'
                                : Math.abs(Number(payload.discrepancy)) > 3000
                                  ? 'text-red-600'
                                  : 'text-amber-600'
                            }`}
                          >
                            {formatCLP(Number(payload.discrepancy))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payload details: stock_movement */}
                  {n.type === 'stock_movement' && (
                    <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                      {payload.product_name && (
                        <div>
                          <strong>{payload.product_name}</strong>{' '}
                          {payload.product_sku && (
                            <span className="text-slate-400">({payload.product_sku})</span>
                          )}
                        </div>
                      )}
                      {payload.quantity && payload.type && (
                        <div>
                          {payload.type === 'in' ? 'Sumar' : 'Retirar'}:{' '}
                          <strong className="tabular-nums">{payload.quantity}</strong> unidades
                        </div>
                      )}
                      {payload.worker_name && (
                        <div className="opacity-70 mt-0.5">
                          Solicitado por: {payload.worker_name}
                        </div>
                      )}
                    </div>
                  )}

                  {!n.is_read && (
                    <div className="text-xs text-brand-600 mt-2 font-medium">
                      Click para marcar como leída →
                    </div>
                  )}
                </div>
                {!n.is_read && (
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
