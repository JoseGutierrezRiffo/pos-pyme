import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { SupabaseJwtService, AuthUser } from './supabase-jwt.service';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
});
type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

@Controller('auth')
export class AuthController {
  constructor(private readonly jwt: SupabaseJwtService) {}

  /** Devuelve los datos del usuario actual + sus negocios */
  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    // Traemos perfil fresco de la DB para tener el nombre actualizado
    const profile = await this.jwt.getProfile(user.id);

    // Obtenemos los memberships (negocios del usuario)
    const memberships = await this.jwt.getMemberships(user.id);

    return {
      ...profile,
      memberships,
    };
  }

  /** Actualiza el perfil del usuario actual */
  @Patch('me')
  async updateMe(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = UpdateProfileSchema.parse(body);
    return this.jwt.updateProfile(user.id, dto);
  }
}
