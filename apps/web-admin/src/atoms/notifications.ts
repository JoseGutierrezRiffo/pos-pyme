import { atom } from 'jotai';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  payload: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export const notificationsAtom = atom<NotificationItem[]>([]);

/** Cantidad de no leídas (derivado de la lista) */
export const unreadCountAtom = atom(
  (get) => get(notificationsAtom).filter((n) => !n.is_read).length,
);
