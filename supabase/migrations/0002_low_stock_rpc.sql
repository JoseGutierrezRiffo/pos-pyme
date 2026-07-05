-- Función RPC para obtener productos con stock bajo
-- Ordenados por criticidad (menor stock relativo al mínimo)
create or replace function public.get_low_stock_products()
returns table (
  id uuid,
  sku text,
  name text,
  stock integer,
  min_stock integer,
  sale_price numeric,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id, p.sku, p.name, p.stock, p.min_stock, p.sale_price, p.updated_at
  from public.products p
  where p.is_active = true
    and p.stock < p.min_stock
  order by
    (p.stock::float / nullif(p.min_stock, 0)) asc,
    p.stock asc,
    p.name asc;
$$;

-- Dar permiso a usuarios autenticados
grant execute on function public.get_low_stock_products() to authenticated;