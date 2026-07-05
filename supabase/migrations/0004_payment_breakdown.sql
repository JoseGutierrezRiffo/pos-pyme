-- Agregar desglose por método de pago a la tabla shifts
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS total_card_sales numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_transfer_sales numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.shifts.total_card_sales IS 'Ventas cobradas con tarjeta en este turno';
COMMENT ON COLUMN public.shifts.total_transfer_sales IS 'Ventas cobradas por transferencia en este turno';