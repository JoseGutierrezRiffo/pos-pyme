-- Seed: productos demo para el MVP
INSERT INTO products (sku, name, cost_price, sale_price, stock, min_stock) VALUES
  ('BEB-001', 'Coca-Cola 1.5L',     1200, 2200, 24, 5),
  ('BEB-002', 'Sprite 1.5L',        1100, 2000, 18, 5),
  ('BEB-003', 'Agua Mineral 1L',     400, 1000, 36, 8),
  ('SNK-001', 'Papas Lays 200g',     500, 1200, 30, 6),
  ('SNK-002', 'Doritos 200g',        600, 1400, 25, 5),
  ('DUL-001', 'Chocolate Sahne-Nuss', 800, 1800, 20, 4),
  ('GOL-001', 'Galletas Oreo',       450, 1100, 40, 8),
  ('CER-001', 'Cerveza Corona 355cc', 900, 1900, 48, 12);

-- Verificar
SELECT sku, name, sale_price, stock, min_stock,
       ROUND((sale_price - cost_price)::numeric / sale_price * 100, 1) as margen_pct
  FROM products
 ORDER BY sku;