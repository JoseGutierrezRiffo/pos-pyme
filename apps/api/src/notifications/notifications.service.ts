import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../common/supabase.module';

@Injectable()
export class NotificationsService {
  constructor(@Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient) {}

  async list(userId: string, opts: { limit?: number; onlyUnread?: boolean } = {}) {
    let query = this.admin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 50);

    if (opts.onlyUnread) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async countUnread(userId: string): Promise<number> {
    const { count, error } = await this.admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count ?? 0;
  }

  async markRead(id: string, userId: string) {
    const { data, error } = await this.admin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId) // seguridad: solo puede marcar las suyas
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async markAllRead(userId: string) {
    const { data, error } = await this.admin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();

    if (error) throw error;
    return data ?? [];
  }
}
