-- Limpieza de datos transaccionales para test E2E
-- Mantenemos: auth.users, profiles, products

-- 1. Notificaciones
DELETE FROM public.notifications;

-- 2. Retiros de caja (cash_withdrawals FK a shifts)
DELETE FROM public.cash_withdrawals;

-- 3. Items de venta (sale_items FK a sales)
DELETE FROM public.sale_items;

-- 4. Ventas (sales FK a shifts)
DELETE FROM public.sales;

-- 5. Turnos (shifts)
DELETE FROM public.shifts;

-- Verificación final: solo deben quedar profiles y products
SELECT 'products' as tabla, COUNT(*)::text as registros FROM public.products
UNION ALL
SELECT 'profiles', COUNT(*)::text FROM public.profiles
UNION ALL
SELECT 'shifts', COUNT(*)::text FROM public.shifts
UNION ALL
SELECT 'sales', COUNT(*)::text FROM public.sales
UNION ALL
SELECT 'sale_items', COUNT(*)::text FROM public.sale_items
UNION ALL
SELECT 'cash_withdrawals', COUNT(*)::text FROM public.cash_withdrawals
UNION ALL
SELECT 'notifications', COUNT(*)::text FROM public.notifications;