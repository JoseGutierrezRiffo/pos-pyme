import { z } from 'zod';
/** Apertura de turno */
export declare const OpenShiftSchema: z.ZodObject<{
    cash_initial: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    cash_initial: number;
}, {
    cash_initial: number;
}>;
export type OpenShiftDto = z.infer<typeof OpenShiftSchema>;
/** Cierre de turno (a ciegas: el worker NO debe enviar cash_declared) */
export declare const CloseShiftSchema: z.ZodObject<{
    cash_declared: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cash_declared: number;
    notes?: string | undefined;
}, {
    cash_declared: number;
    notes?: string | undefined;
}>;
export type CloseShiftDto = z.infer<typeof CloseShiftSchema>;
/** Retiro parcial de efectivo */
export declare const CashWithdrawalSchema: z.ZodObject<{
    amount: z.ZodNumber;
    reason: z.ZodEnum<["compra_insumos", "gasto_operativo", "pago_proveedor", "otro"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    reason: "compra_insumos" | "gasto_operativo" | "pago_proveedor" | "otro";
    note?: string | undefined;
}, {
    amount: number;
    reason: "compra_insumos" | "gasto_operativo" | "pago_proveedor" | "otro";
    note?: string | undefined;
}>;
export type CashWithdrawalDto = z.infer<typeof CashWithdrawalSchema>;
//# sourceMappingURL=shift.d.ts.map