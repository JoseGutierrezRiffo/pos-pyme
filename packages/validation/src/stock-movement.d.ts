import { z } from 'zod';
/** Solicitud de movimiento de stock */
export declare const CreateStockMovementSchema: z.ZodObject<{
    product_id: z.ZodString;
    shift_id: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["in", "out"]>;
    quantity: z.ZodNumber;
    reason: z.ZodString;
    photo_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "in" | "out";
    reason: string;
    product_id: string;
    quantity: number;
    shift_id?: string | undefined;
    photo_url?: string | undefined;
}, {
    type: "in" | "out";
    reason: string;
    product_id: string;
    quantity: number;
    shift_id?: string | undefined;
    photo_url?: string | undefined;
}>;
export type CreateStockMovementDto = z.infer<typeof CreateStockMovementSchema>;
/** Aprobación o rechazo (opcional: nota del admin) */
export declare const ReviewMovementSchema: z.ZodObject<{
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
}, {
    notes?: string | undefined;
}>;
export type ReviewMovementDto = z.infer<typeof ReviewMovementSchema>;
//# sourceMappingURL=stock-movement.d.ts.map