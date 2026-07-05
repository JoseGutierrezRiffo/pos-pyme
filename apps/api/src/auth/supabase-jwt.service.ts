import { Injectable, UnauthorizedException, Logger, Inject } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../common/supabase.module';

export type UserRole = 'admin' | 'worker';

export interface SupabaseJwtPayload extends JWTPayload {
  sub: string;
  email: string;
  role: string;
  aud: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
}

@Injectable()
export class SupabaseJwtService {
  private readonly logger = new Logger(SupabaseJwtService.name);
  private readonly admin: SupabaseClient;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(SUPABASE_ADMIN) admin: SupabaseClient) {
    this.admin = admin;
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL no está definido');
    }
    this.jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }

  async verifyToken(token: string): Promise<SupabaseJwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        audience: 'authenticated',
      });
      return payload as SupabaseJwtPayload;
    } catch (err) {
      this.logger.warn(`JWT inválido: ${(err as Error).message}`);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  async getUserRole(userId: string): Promise<UserRole> {
    const { data, error } = await this.admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new UnauthorizedException('Perfil no encontrado');
    }
    if (!data.is_active) {
      throw new UnauthorizedException('Usuario deshabilitado');
    }
    return data.role as UserRole;
  }

  async getProfile(userId: string) {
    const { data, error } = await this.admin
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new UnauthorizedException('Perfil no encontrado');
    }
    if (!data.is_active) {
      throw new UnauthorizedException('Usuario deshabilitado');
    }
    return data;
  }

  async authenticate(token: string): Promise<AuthUser> {
    const payload = await this.verifyToken(token);
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Token sin datos de usuario');
    }
    const profile = await this.getProfile(payload.sub);
    return {
      id: profile.id,
      email: profile.email,
      role: profile.role as UserRole,
      full_name: profile.full_name,
    };
  }

  /**
   * Actualiza el nombre del usuario actual.
   */
  async updateProfile(userId: string, dto: { full_name?: string }) {
    const updates: Record<string, any> = {};
    if (dto.full_name !== undefined) {
      const trimmed = dto.full_name.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        throw new UnauthorizedException('Nombre inválido (2-100 caracteres)');
      }
      updates.full_name = trimmed;
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await this.admin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, email, full_name, role')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Obtiene los memberships de un usuario (negocios a los que pertenece).
   */
  async getMemberships(userId: string) {
    const { data, error } = await this.admin
      .from('business_members')
      .select(
        `
        id,
        role,
        is_active,
        created_at,
        business:businesses!inner(
          id, name, slug, is_active, created_at
        )
      `,
      )
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;

    return (data ?? []).map((m: any) => ({
      membership_id: m.id,
      role: m.role,
      is_active: m.is_active,
      joined_at: m.created_at,
      business: {
        id: m.business.id,
        name: m.business.name,
        slug: m.business.slug,
        is_active: m.business.is_active,
        created_at: m.business.created_at,
      },
    }));
  }
}
