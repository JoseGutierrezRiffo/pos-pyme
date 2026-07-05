-- ====================================================================
-- MIGRACIÓN 0006 — Multi-Tenant v2 + Modelo de Negocio Actualizado
-- 
-- Cambios:
-- 1. Tablas businesses y business_members
-- 2. Renombrar columnas de shifts (cash_*)
-- 3. Nueva estructura de sales (cash/card/transfer amounts)
-- 4. Renombrar sale_items.unit_* → price_at_sale/cost_at_sale
-- 5. Agregar business_id a products, shifts, sales
-- 6. Actualizar triggers y RLS
-- ====================================================================

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 1. ENUMS                                                          │
-- └─────────────────────────────────────────────────────────────────┘
do $$ begin
  create type membership_role as enum ('owner', 'admin', 'worker');
exception when duplicate_object then null; end $$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2. BUSINESSES                                                     │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.businesses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  rut           text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_businesses_slug on public.businesses(slug);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 3. BUSINESS_MEMBERS                                               │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.business_members (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            membership_role not null default 'worker',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(business_id, user_id)
);

create index idx_business_members_user on public.business_members(user_id);
create index idx_business_members_business on public.business_members(business_id);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 4. HELPER FUNCTIONS                                               │
-- └─────────────────────────────────────────────────────────────────┘
create or replace function public.get_user_businesses(user_uuid uuid)
returns setof uuid language sql stable security definer as $$
  select business_id from public.business_members
   where user_id = user_uuid and is_active = true;
$$;

create or replace function public.get_user_role_in_business(user_uuid uuid, business_uuid uuid)
returns membership_role language sql stable security definer as $$
  select role from public.business_members
   where user_id = user_uuid and business_id = business_uuid and is_active = true;
$$;

create or replace function public.user_has_business_access(user_uuid uuid, business_uuid uuid)
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from public.business_members
     where user_id = user_uuid
       and business_id = business_uuid
       and is_active = true
  );
$$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 5. AGREGAR business_id A TABLAS EXISTENTES                        │
-- └─────────────────────────────────────────────────────────────────┘

-- Products
alter table public.products 
  add column if not exists business_id uuid references public.businesses(id) on delete set null,
  add column if not exists is_global boolean not null default false;

-- Shifts (agregar business_id)
alter table public.shifts 
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

-- Sales (agregar business_id)
alter table public.sales 
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 6. RENOMBRAR COLUMNAS DE SHIFTS                                  │
-- └─────────────────────────────────────────────────────────────────┘

-- Renombrar columnas (solo si existen las old names)
do $$ 
begin
  -- shifts
  alter table public.shifts rename column initial_cash to cash_initial if exists;
  alter table public.shifts rename column total_withdrawals to cash_withdrawals if exists;
  alter table public.shifts rename column final_cash to cash_declared if exists;
  alter table public.shifts rename column expected_cash to cash_expected if exists;
  alter table public.shifts rename column started_at to opened_at if exists;
  alter table public.shifts rename column ended_at to closed_at if exists;
  
  -- sale_items
  alter table public.sale_items rename column unit_price to price_at_sale if exists;
  alter table public.sale_items rename column unit_cost to cost_at_sale if exists;
  
  -- sale_items rename subtotal → line_total para claridad
  alter table public.sale_items rename column subtotal to line_total if exists;
  
  -- shifts rename
  alter table public.shifts rename column status to shift_status if exists;
  
exception when undefined_column then null;
end $$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 7. NUEVA ESTRUCTURA DE SALES (pagos por método)                  │
-- └─────────────────────────────────────────────────────────────────┘

-- Agregar columnas de montos por método si no existen
alter table public.sales
  add column if not exists cash_amount numeric(12,2) not null default 0,
  add column if not exists card_amount numeric(12,2) not null default 0,
  add column if not exists transfer_amount numeric(12,2) not null default 0;

-- Migrar datos existentes de payment_method a los nuevos campos
do $$
declare
  sale_record record;
begin
  for sale_record in select id, payment_method, total from public.sales where cash_amount = 0 loop
    if sale_record.payment_method = 'efectivo' then
      update public.sales set cash_amount = sale_record.total where id = sale_record.id;
    elsif sale_record.payment_method = 'tarjeta' then
      update public.sales set card_amount = sale_record.total where id = sale_record.id;
    elsif sale_record.payment_method = 'transferencia' then
      update public.sales set transfer_amount = sale_record.total where id = sale_record.id;
    end if;
  end loop;
end;
$$;

-- Eliminar columna vieja si ya migramos los datos
alter table public.sales drop column if exists payment_method;
alter table public.sales drop column if exists subtotal;

-- Actualizar sale_items
alter table public.sale_items 
  drop column if exists product_name,
  drop column if exists subtotal;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 8. ACTUALIZAR VALORES DE STATUS (español → inglés)               │
-- └─────────────────────────────────────────────────────────────────┘

update public.shifts set shift_status = 'open' where shift_status = 'abierto';
update public.shifts set shift_status = 'break' where shift_status = 'en_colacion';
-- 'cerrado' se mantiene igual

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 9. CREAR NEGOCIO PRINCIPAL Y MIGRAR DATOS                        │
-- └─────────────────────────────────────────────────────────────────┘

-- Crear negocio principal
insert into public.businesses (id, name, slug, is_active)
values ('00000000-0000-0000-0000-000000000001', 'Negocio Principal', 'negocio-principal', true)
on conflict (id) do nothing;

-- Migrar productos existentes
update public.products 
set business_id = '00000000-0000-0000-0000-000000000001'
where business_id is null;

-- Migrar shifts existentes
update public.shifts 
set business_id = '00000000-0000-0000-0000-000000000001'
where business_id is null;

-- Migrar sales existentes
update public.sales 
set business_id = '00000000-0000-0000-0000-000000000001'
where business_id is null;

-- Crear owner para admins existentes
insert into public.business_members (business_id, user_id, role)
select '00000000-0000-0000-0000-000000000001', id, 'owner'
from public.profiles
where role = 'admin'
on conflict (business_id, user_id) do nothing;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 10. ACTUALIZAR RLS                                              │
-- └─────────────────────────────────────────────────────────────────┘

-- PRODUCTS
drop policy if exists "products_worker_read" on public.products;
drop policy if exists "products_admin_write" on public.products;

create policy "products_member_read" on public.products
  for select using (
    is_global = true
    or business_id in (select get_user_businesses(auth.uid()))
  );

create policy "products_member_write" on public.products
  for all using (
    is_global = true
    or business_id in (select get_user_businesses(auth.uid()))
  );

-- SHIFTS
drop policy if exists "shifts_worker_own" on public.shifts;
drop policy if exists "shifts_admin_all" on public.shifts;

create policy "shifts_member_read" on public.shifts
  for select using (
    user_id = auth.uid()
    or business_id in (select get_user_businesses(auth.uid()))
  );

create policy "shifts_member_write" on public.shifts
  for all using (
    user_id = auth.uid()
    or business_id in (select get_user_businesses(auth.uid()))
  );

-- SALES
drop policy if exists "sales_worker_own" on public.sales;
drop policy if exists "sales_admin_all" on public.sales;

create policy "sales_member_read" on public.sales
  for select using (
    user_id = auth.uid()
    or business_id in (select get_user_businesses(auth.uid()))
  );

create policy "sales_member_write" on public.sales
  for insert with check (
    user_id = auth.uid()
    or business_id in (select get_user_businesses(auth.uid()))
  );

-- SALE_ITEMS
drop policy if exists "sale_items_worker_own" on public.sale_items;
drop policy if exists "sale_items_admin_all" on public.sale_items;

create policy "sale_items_member_read" on public.sale_items
  for select using (
    exists (
      select 1 from public.sales s
       where s.id = sale_items.sale_id
         and (s.user_id = auth.uid()
              or s.business_id in (select get_user_businesses(auth.uid())))
    )
  );

create policy "sale_items_member_write" on public.sale_items
  for insert with check (
    exists (
      select 1 from public.sales s
       where s.id = sale_items.sale_id
         and (s.user_id = auth.uid()
              or s.business_id in (select get_user_businesses(auth.uid())))
    )
  );

-- CASH_WITHDRAWALS
drop policy if exists "withdrawals_worker_own" on public.cash_withdrawals;
drop policy if exists "withdrawals_admin_all" on public.cash_withdrawals;

create policy "withdrawals_member_read" on public.cash_withdrawals
  for select using (
    user_id = auth.uid()
    or shift_id in (
      select id from public.shifts
       where business_id in (select get_user_businesses(auth.uid()))
    )
  );

create policy "withdrawals_member_write" on public.cash_withdrawals
  for all using (
    user_id = auth.uid()
    or shift_id in (
      select id from public.shifts
       where business_id in (select get_user_businesses(auth.uid()))
    )
  );

-- BUSINESSES
drop policy if exists "businesses_member_read" on public.businesses;
create policy "businesses_member_read" on public.businesses
  for select using (
    id in (select get_user_businesses(auth.uid()))
  );

drop policy if exists "businesses_member_write" on public.businesses;
create policy "businesses_member_write" on public.businesses
  for all using (
    exists (
      select 1 from public.business_members
       where business_id = id
         and user_id = auth.uid()
         and role in ('owner', 'admin')
    )
  );

-- BUSINESS_MEMBERS
drop policy if exists "business_members_member_read" on public.business_members;
create policy "business_members_member_read" on public.business_members
  for select using (
    user_id = auth.uid()
    or business_id in (select get_user_businesses(auth.uid()))
  );

drop policy if exists "business_members_owner_manage" on public.business_members;
create policy "business_members_owner_manage" on public.business_members
  for all using (
    exists (
      select 1 from public.business_members bm
       where bm.business_id = business_members.business_id
         and bm.user_id = auth.uid()
         and bm.role in ('owner', 'admin')
    )
  );

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 11. ACTUALIZAR TRIGGERS                                         │
-- └─────────────────────────────────────────────────────────────────┘

-- Update check_low_stock trigger para usar business_id
create or replace function public.check_low_stock()
returns trigger language plpgsql security definer as $$
begin
  if new.stock < new.min_stock and new.is_active = true then
    insert into public.notifications (user_id, type, title, message, payload)
    select bm.user_id,
           'low_stock',
           '⚠️ Stock bajo: ' || new.name,
           format('Quedan %s unidades (mínimo: %s)', new.stock, new.min_stock),
           jsonb_build_object('product_id', new.id, 'stock', new.stock, 'min_stock', new.min_stock, 'business_id', new.business_id)
      from public.business_members bm
     where bm.business_id = new.business_id
       and bm.role in ('owner', 'admin')
       and bm.is_active = true;
  end if;
  return new;
end;
$$;

-- Update notify_shift_closed trigger para usar nuevos nombres de columnas
create or replace function public.notify_shift_closed()
returns trigger language plpgsql security definer as $$
begin
  if new.shift_status = 'closed' and (old.shift_status is null or old.shift_status <> 'closed') then
    insert into public.notifications (user_id, type, title, message, payload)
    select bm.user_id,
           'shift_closed',
           '💰 Cierre de caja #' || substr(new.id::text, 1, 8),
           format('Ventas: $%s | Esperado: $%s | Declarado: $%s | Descuadre: $%s',
                  new.total_sales, new.cash_expected, new.cash_declared, new.discrepancy),
           jsonb_build_object(
             'shift_id', new.id, 'worker_id', new.user_id,
             'total_sales', new.total_sales, 'cash_expected', new.cash_expected,
             'cash_declared', new.cash_declared, 'discrepancy', new.discrepancy,
             'business_id', new.business_id
           )
      from public.business_members bm
     where bm.business_id = new.business_id
       and bm.role in ('owner', 'admin')
       and bm.is_active = true;
  end if;
  return new;
end;
$$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 12. AGREGAR RLS A TABLAS NUEVAS                                  │
-- └─────────────────────────────────────────────────────────────────┘
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

-- ====================================================================
-- FIN DE LA MIGRACIÓN
-- ====================================================================
