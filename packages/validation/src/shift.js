import { z } from 'zod';
/** Apertura de turno */
export const OpenShiftSchema = z.object({
    cash_initial: z.number().positive('Debe ser mayor a 0').multipleOf(0.01),
});
/** Cierre de turno (a ciegas: el worker NO debe enviar cash_declared) */
export const CloseShiftSchema = z.object({
    cash_declared: z.number().nonnegative('No puede ser negativo').multipleOf(0.01),
    notes: z.string().max(500).optional(),
});
/** Retiro parcial de efectivo */
export const CashWithdrawalSchema = z.object({
    amount: z.number().positive('Debe ser mayor a 0'),
    reason: z.enum(['compra_insumos', 'gasto_operativo', 'pago_proveedor', 'otro']),
    note: z.string().max(200).optional(),
});
//# sourceMappingURL=shift.js.map