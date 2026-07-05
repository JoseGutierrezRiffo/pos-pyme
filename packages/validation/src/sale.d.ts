import { z } from 'zod';
export declare const PaymentMethod: {
    readonly efectivo: "efectivo";
    readonly tarjeta: "tarjeta";
    readonly transferencia: "transferencia";
};
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
export declare const SaleItemSchema: z.ZodObject<{
    product_id: z.ZodString;
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    product_id: string;
    quantity: number;
}, {
    product_id: string;
    quantity: number;
}>;
export declare const CreateSaleSchema: z.ZodEffects<z.ZodObject<{
    shift_id: z.ZodString;
    cash_amount: z.ZodDefault<z.ZodNumber>;
    card_amount: z.ZodDefault<z.ZodNumber>;
    transfer_amount: z.ZodDefault<z.ZodNumber>;
    items: z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        product_id: string;
        quantity: number;
    }, {
        product_id: string;
        quantity: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    shift_id: string;
    cash_amount: number;
    card_amount: number;
    transfer_amount: number;
    items: {
        product_id: string;
        quantity: number;
    }[];
}, {
    shift_id: string;
    items: {
        product_id: string;
        quantity: number;
    }[];
    cash_amount?: number | undefined;
    card_amount?: number | undefined;
    transfer_amount?: number | undefined;
}>, {
    shift_id: string;
    cash_amount: number;
    card_amount: number;
    transfer_amount: number;
    items: {
        product_id: string;
        quantity: number;
    }[];
}, {
    shift_id: string;
    items: {
        product_id: string;
        quantity: number;
    }[];
    cash_amount?: number | undefined;
    card_amount?: number | undefined;
    transfer_amount?: number | undefined;
}>;
export type CreateSaleDto = z.infer<typeof CreateSaleSchema>;
//# sourceMappingURL=sale.d.ts.map