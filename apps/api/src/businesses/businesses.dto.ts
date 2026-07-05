import { z } from 'zod';

export const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  rut: z.string().optional(),
});

export type CreateBusinessDto = z.infer<typeof CreateBusinessSchema>;

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'worker']),
});

export type InviteMemberDto = z.infer<typeof InviteMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'worker']),
});

export type UpdateMemberRoleDto = z.infer<typeof UpdateMemberRoleSchema>;
