import { z } from 'zod';
export const LoginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
});
//# sourceMappingURL=auth.js.map