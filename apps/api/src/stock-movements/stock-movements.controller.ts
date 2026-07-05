import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { StockMovementsService } from './stock-movements.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/supabase-jwt.service';
import { CreateStockMovementSchema, ReviewMovementSchema } from '@pos-pyme/validation';

@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly movements: StockMovementsService) {}

  /**
   * Worker o admin crea una solicitud de movimiento.
   * Queda en estado "pending" hasta que el admin apruebe.
   */
  @Post()
  @Roles('worker', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = CreateStockMovementSchema.parse(body);
    return this.movements.create(user.id, dto);
  }

  /**
   * Lista solicitudes pendientes (solo admin).
   */
  @Get('pending')
  @Roles('admin')
  listPending() {
    return this.movements.listPending();
  }

  /**
   * Cantidad de pendientes (para badge del dashboard).
   */
  @Get('pending/count')
  @Roles('admin')
  async pendingCount() {
    const count = await this.movements.countPending();
    return { count };
  }

  /**
   * Histórico (admin). Query params opcionales:
   *   status=pending|approved|rejected
   *   product_id=uuid
   *   user_id=uuid
   *   limit=number
   */
  @Get()
  @Roles('admin')
  listAll(
    @Query('status') status?: string,
    @Query('product_id') productId?: string,
    @Query('user_id') userId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.movements.listAll({
      status: status as any,
      productId,
      userId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Aprueba una solicitud (admin). El trigger de DB actualiza el stock.
   */
  @Patch(':id/approve')
  @Roles('admin')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = ReviewMovementSchema.parse(body);
    return this.movements.approve(id, user.id, dto.notes);
  }

  /**
   * Rechaza una solicitud (admin).
   */
  @Patch(':id/reject')
  @Roles('admin')
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = ReviewMovementSchema.parse(body);
    return this.movements.reject(id, user.id, dto.notes);
  }
}
