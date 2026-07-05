import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../supabase-jwt.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
