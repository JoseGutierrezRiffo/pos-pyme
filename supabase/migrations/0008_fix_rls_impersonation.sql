-- ====================================================================
-- MIGRACIÓN 0008 — Fix RLS impersonation (ISS-007 crítico)
--
-- Problema: las políticas *_member_write de la migración 0006 usan
--   `user_id = auth.uid() OR business_id in (...)`
-- lo que permite a cualquier member del business INSERT/UPDATE con
-- cualquier user_id (impersonación).
--
-- Fix: mantener solo `user_id = auth.uid()` para writes por member.
-- Si se necesita que admins/owners creen turnos/retiros en nombre de
-- otros, debe ser una policy separada con role check.
-- ====================================================================

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 1. SALES — la más crítica (atribución de ventas)               │
-- └─────────────────────────────────────────────────────────────────┘
drop policy if exists "sales_member_write" on public.sales;

-- Workers/owners insertan ventas únicamente atribuidas a sí mismos
create policy "sales_self_write" on public.sales
  for insert with check (
    user_id = auth.uid()
  );

-- Update permitido solo al dueño de la venta
drop policy if exists "sales_self_update" on public.sales;
create policy "sales_self_update" on public.sales
  for update using (
    user_id = auth.uid()
  );

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2. SHIFTS — admin puede crear turnos para otros (intencional)   │
-- └─────────────────────────────────────────────────────────────────┘
drop policy if exists "shifts_member_write" on public.shifts;

-- Owner/admin del business puede abrir turnos para cualquier worker
create policy "shifts_admin_open" on public.shifts
  for insert with check (
    business_id in (
      select business_id from public.business_members
      where user_id = auth.uid() and role in ('owner', 'admin') and is_active = true
    )
  );

-- Workers solo abren turnos para sí mismos
create policy "shifts_self_open" on public.shifts
  for insert with check (
    user_id = auth.uid()
  );

-- Update: dueño del turno o admin del business
drop policy if exists "shifts_self_update" on public.shifts;
create policy "shifts_self_update" on public.shifts
  for update using (
    user_id = auth.uid()
    or business_id in (
      select business_id from public.business_members
      where user_id = auth.uid() and role in ('owner', 'admin') and is_active = true
    )
  );

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 3. CASH_WITHDRAWALS — retiros atribuidos al user actual           │
-- └─────────────────────────────────────────────────────────────────┘
drop policy if exists "withdrawals_member_write" on public.cash_withdrawals;

create policy "withdrawals_self_write" on public.cash_withdrawals
  for insert with check (
    user_id = auth.uid()
  );

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 4. PRODUCTS — proteger is_global de cross-tenant pollution      │
-- └─────────────────────────────────────────────────────────────────┘
drop policy if exists "products_member_write" on public.products;

-- Products del business: cualquier member del business puede modificar
create policy "products_business_write" on public.products
  for all using (
    business_id in (select get_user_businesses(auth.uid()))
    and is_global = false
  );

-- Products globales: solo owner/admin puede modificar (proteger cross-tenant)
-- Nota: products globales son plantillas compartidas; deben ser gestionados
-- por super-admin/owner del catálogo maestro. Si no aplica al modelo de
-- negocio, esta policy se puede quitar.
create policy "products_global_owner_write" on public.products
  for all using (
    is_global = true
    and exists (
      select 1 from public.business_members
      where user_id = auth.uid()
        and role = 'owner'
        and is_active = true
    )
  );

-- ====================================================================
-- FIN — Riesgo ISS-007 mitigado para impersonación de ventas
-- ====================================================================