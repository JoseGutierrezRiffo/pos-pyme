import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSaleDto } from '@pos-pyme/validation';
import type { AuthUser } from '../auth/supabase-jwt.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  @Roles('admin', 'worker')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.sales.create(user.id, dto);
  }

  @Get('by-shift/:shiftId')
  @Roles('admin', 'worker')
  byShift(@Param('shiftId') shiftId: string) {
    return this.sales.findByShift(shiftId);
  }
}
