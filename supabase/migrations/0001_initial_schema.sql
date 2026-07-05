-- ====================================================================
-- MIGRACIÓN 0001 — Initial Schema
-- MVP: Inventario + Turnos + POS Móvil para Micro-PYMEs
-- ====================================================================
-- CÓMO APLICAR:
--   1. Ir a https://supabase.com/dashboard → tu proyecto
--   2. SQL Editor → New Query
--   3. Pegar TODO este archivo
--   4. Run (Cmd+Enter)
--   5. Verificar: ver queries al final del archivo
-- ====================================================================
-- IDEMPOTENTE: se puede correr múltiples veces sin romper.
-- ====================================================================

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 0. EXTENSIONES                                                   │
-- └─────────────────────────────────────────────────────────────────┘
create extension if not exists "pgcrypto";

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 1. ENUMS                                                          │
-- └─────────────────────────────────────────────────────────────────┘
do $$ begin
  create type user_role as enum ('admin', 'worker');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shift_status as enum ('abierto', 'en_colacion', 'cerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('efectivo', 'transferencia', 'tarjeta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type withdrawal_reason as enum (
    'compra_insumos', 'gasto_operativo', 'pago_proveedor', 'otro'
  );
exception when duplicate_object then null; end $$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2. LIMPIEZA (DROP en orden inverso, idempotente)                 │
-- └─────────────────────────────────────────────────────────────────┘
drop view if exists public.products_public;
drop table if exists public.notifications cascade;
drop table if exists public.cash_withdrawals cascade;
drop table if exists public.sale_items cascade;
drop table if exists public.sales cascade;
drop table if exists public.shifts cascade;
drop table if exists public.products cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.process_sale_item() cascade;
drop function if exists public.check_low_stock() cascade;
drop function if exists public.notify_shift_closed() cascade;
drop function if exists public.current_user_role() cascade;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 3. PROFILES (extiende auth.users)                                 │
-- └─────────────────────────────────────────────────────────────────┘
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  role        user_role not null default 'worker',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'worker')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 4. PRODUCTS / INVENTARIO                                          │
-- └─────────────────────────────────────────────────────────────────┘
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  sku          text not null unique,
  name         text not null,
  description  text,
  cost_price   numeric(12,2) not null check (cost_price >= 0),
  sale_price   numeric(12,2) not null check (sale_price >= 0),
  stock        integer not null default 0 check (stock >= 0),
  min_stock    integer not null default 3 check (min_stock >= 0),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_products_sku on public.products(sku);
create index idx_products_low_stock on public.products(stock) where is_active = true;

-- Vista pública SIN cost_price (para workers)
create view public.products_public as
  select id, sku, name, description, sale_price, stock, min_stock, is_active, created_at, updated_at
    from public.products;

grant select on public.products_public to authenticated;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 5. SHIFTS (Turnos)                                                │
-- └─────────────────────────────────────────────────────────────────┘
create table public.shifts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete restrict,
  shift_date         date not null default current_date,
  status             shift_status not null default 'abierto',
  started_at         timestamptz not null default now(),
  initial_cash       numeric(12,2) not null check (initial_cash >= 0),
  break_started_at   timestamptz,
  break_ended_at     timestamptz,
  ended_at           timestamptz,
  final_cash         numeric(12,2) check (final_cash >= 0),
  expected_cash      numeric(12,2),
  discrepancy        numeric(12,2),
  total_sales        numeric(12,2) not null default 0,
  total_withdrawals  numeric(12,2) not null default 0,
  total_cash_sales   numeric(12,2) not null default 0,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint unique_open_shift_per_user
    exclude using btree (user_id with =)
    where (status in ('abierto', 'en_colacion'))
);

create index idx_shifts_user_date on public.shifts(user_id, shift_date desc);
create index idx_shifts_status on public.shifts(status);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 6. SALES (Ventas)                                                 │
-- └─────────────────────────────────────────────────────────────────┘
create table public.sales (
  id              uuid primary key default gen_random_uuid(),
  shift_id        uuid not null references public.shifts(id) on delete restrict,
  user_id         uuid not null references public.profiles(id),
  payment_method  payment_method not null default 'efectivo',
  subtotal        numeric(12,2) not null check (subtotal >= 0),
  total           numeric(12,2) not null check (total >= 0),
  items_count     integer not null default 0,
  created_at      timestamptz not null default now()
);

create index idx_sales_shift on public.sales(shift_id, created_at desc);
create index idx_sales_user_date on public.sales(user_id, created_at desc);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 7. SALE_ITEMS (líneas de venta)                                  │
-- └─────────────────────────────────────────────────────────────────┘
create table public.sale_items (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete restrict,
  product_name  text not null,         -- snapshot
  quantity      integer not null check (quantity > 0),
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  unit_cost     numeric(12,2) not null check (unit_cost >= 0),  -- snapshot
  subtotal      numeric(12,2) not null check (subtotal >= 0)
);

create index idx_sale_items_sale on public.sale_items(sale_id);
create index idx_sale_items_product on public.sale_items(product_id);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 8. CASH_WITHDRAWALS (Retiros parciales)                          │
-- └─────────────────────────────────────────────────────────────────┘
create table public.cash_withdrawals (
  id          uuid primary key default gen_random_uuid(),
  shift_id    uuid not null references public.shifts(id) on delete restrict,
  user_id     uuid not null references public.profiles(id),
  amount      numeric(12,2) not null check (amount > 0),
  reason      withdrawal_reason not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index idx_withdrawals_shift on public.cash_withdrawals(shift_id);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 9. NOTIFICATIONS (alertas para admin)                             │
-- └─────────────────────────────────────────────────────────────────┘
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,  -- 'shift_closed' | 'low_stock' | 'cash_discrepancy'
  title       text not null,
  message     text not null,
  payload     jsonb not null default '{}'::jsonb,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_notifications_user_unread
  on public.notifications(user_id, created_at desc)
  where is_read = false;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 10. HELPER FUNCTIONS                                              │
-- └─────────────────────────────────────────────────────────────────┘
create or replace function public.current_user_role()
returns user_role language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 11. TRIGGERS DE NEGOCIO                                           │
-- └─────────────────────────────────────────────────────────────────┘

-- 11.1 Descontar stock al vender (atómico)
create or replace function public.process_sale_item()
returns trigger language plpgsql security definer as $$
begin
  update public.products
     set stock = stock - new.quantity,
         updated_at = now()
   where id = new.product_id
     and stock >= new.quantity;

  if not found then
    raise exception 'Stock insuficiente para producto %', new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_process_sale_item on public.sale_items;
create trigger trg_process_sale_item
  before insert on public.sale_items
  for each row execute function public.process_sale_item();

-- 11.2 Alerta de stock bajo → notifica admins
create or replace function public.check_low_stock()
returns trigger language plpgsql security definer as $$
begin
  if new.stock < new.min_stock and new.is_active = true then
    insert into public.notifications (user_id, type, title, message, payload)
    select p.id,
           'low_stock',
           '⚠️ Stock bajo: ' || new.name,
           format('Quedan %s unidades (mínimo: %s)', new.stock, new.min_stock),
           jsonb_build_object('product_id', new.id, 'stock', new.stock, 'min_stock', new.min_stock)
      from public.profiles p
     where p.role = 'admin' and p.is_active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_low_stock on public.products;
create trigger trg_check_low_stock
  after update of stock on public.products
  for each row execute function public.check_low_stock();

-- 11.3 Al cerrar shift → notificar admin con reporte
create or replace function public.notify_shift_closed()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'cerrado' and (old.status is null or old.status <> 'cerrado') then
    insert into public.notifications (user_id, type, title, message, payload)
    select p.id,
           'shift_closed',
           '💰 Cierre de caja #' || substr(new.id::text, 1, 8),
           format('Ventas: $%s | Esperado: $%s | Declarado: $%s | Descuadre: $%s',
                  new.total_sales, new.expected_cash, new.final_cash, new.discrepancy),
           jsonb_build_object(
             'shift_id', new.id, 'worker_id', new.user_id,
             'total_sales', new.total_sales, 'expected_cash', new.expected_cash,
             'final_cash', new.final_cash, 'discrepancy', new.discrepancy
           )
      from public.profiles p
     where p.role = 'admin' and p.is_active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_shift_closed on public.shifts;
create trigger trg_notify_shift_closed
  after update on public.shifts
  for each row execute function public.notify_shift_closed();

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 12. ROW LEVEL SECURITY                                            │
-- └─────────────────────────────────────────────────────────────────┘
alter table public.profiles         enable row level security;
alter table public.products         enable row level security;
alter table public.shifts           enable row level security;
alter table public.sales            enable row level security;
alter table public.sale_items       enable row level security;
alter table public.cash_withdrawals enable row level security;
alter table public.notifications    enable row level security;

-- PROFILES
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select using (id = auth.uid());
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.current_user_role() = 'admin');

-- PRODUCTS (worker ve la vista products_public sin cost_price)
drop policy if exists "products_worker_read" on public.products;
create policy "products_worker_read" on public.products
  for select using (auth.role() = 'authenticated');
drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all using (public.current_user_role() = 'admin');

-- SHIFTS
drop policy if exists "shifts_worker_own" on public.shifts;
create policy "shifts_worker_own" on public.shifts
  for all using (user_id = auth.uid());
drop policy if exists "shifts_admin_all" on public.shifts;
create policy "shifts_admin_all" on public.shifts
  for all using (public.current_user_role() = 'admin');

-- SALES
drop policy if exists "sales_worker_own" on public.sales;
create policy "sales_worker_own" on public.sales
  for all using (user_id = auth.uid());
drop policy if exists "sales_admin_all" on public.sales;
create policy "sales_admin_all" on public.sales
  for all using (public.current_user_role() = 'admin');

-- SALE_ITEMS
drop policy if exists "sale_items_worker_own" on public.sale_items;
create policy "sale_items_worker_own" on public.sale_items
  for all using (
    exists (select 1 from public.sales s
             where s.id = sale_items.sale_id and s.user_id = auth.uid())
  );
drop policy if exists "sale_items_admin_all" on public.sale_items;
create policy "sale_items_admin_all" on public.sale_items
  for all using (public.current_user_role() = 'admin');

-- CASH_WITHDRAWALS
drop policy if exists "withdrawals_worker_own" on public.cash_withdrawals;
create policy "withdrawals_worker_own" on public.cash_withdrawals
  for all using (user_id = auth.uid());
drop policy if exists "withdrawals_admin_all" on public.cash_withdrawals;
create policy "withdrawals_admin_all" on public.cash_withdrawals
  for all using (public.current_user_role() = 'admin');

-- NOTIFICATIONS
drop policy if exists "notifications_self_read" on public.notifications;
create policy "notifications_self_read" on public.notifications
  for select using (user_id = auth.uid());
drop policy if exists "notifications_self_update" on public.notifications;
create policy "notifications_self_update" on public.notifications
  for update using (user_id = auth.uid());

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 13. DATOS SEED (descomentar si querés usuarios/productos demo)    │
-- └─────────────────────────────────────────────────────────────────┘
-- Para crear el primer admin, hacelo desde el dashboard de Supabase:
--   Authentication → Users → Add user → email/password
-- Después insertá manualmente el perfil con role='admin':
--
-- insert into public.profiles (id, email, full_name, role)
-- values ('UUID_DEL_USUARIO', 'admin@demo.com', 'Doña Rosa', 'admin');
--
-- Productos demo:
-- insert into public.products (sku, name, cost_price, sale_price, stock, min_stock) values
--   ('BEB-001', 'Coca-Cola 1.5L', 1200, 2200, 24, 5),
--   ('BEB-002', 'Sprite 1.5L',    1100, 2000, 18, 5),
--   ('SNK-001', 'Papas Lays',      500, 1200, 30, 6);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 14. QUERIES DE VERIFICACIÓN (descomentar para correr después)     │
-- └─────────────────────────────────────────────────────────────────┘
-- select table_name from information_schema.tables
--  where table_schema = 'public' order by table_name;
--
-- select tgname from pg_trigger where not tgisinternal order by tgname;
--
-- select tablename, rowsecurity from pg_tables
--  where schemaname = 'public' and rowsecurity = true;
--
-- select conname from pg_constraint where conname = 'unique_open_shift_per_user';

-- ====================================================================
-- FIN DE LA MIGRACIÓN
-- ====================================================================
