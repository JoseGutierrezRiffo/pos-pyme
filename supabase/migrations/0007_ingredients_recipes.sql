-- ====================================================================
-- MIGRACIÓN 0007 — Ingredientes y Recetas (Food Truck)
-- 
-- Permite gestionar inventario de materias primas y calcular
-- cuántas porciones de cada producto se pueden hacer.
-- ====================================================================

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 1. INGREDIENTS (Materias Primas)                                   │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.ingredients (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  name            text not null,
  unit            text not null,  -- 'kg', 'lt', 'unidades', 'gramos'
  stock           numeric(12,3) not null default 0,
  min_stock       numeric(12,3) not null default 0,  -- alerta cuando baja
  cost_per_unit   numeric(12,2) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_ingredients_business on public.ingredients(business_id);
create index idx_ingredients_low_stock on public.ingredients(stock) 
  where is_active = true;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2. RECIPES (Recetas por Producto)                              │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.recipes (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  product_id      uuid references public.products(id) on delete cascade,
  name            text not null,  -- nombre de la receta (puede diferir del producto)
  servings        integer not null default 1,  -- porciones que rinde esta receta
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_recipes_business on public.recipes(business_id);
create index idx_recipes_product on public.recipes(product_id);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 3. RECIPE_INGREDIENTS (Ingredientes de una Receta)              │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.recipe_ingredients (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       uuid not null references public.recipes(id) on delete cascade,
  ingredient_id   uuid not null references public.ingredients(id) on delete cascade,
  quantity        numeric(12,3) not null,  -- cantidad necesaria (en la unidad del ingrediente)
  created_at      timestamptz not null default now(),
  unique(recipe_id, ingredient_id)
);

create index idx_recipe_ingredients_recipe on public.recipe_ingredients(recipe_id);
create index idx_recipe_ingredients_ingredient on public.recipe_ingredients(ingredient_id);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 4. FUNCTION: Calcular stock disponible de una receta              │
-- └─────────────────────────────────────────────────────────────────┘
create or replace function public.get_recipe_available_stock(recipe_uuid uuid)
returns numeric language sql stable as $$
  -- Retorna cuántas porciones se pueden hacer con el stock actual
  select 
    coalesce(min(
      i.stock / ri.quantity
    ), 0)::numeric(12,3)
  from recipe_ingredients ri
  join ingredients i on i.id = ri.ingredient_id
  where ri.recipe_id = recipe_uuid
    and i.is_active = true;
$$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 5. VIEW: Productos con stock calculado por recetas              │
-- └─────────────────────────────────────────────────────────────────┘
create or replace view public.products_with_recipe_stock as
select 
  p.id,
  p.business_id,
  p.name,
  p.sku,
  p.sale_price,
  p.cost_price,
  p.is_active,
  -- Stock directo del producto (para productos sin receta)
  p.stock as direct_stock,
  -- Stock calculado por recetas
  coalesce((
    select min(get_recipe_available_stock(r.id))
    from recipes r
    where r.product_id = p.id and r.is_active = true
  ), 0) as recipe_available_stock,
  -- El stock real es el menor entre directo y receta
  least(
    coalesce(p.stock, 999999),
    coalesce((
      select min(get_recipe_available_stock(r.id))
      from recipes r
      where r.product_id = p.id and r.is_active = true
    ), 999999)
  ) as available_stock,
  -- Min stock del producto
  p.min_stock
from products p;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 6. RLS para nuevas tablas                                      │
-- └─────────────────────────────────────────────────────────────────┘
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

-- Ingredients
create policy "ingredients_member_read" on public.ingredients
  for select using (
    business_id in (select get_user_businesses(auth.uid()))
  );

create policy "ingredients_member_write" on public.ingredients
  for all using (
    business_id in (select get_user_businesses(auth.uid()))
  );

-- Recipes
create policy "recipes_member_read" on public.recipes
  for select using (
    business_id in (select get_user_businesses(auth.uid()))
  );

create policy "recipes_member_write" on public.recipes
  for all using (
    business_id in (select get_user_businesses(auth.uid()))
  );

-- Recipe Ingredients
create policy "recipe_ingredients_member_read" on public.recipe_ingredients
  for select using (
    recipe_id in (
      select id from public.recipes 
      where business_id in (select get_user_businesses(auth.uid()))
    )
  );

create policy "recipe_ingredients_member_write" on public.recipe_ingredients
  for all using (
    recipe_id in (
      select id from public.recipes 
      where business_id in (select get_user_businesses(auth.uid()))
    )
  );

-- ====================================================================
-- FIN DE LA MIGRACIÓN
-- ====================================================================
