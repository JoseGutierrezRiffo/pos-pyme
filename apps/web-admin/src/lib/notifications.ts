import { apiFetch } from './api-with-business';
import type { NotificationItem } from '@/atoms/notifications';

export async function fetchNotifications(onlyUnread = false) {
  const qs = onlyUnread ? '?only_unread=true' : '';
  return apiFetch<NotificationItem[]>(`/notifications${qs}`);
}

export async function fetchUnreadCount(): Promise<number> {
  const result = await apiFetch<{ count: number }>('/notifications/unread-count');
  return result.count;
}

export async function markAsRead(id: string) {
  return apiFetch<NotificationItem>(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export async function markAllAsRead() {
  return apiFetch('/notifications/read-all', { method: 'PATCH' });
}
