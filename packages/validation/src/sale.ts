import { z } from 'zod';

export const PaymentMethod = {
  efectivo: 'efectivo',
  tarjeta: 'tarjeta',
  transferencia: 'transferencia',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const SaleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive('Debe ser positivo'), // Permite decimales para productos por peso
});

export const CreateSaleSchema = z
  .object({
    shift_id: z.string().uuid(),
    cash_amount: z.number().nonnegative().default(0),
    card_amount: z.number().nonnegative().default(0),
    transfer_amount: z.number().nonnegative().default(0),
    items: z.array(SaleItemSchema).min(1, 'Mínimo 1 item'),
  })
  .refine((data) => data.cash_amount > 0 || data.card_amount > 0 || data.transfer_amount > 0, {
    message: 'Al menos un método de pago debe tener monto mayor a 0',
  });

export type CreateSaleDto = z.infer<typeof CreateSaleSchema>;
