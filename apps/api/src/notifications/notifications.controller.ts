import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/supabase-jwt.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Lista las notificaciones del usuario actual */
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('only_unread') onlyUnread?: string,
  ) {
    return this.notifications.list(user.id, {
      limit: limit ? Number(limit) : undefined,
      onlyUnread: onlyUnread === 'true',
    });
  }

  /** Cantidad de no leídas (para badge) */
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    const count = await this.notifications.countUnread(user.id);
    return { count };
  }

  /** Marca una notificación como leída */
  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(id, user.id);
  }

  /** Marca todas como leídas */
  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }
}
