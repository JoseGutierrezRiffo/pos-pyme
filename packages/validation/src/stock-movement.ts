import { z } from 'zod';

/** Solicitud de movimiento de stock */
export const CreateStockMovementSchema = z.object({
  product_id: z.string().uuid('Producto inválido'),
  shift_id: z.string().uuid().optional(),
  type: z.enum(['in', 'out'], {
    errorMap: () => ({ message: 'Tipo debe ser "in" (entrada) o "out" (salida)' }),
  }),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
  reason: z.string().min(3, 'Motivo muy corto').max(500, 'Motivo muy largo'),
  photo_url: z.string().url().optional(),
});
export type CreateStockMovementDto = z.infer<typeof CreateStockMovementSchema>;

/** Aprobación o rechazo (opcional: nota del admin) */
export const ReviewMovementSchema = z.object({
  notes: z.string().max(500).optional(),
});
export type ReviewMovementDto = z.infer<typeof ReviewMovementSchema>;
