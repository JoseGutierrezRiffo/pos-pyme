-- Simular stocks bajos para probar el widget
UPDATE public.products SET stock = 2 WHERE sku = 'BEB-002';  -- Sprite: 18 → 2
UPDATE public.products SET stock = 1 WHERE sku = 'SNK-001';  -- Lays: 23 → 1
UPDATE public.products SET stock = 4 WHERE sku = 'CER-001';  -- Corona: 18 → 4

-- Verificar
SELECT sku, name, stock, min_stock,
       CASE WHEN stock < min_stock THEN '⚠️ BAJO' ELSE 'OK' END as status
  FROM products
 WHERE stock < min_stock
 ORDER BY (stock::float / NULLIF(min_stock, 0)) ASC;