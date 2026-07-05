import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { ShiftsService } from './shifts.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OpenShiftDto, CloseShiftDto, CashWithdrawalDto } from '@pos-pyme/validation';
import type { AuthUser } from '../auth/supabase-jwt.service';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  private getBusinessId(request: Request | undefined): string | undefined {
    return request?.headers['x-business-id'] as string | undefined;
  }

  /** Mi turno actual (abierto o en break) */
  @Get('current')
  getCurrent(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.shifts.getCurrentOpenShift(user.id, this.getBusinessId(req));
  }

  @Post('open')
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenShiftDto, @Req() req: Request) {
    return this.shifts.open(user.id, dto, this.getBusinessId(req) ?? '');
  }

  @Post('break/start')
  startBreak(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.shifts.startBreak(user.id, this.getBusinessId(req));
  }

  @Post('break/end')
  endBreak(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.shifts.endBreak(user.id, this.getBusinessId(req));
  }

  @Post('withdrawal')
  withdrawal(@CurrentUser() user: AuthUser, @Body() dto: CashWithdrawalDto, @Req() req: Request) {
    return this.shifts.addWithdrawal(user.id, dto, this.getBusinessId(req));
  }

  @Post('close')
  close(@CurrentUser() user: AuthUser, @Body() dto: CloseShiftDto, @Req() req: Request) {
    return this.shifts.close(user.id, dto, this.getBusinessId(req));
  }

  /** Listado de turnos */
  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string, @Req() req?: Request) {
    return this.shifts.findAll(50, this.getBusinessId(req) ?? '');
  }

  /** Resumen diario para el calendario */
  @Get('daily-summary')
  dailySummary(@Query('from') from?: string, @Query('to') to?: string, @Req() req?: Request) {
    return this.shifts.getDailySummary(from, to, this.getBusinessId(req) ?? '');
  }

  /** Detalle de turnos de un día */
  @Get('by-date/:date')
  byDate(@Param('date') date: string, @Req() req?: Request) {
    return this.shifts.findByDate(date, this.getBusinessId(req) ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.shifts.findById(id);
  }
}
