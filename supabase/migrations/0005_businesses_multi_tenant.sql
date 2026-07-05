-- ====================================================================
-- MIGRACIÓN 0005 — Multi-tenant: Businesses + Members
-- Permite que un usuario sea owner/worker de múltiples negocios
-- ====================================================================

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 1. ENUMS                                                          │
-- └─────────────────────────────────────────────────────────────────┘
do $$ begin
  create type membership_role as enum ('owner', 'admin', 'worker');
exception when duplicate_object then null; end $$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2. BUSINESSES (Negocios)                                          │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.businesses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  rut           text,
  address       text,
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_businesses_slug on public.businesses(slug);
create index idx_businesses_active on public.businesses(is_active);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 3. BUSINESS_MEMBERS (Relación usuario ↔ negocio con rol)           │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.business_members (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            membership_role not null default 'worker',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(business_id, user_id)  -- un usuario no puede ser duplicado en mismo negocio
);

create index idx_business_members_user on public.business_members(user_id);
create index idx_business_members_business on public.business_members(business_id);
create index idx_business_members_role on public.business_members(role);

-- Función helper: obtener los negocios de un usuario
create or replace function public.get_user_businesses(user_uuid uuid)
returns setof uuid language sql stable security definer as $$
  select business_id from public.business_members
   where user_id = user_uuid and is_active = true;
$$;

-- Función helper: obtener el rol de un usuario en un negocio
create or replace function public.get_user_role_in_business(user_uuid uuid, business_uuid uuid)
returns membership_role language sql stable security definer as $$
  select role from public.business_members
   where user_id = user_uuid and business_id = business_uuid and is_active = true;
$$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 4. AGREGAR business_id A TABLAS EXISTENTES                         │
-- └─────────────────────────────────────────────────────────────────┘

-- 4.1 Products - agregar business_id
alter table public.products add column if not exists business_id uuid
  references public.businesses(id) on delete set null;

alter table public.products add column if not exists is_global boolean not null default false;
comment on column public.products.business_id is 'Negocio al que pertenece (null si es global)';

-- 4.2 Shifts - agregar business_id
alter table public.shifts add column if not exists business_id uuid
  references public.businesses(id) on delete set null;

-- 4.3 Sales - ya tiene shift_id, así que hereda de shift

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 5. ACTUALIZAR RLS PARA MULTI-TENANT                                │
-- └─────────────────────────────────────────────────────────────────┘

-- Función helper: verificar acceso a negocio
create or replace function public.user_has_business_access(user_uuid uuid, business_uuid uuid)
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from public.business_members
     where user_id = user_uuid
       and business_id = business_uuid
       and is_active = true
  );
$$;

-- PRODUCTS - workers ven solo productos de sus negocios
drop policy if exists "products_worker_read" on public.products;
create policy "products_worker_read" on public.products
  for select using (
    is_global = true
    or business_id in (select get_user_businesses(auth.uid()))
  );

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all using (
    is_global = true
    or business_id in (select get_user_businesses(auth.uid()))
  );

-- SHIFTS - workers ven solo turnos de sus negocios
drop policy if exists "shifts_worker_own" on public.shifts;
create policy "shifts_worker_own" on public.shifts
  for all using (
    user_id = auth.uid()
    or business_id in (select get_user_businesses(auth.uid()))
  );

drop policy if exists "shifts_admin_all" on public.shifts;
create policy "shifts_admin_all" on public.shifts
  for all using (
    public.user_has_business_access(auth.uid(), business_id)
  );

-- SALES - workers ven solo ventas de sus negocios
drop policy if exists "sales_worker_own" on public.sales;
create policy "sales_worker_own" on public.sales
  for all using (
    user_id = auth.uid()
    or shift_id in (
      select id from public.shifts
       where business_id in (select get_user_businesses(auth.uid()))
    )
  );

drop policy if exists "sales_admin_all" on public.sales;
create policy "sales_admin_all" on public.sales
  for all using (
    public.user_has_business_access(auth.uid(), 
      (select business_id from public.shifts where id = shift_id))
  );

-- SALE_ITEMS - misma lógica que sales
drop policy if exists "sale_items_worker_own" on public.sale_items;
create policy "sale_items_worker_own" on public.sale_items
  for all using (
    exists (
      select 1 from public.sales s
      join public.shifts sh on sh.id = s.shift_id
       where s.id = sale_items.sale_id
         and (s.user_id = auth.uid()
              or sh.business_id in (select get_user_businesses(auth.uid())))
    )
  );

-- CASH_WITHDRAWALS - misma lógica
drop policy if exists "withdrawals_worker_own" on public.cash_withdrawals;
create policy "withdrawals_worker_own" on public.cash_withdrawals
  for all using (
    user_id = auth.uid()
    or shift_id in (
      select id from public.shifts
       where business_id in (select get_user_businesses(auth.uid()))
    )
  );

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 6. MIGRAR DATOS EXISTENTES                                        │
-- └─────────────────────────────────────────────────────────────────┘

-- Crear un negocio por defecto para datos existentes
insert into public.businesses (id, name, slug, is_global)
values (
  '00000000-0000-0000-0000-000000000001',
  'Negocio Principal',
  'negocio-principal',
  true
)
on conflict (id) do nothing;

-- Migrar productos existentes al negocio por defecto
update public.products
set business_id = '00000000-0000-0000-0000-000000000001'
where business_id is null;

-- Migrar shifts existentes al negocio por defecto
update public.shifts
set business_id = '00000000-0000-0000-0000-000000000001'
where business_id is null;

-- Actualizar profile de admin existente como owner del negocio
insert into public.business_members (business_id, user_id, role)
select 
  '00000000-0000-0000-0000-000000000001',
  id,
  'owner'
from public.profiles
where role = 'admin'
on conflict (business_id, user_id) do nothing;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 7. SEED: CREAR NEGOCIO DE EJEMPLO                                 │
-- └─────────────────────────────────────────────────────────────────┘
-- Para probar, ejecutar manualmente:
-- 
-- 1. Crear negocio:
-- insert into public.businesses (name, slug) values ('Mi Tienda', 'mi-tienda');
--
-- 2. Agregar owner:
-- insert into public.business_members (business_id, user_id, role)
-- select id, 'UUID_DEL_USUARIO', 'owner' from public.businesses where slug = 'mi-tienda';
--
-- 3. Agregar worker:
-- insert into public.business_members (business_id, user_id, role)
-- select id, 'UUID_DEL_WORKER', 'worker' from public.businesses where slug = 'mi-tienda';

-- ====================================================================
-- FIN DE LA MIGRACIÓN
-- ====================================================================
