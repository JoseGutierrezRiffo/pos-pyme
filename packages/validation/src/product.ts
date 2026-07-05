import { z } from 'zod';

export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  cost_price: z.number().nonnegative(),
  sale_price: z.number().positive(),
  stock: z.number().int().nonnegative().default(0),
  min_stock: z.number().int().nonnegative().default(3),
});
export type CreateProductDto = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial();
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;

export const ProductSearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
export type ProductSearchDto = z.infer<typeof ProductSearchSchema>;
