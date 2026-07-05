import { z } from 'zod';
export declare const CreateProductSchema: z.ZodObject<{
    sku: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    cost_price: z.ZodNumber;
    sale_price: z.ZodNumber;
    stock: z.ZodDefault<z.ZodNumber>;
    min_stock: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sku: string;
    name: string;
    cost_price: number;
    sale_price: number;
    stock: number;
    min_stock: number;
    description?: string | undefined;
}, {
    sku: string;
    name: string;
    cost_price: number;
    sale_price: number;
    description?: string | undefined;
    stock?: number | undefined;
    min_stock?: number | undefined;
}>;
export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export declare const UpdateProductSchema: z.ZodObject<{
    sku: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    cost_price: z.ZodOptional<z.ZodNumber>;
    sale_price: z.ZodOptional<z.ZodNumber>;
    stock: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    min_stock: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    sku?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    cost_price?: number | undefined;
    sale_price?: number | undefined;
    stock?: number | undefined;
    min_stock?: number | undefined;
}, {
    sku?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    cost_price?: number | undefined;
    sale_price?: number | undefined;
    stock?: number | undefined;
    min_stock?: number | undefined;
}>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export declare const ProductSearchSchema: z.ZodObject<{
    q: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    q: string;
    limit: number;
}, {
    q: string;
    limit?: number | undefined;
}>;
export type ProductSearchDto = z.infer<typeof ProductSearchSchema>;
//# sourceMappingURL=product.d.ts.map