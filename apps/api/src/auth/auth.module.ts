import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SupabaseJwtService } from './supabase-jwt.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [SupabaseJwtService, JwtAuthGuard, RolesGuard],
  exports: [SupabaseJwtService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
