import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateBusinessDto, InviteMemberDto, UpdateMemberRoleDto } from './businesses.dto';
import type { AuthUser } from '../auth/supabase-jwt.service';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  /** Mis negocios */
  @Get()
  getMyBusinesses(@CurrentUser() user: AuthUser) {
    return this.businesses.findMyBusinesses(user.id);
  }

  /** Crear negocio */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBusinessDto) {
    return this.businesses.create(user.id, dto);
  }

  /** Detalle de un negocio */
  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.businesses.findById(user.id, id);
  }

  /** Miembros de un negocio */
  @Get(':id/members')
  getMembers(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.businesses.getMembers(user.id, id);
  }

  /** Invitar miembro */
  @Post(':id/members')
  inviteMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.businesses.inviteMember(user.id, id, dto);
  }

  /** Cambiar rol de miembro */
  @Patch(':id/members/:memberId')
  updateMemberRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.businesses.updateMemberRole(user.id, id, memberId, dto.role);
  }

  /** Eliminar miembro */
  @Delete(':id/members/:memberId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.businesses.removeMember(user.id, id, memberId);
  }
}
