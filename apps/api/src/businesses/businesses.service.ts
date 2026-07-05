import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../common/supabase.module';
import { CreateBusinessDto, InviteMemberDto } from './businesses.dto';

@Injectable()
export class BusinessesService {
  constructor(@Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient) {}

  /**
   * Obtener todos los negocios de un usuario.
   */
  async findMyBusinesses(userId: string) {
    const { data, error } = await this.admin
      .from('business_members')
      .select(
        `
        role,
        is_active,
        created_at,
        business:businesses!inner(
          id, name, slug, rut, is_active, created_at
        )
      `,
      )
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;

    return (data ?? []).map((m: any) => ({
      membership_id: m.id,
      role: m.role,
      business: m.business,
    }));
  }

  /**
   * Crear un nuevo negocio. El usuario se convierte en owner.
   */
  async create(userId: string, dto: CreateBusinessDto) {
    // Verificar slug único
    const { data: existing } = await this.admin
      .from('businesses')
      .select('id')
      .eq('slug', dto.slug)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('El slug ya está en uso');
    }

    // Crear negocio
    const { data: business, error: bizErr } = await this.admin
      .from('businesses')
      .insert({
        name: dto.name,
        slug: dto.slug,
        rut: dto.rut,
      })
      .select()
      .single();

    if (bizErr) throw bizErr;

    // Agregar al usuario como owner
    const { error: memberErr } = await this.admin.from('business_members').insert({
      business_id: business.id,
      user_id: userId,
      role: 'owner',
    });

    if (memberErr) throw memberErr;

    return business;
  }

  /**
   * Obtener detalle de un negocio (si el usuario tiene acceso).
   */
  async findById(userId: string, businessId: string) {
    // Verificar acceso
    const { data: member } = await this.admin
      .from('business_members')
      .select('role')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    if (!member) {
      throw new NotFoundException('Negocio no encontrado o sin acceso');
    }

    const { data: business, error } = await this.admin
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error || !business) {
      throw new NotFoundException('Negocio no encontrado');
    }

    return { ...business, my_role: member.role };
  }

  /**
   * Listar miembros de un negocio (solo owners/admins).
   */
  async getMembers(userId: string, businessId: string) {
    // Verificar que es owner o admin
    await this.verifyManageAccess(userId, businessId);

    const { data, error } = await this.admin
      .from('business_members')
      .select(
        `
        id,
        role,
        is_active,
        created_at,
        user:profiles!business_members_user_id_fkey(
          id, email, full_name, is_active
        )
      `,
      )
      .eq('business_id', businessId)
      .order('created_at');

    if (error) throw error;
    return data;
  }

  /**
   * Invitar a un usuario a un negocio.
   */
  async inviteMember(userId: string, businessId: string, dto: InviteMemberDto) {
    // Verificar que es owner o admin
    await this.verifyManageAccess(userId, businessId);

    // Buscar usuario por email
    const { data: profile, error: profileErr } = await this.admin
      .from('profiles')
      .select('id, email')
      .eq('email', dto.email)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new NotFoundException('Usuario no encontrado. Debe registrarse primero.');
    }

    // Verificar que no sea ya miembro
    const { data: existing } = await this.admin
      .from('business_members')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('El usuario ya es miembro de este negocio');
    }

    // Crear membership
    const { data, error } = await this.admin
      .from('business_members')
      .insert({
        business_id: businessId,
        user_id: profile.id,
        role: dto.role,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Cambiar rol de un miembro.
   */
  async updateMemberRole(userId: string, businessId: string, memberId: string, role: string) {
    await this.verifyManageAccess(userId, businessId);

    const { data, error } = await this.admin
      .from('business_members')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Miembro no encontrado');
    }

    return data;
  }

  /**
   * Eliminar miembro de un negocio.
   */
  async removeMember(userId: string, businessId: string, memberId: string) {
    await this.verifyManageAccess(userId, businessId);

    // No permitir eliminar al último owner
    const { data: memberToRemove } = await this.admin
      .from('business_members')
      .select('role')
      .eq('id', memberId)
      .eq('business_id', businessId)
      .single();

    if (memberToRemove?.role === 'owner') {
      const { data: owners } = await this.admin
        .from('business_members')
        .select('id')
        .eq('business_id', businessId)
        .eq('role', 'owner')
        .eq('is_active', true);

      if ((owners ?? []).length <= 1) {
        throw new BadRequestException('No se puede eliminar al último owner del negocio');
      }
    }

    const { error } = await this.admin
      .from('business_members')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('business_id', businessId);

    if (error) throw error;
    return { success: true };
  }

  /**
   * Verificar que el usuario tiene permisos de owner/admin.
   */
  private async verifyManageAccess(userId: string, businessId: string) {
    const { data: member } = await this.admin
      .from('business_members')
      .select('role')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new NotFoundException('No tienes permisos para gestionar este negocio');
    }
  }
}
