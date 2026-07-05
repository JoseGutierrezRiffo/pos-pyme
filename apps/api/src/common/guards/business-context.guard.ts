import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase.module';

@Injectable()
export class BusinessContextGuard implements CanActivate {
  constructor(@Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const businessId = request.headers['x-business-id'] as string | undefined;

    if (!businessId) {
      // Si no hay header, permitir pero el servicio filtrará por membership
      request.businessId = undefined;
      return true;
    }

    // Validar que el usuario tiene acceso a este negocio
    const { data, error } = await this.admin
      .from('business_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      throw new ForbiddenException('No tienes acceso a este negocio');
    }

    // Validar que el negocio está activo
    const { data: business, error: bizErr } = await this.admin
      .from('businesses')
      .select('is_active')
      .eq('id', businessId)
      .maybeSingle();

    if (bizErr || !business) {
      throw new ForbiddenException('Negocio no encontrado');
    }

    if (!business.is_active) {
      throw new ForbiddenException('Este negocio está suspendido. Contacta al administrador.');
    }

    // Adjuntar business info al request
    request.businessId = businessId;
    request.businessRole = data.role;

    return true;
  }
}
