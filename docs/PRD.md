# PRD — POS Pyme

> Documento de producto: única fuente de verdad del alcance del MVP.
> Cualquier épica o historia que no esté acá, no se construye.

**Producto:** POS Pyme — Inventario + Turnos + Caja
**Versión:** 0.1.0
**Estado:** draft
**Tags:** prd, mvp, producto

---

> 📋 **Documento vivo**. Este es el **único lugar** donde vive la verdad del alcance del MVP.
> Cualquier épica o historia que no esté acá, **no se construye**.

---

## 1. 🎯 Resumen Ejecutivo

**Para**: Micro-PYMEs locales (minimarkets, botillerías, ferreterías) con 1-3 empleados que actualmente gestionan inventario y caja en cuadernos o Excel.

**El producto es**: Una app web mobile-first con dos portales separados (Admin y Trabajador) que permite gestionar inventario, controlar turnos de caja con descuadre automático, y emitir reportes de ventas. Funciona como PWA en tablets y teléfonos del local.

**No es** (en este MVP): Un sistema de facturación electrónica, e-commerce, multi-sucursal, contabilidad completa ni CRM.

---

## 2. 🌟 Visión y Misión

**Visión** (a 3 años): Ser el sistema operativo del comercio de barrio en LATAM. Que un dueño de minimarket pueda abrir su local y cerrar su día sin tocar un papel.

**Misión del MVP** (a 6 meses): Reemplazar el cuaderno de caja de 100 minimarkets en Chile, eliminando el descuadre y las pérdidas de mercadería fantasma.

---

## 3. 🎯 Objetivos del MVP

| #   | Objetivo                  | Métrica de éxito (3 meses post-lanzamiento) |
| --- | ------------------------- | ------------------------------------------- |
| O1  | Reducir descuadre de caja | -70% descuadre promedio por local           |
| O2  | Eliminar stock fantasma   | -50% pérdidas de mercadería                 |
| O3  | Adoptado por trabajadores | ≥80% turnos cerrados por la app             |
| O4  | Retener clientes          | ≥70% MRR a los 3 meses                      |

---

## 4. 📊 North Star Metric

> **Turnos cerrados a tiempo** (con descuadre < $1.000 CLP)

Esta métrica captura simultáneamente:

- Adopción (la usan)
- Eficacia (mejora el negocio)
- Fricción (la cierran a tiempo = no abandonan)

---

## 5. 🚫 Fuera del Alcance (Out of Scope)

> Lista explícita para evitar scope creep. Si alguien pide algo de acá, va a la sección "Roadmap Post-MVP" más abajo.

- ❌ Boleta electrónica / DTE / SII
- ❌ Multi-sucursal / multi-tienda
- ❌ E-commerce o ventas online
- ❌ Facturación a clientes (cuentas corrientes)
- ❌ Programa de fidelización / puntos
- ❌ Integración con bancos / conciliadores
- ❌ Modo offline (PWA) → **Fase 2**
- ❌ Productos con variantes (talla, color) → **Fase 2**
- ❌ Compras a proveedores (entradas de stock) → **Fase 2**
- ❌ Reportes avanzados / BI → **Fase 2**
- ❌ App móvil nativa (React Native/Flutter) → **Fase 3**

---

## 6. 👥 Personas Objetivo

| Persona                        | Descripción                                         | Doc                    |
| ------------------------------ | --------------------------------------------------- | ---------------------- |
| **Doña Rosa** (Admin)          | Dueña de minimarket, 50 años, no sabe de tecnología | Persona: Rosa   |
| **Matías** (Worker)            | Cajero joven, 22 años, nativo digital, rotativo     | Persona: Matias |
| **Don Hernán** (Admin ausente) | Dueño que no está en el local, delega todo          | Persona: Hernan |

---

## 7. 🏗️ Épicas

| #   | Épica                                                  | Prioridad | Estado       |
| --- | ------------------------------------------------------ | --------- | ------------ |
| E1  | Épica Auth — Autenticación y roles                 | P0        | 📐 En diseño |
| E2  | Épica Turnos_Caja — Sistema de turnos y caja       | P0        | 📐 En diseño |
| E3  | Épica Inventario_POS — Inventario y POS móvil      | P0        | 📐 En diseño |
| E4  | Épica Dashboard_Admin — Dashboard y notificaciones | P0        | 📐 En diseño |
| E5  | (Fase 2) Modo offline PWA                              | P1        | 💤 Backlog   |
| E6  | (Fase 2) Variantes de productos                        | P1        | 💤 Backlog   |

---

### E1 — Autenticación y Roles

> **Problema**: Hoy el dueño no tiene forma de controlar quién opera la caja. Los empleados usan la misma calculadora, no hay trazabilidad.

**US-001**: Como **trabajador**, quiero **iniciar sesión con email y contraseña**, para **acceder al POS con mis credenciales**.

**Criterios de aceptación**:

- [ ] Pantalla de login con email + password
- [ ] Validación contra Supabase Auth
- [ ] Si las credenciales son inválidas → mensaje de error genérico
- [ ] Si el usuario está `is_active = false` → bloqueo con mensaje "Usuario deshabilitado"
- [ ] Al éxito: redirige a `/(worker)/pos` o `/(worker)/abrir-turno` si no tiene turno abierto
- [ ] Token JWT persiste (localStorage o cookie httpOnly)

---

**US-002**: Como **administrador**, quiero **iniciar sesión**, para **acceder al dashboard financiero**.

**Criterios de aceptación**:

- [ ] Misma pantalla de login que el worker
- [ ] Al éxito: redirige a `/(admin)/dashboard`
- [ ] Backend valida `role = 'admin'` antes de servir cualquier endpoint admin

---

**US-003**: Como **sistema**, quiero **validar el rol del usuario en cada request**, para **que un worker no pueda acceder a endpoints financieros**.

**Criterios de aceptación**:

- [ ] `@Roles('admin')` decorator en NestJS
- [ ] `RolesGuard` rechaza con `403 Forbidden` si rol no coincide
- [ ] Tests E2E: worker intenta GET `/finance/margins` → 403
- [ ] RLS en Supabase como segunda capa de seguridad

---

### E2 — Turnos y Caja

> **Problema**: Sin control de turnos, no se sabe quién perdió plata, cuándo ni por qué. La caja es un agujero negro.

> 📐 Regla de negocio: REGLA_Cuadre_Caja

**US-010**: Como **trabajador**, quiero **abrir mi turno ingresando el efectivo inicial**, para **dejar registro de con cuánto empecé**.

**Criterios de aceptación**:

- [ ] Pantalla `/abrir-turno` obligatoria si no tiene turno abierto
- [ ] Input numérico de "Efectivo Inicial" → obligatorio, > 0
- [ ] Al confirmar: crea registro en `shifts` con `status = 'abierto'`, `initial_cash = X`
- [ ] Constraint de DB: NO se puede tener 2 turnos abiertos para el mismo user

---

**US-011**: Como **trabajador**, quiero **marcar inicio de colación y volver de colación**, para **que el sistema registre mi pausa y bloquee ventas durante ella**.

**Criterios de aceptación**:

- [ ] Botón "Ir a colación" en el POS → cambia status a `en_colacion`, registra timestamp
- [ ] UI se bloquea: no permite buscar productos ni registrar ventas
- [ ] Botón "Volver de colación" → status vuelve a `abierto`, registra timestamp
- [ ] Cálculo: tiempo en colación no se considera dentro de la jornada activa

---

**US-012**: Como **trabajador**, quiero **registrar un retiro parcial de efectivo** (gasto chico), para **dejar constancia de salidas de caja durante el turno**.

**Criterios de aceptación**:

- [ ] Modal en el POS: "Registrar retiro"
- [ ] Campos: monto (>, 0), motivo (enum), nota opcional
- [ ] Se descuenta de `expected_cash` en el cálculo del cierre
- [ ] Aparece en historial del turno (visible para worker y admin)

---

**US-013**: Como **trabajador**, quiero **cerrar mi turno a ciegas**, para **declarar cuánto efectivo conté sin sesgarme con el valor esperado**.

**Criterios de aceptación**:

- [ ] Pantalla `/cerrar-turno` con flujo en 3 pasos:
  1. Resumen: ventas del día, retiros (sin mostrar `expected_cash`)
  2. Input: "Cuenta el efectivo físico e ingresa el total"
  3. Resultado: muestra `expected_cash`, `discrepancy`, clasificación (OK/Atención/Crítico)
- [ ] Cálculo: `E = initial_cash + total_cash_sales - total_withdrawals`
- [ ] Cálculo: `D = final_cash - E`
- [ ] Clasificación: `|D| ≤ 1000 → OK`, `1000 < |D| ≤ 3000 → ATENCIÓN`, `|D| > 3000 → CRÍTICO`
- [ ] Al confirmar: status → `cerrado`, `ended_at = now()`
- [ ] Trigger de DB notifica al admin automáticamente

---

**US-014**: Como **administrador**, quiero **ver el reporte de cierre de un turno**, para **revisar las ventas, retiros y descuadre**.

**Criterios de aceptación**:

- [ ] Lista de turnos con filtros: fecha, trabajador, estado
- [ ] Detalle de turno: ventas, items vendidos, retiros, descuadre
- [ ] Gráfico de ventas por hora del turno (opcional, fase 2)

---

### E3 — Inventario y POS Móvil

> **Problema**: El empleado pierde tiempo buscando productos y el dueño no sabe qué tiene, qué le falta o qué se "pierde".

**US-020**: Como **trabajador**, quiero **buscar productos por nombre o SKU**, para **encontrar rápido lo que el cliente pide**.

**Criterios de aceptación**:

- [ ] Input de búsqueda en el POS con debounce de 200ms
- [ ] Busca por: nombre (ILIKE) o SKU (exacto o prefijo)
- [ ] Resultados en grilla mobile-friendly con: nombre, precio, stock disponible
- [ ] Si stock = 0 → mostrar "Sin stock" y deshabilitar
- [ ] Búsqueda optimizada con índice `idx_products_sku`

---

**US-021**: Como **trabajador**, quiero **registrar una venta con múltiples items y cobrar**, para **completar la transacción**.

**Criterios de aceptación**:

- [ ] Carrito temporal con: items, cantidad editable, subtotal
- [ ] Total calculado en tiempo real
- [ ] Selector de método de pago: efectivo / transferencia / tarjeta
- [ ] Botón "Cobrar" → crea `sales` + `sale_items` en una transacción
- [ ] Stock se descuenta atómicamente vía trigger de DB
- [ ] Validación: si algún item no tiene stock suficiente → revertir toda la venta
- [ ] Limpiar carrito y mostrar confirmación al éxito

---

**US-022**: Como **administrador**, quiero **crear, editar y eliminar productos**, para **mantener el catálogo actualizado**.

**Criterios de aceptación**:

- [ ] CRUD completo en `/admin/inventario`
- [ ] Campos: SKU, nombre, descripción, costo, precio venta, stock actual, stock mínimo
- [ ] Validaciones: SKU único, precios > 0, stock ≥ 0
- [ ] Alerta visual si stock < min_stock (badge rojo)
- [ ] Soft delete: `is_active = false` (no se borra de DB, no aparece en POS)

---

**US-023**: Como **sistema**, quiero **alertar al admin cuando un producto baja del stock mínimo**, para **que sepa qué reponer**.

**Criterios de aceptación**:

- [ ] Trigger `check_low_stock` se dispara al actualizar `products.stock`
- [ ] Inserta notificación para todos los `profiles.role = 'admin'`
- [ ] Notificación visible en el panel admin con badge de no leídas

---

### E4 — Dashboard Admin y Notificaciones

> **Problema**: El dueño no sabe si va ganando o perdiendo plata. Solo se entera al hacer balance anual.

**US-030**: Como **administrador**, quiero **ver un dashboard con KPIs financieros**, para **tomar decisiones informadas**.

**Criterios de aceptación**:

- [ ] Vista `/admin/dashboard` con:
  - Ventas totales del día / semana / mes
  - Margen de ganancia (utilidad / ingresos) %
  - Top 5 productos más vendidos
  - Top 5 productos menos vendidos (alerta lenta rotación)
  - Número de turnos cerrados hoy
  - Descuadre promedio del período
- [ ] Selector de rango de fechas
- [ ] Solo accesible para `role = 'admin'` (RLS + guard)

---

**US-031**: Como **administrador**, quiero **recibir una notificación cuando un empleado cierra caja**, para **enterarme del cierre sin estar pendiente**.

**Criterios de aceptación**:

- [ ] Al cerrar un turno: trigger inserta notificación para admins
- [ ] Notificación contiene: nombre del trabajador, total ventas, descuadre
- [ ] Visible en panel de notificaciones con badge de no leídas
- [ ] (Fase 2) Envío por email vía Edge Function

---

**US-032**: Como **administrador**, quiero **marcar notificaciones como leídas**, para **limpiar el panel**.

**Criterios de aceptación**:

- [ ] Click en notificación → marca `is_read = true`
- [ ] Botón "Marcar todas como leídas"

---

## 8. 🧪 Criterios de Aceptación Globales del MVP

> Estas aplican transversalmente. Si no se cumplen, no se lanza.

- [ ] Un trabajador NO puede ver `cost_price` en ningún endpoint
- [ ] Un trabajador NO puede ver turnos de otros trabajadores
- [ ] Un trabajador NO puede ver históricos de días anteriores
- [ ] El cierre de caja funciona a ciegas: NO se muestra `expected_cash` antes del input
- [ ] El stock nunca puede ser negativo (validación en DB y UI)
- [ ] Un turno abierto es único por usuario (constraint de DB)
- [ ] Toda venta descuenta stock atómicamente
- [ ] La app funciona en iPhone 12+ y Android 9+
- [ ] Lighthouse mobile score ≥ 80 en Performance

---

## 9. ⚠️ Riesgos y Mitigaciones

| #   | Riesgo                                            | Probabilidad | Impacto | Mitigación                                               |
| --- | ------------------------------------------------- | ------------ | ------- | -------------------------------------------------------- |
| R1  | Trabajador se queda sin internet mid-turno        | Alta         | Alto    | (Fase 2) Modo offline con cola de sincronización         |
| R2  | Cliente no quiere adoptar (resistencia al cambio) | Alta         | Alto    | Onboarding presencial + video tutoriales cortos          |
| R3  | Descuadre sigue alto por falta de formación       | Media        | Medio   | Tooltips contextuales en la app sobre cómo cuadrar       |
| R4  | Fuga de datos sensibles (costos)                  | Baja         | Crítico | RLS + tests E2E + code review                            |
| R5  | Competidor con más features                       | Media        | Medio   | Foco en simplicidad > features (cuaderno killer, no ERP) |

---

## 10. 📅 Roadmap de Fases

### Fase 0 (MVP) — 3 meses

- Épicas E1, E2, E3, E4
- Deploy en 5 minimarkets piloto
- Métrica de éxito: 80% turnos cerrados por la app

### Fase 1 — 3-6 meses post-MVP

- Modo offline (PWA con Service Worker)
- Variantes de productos
- Compras a proveedores (entradas de stock)
- Email notifications vía Edge Function
- Reportes exportables (CSV/PDF)

### Fase 2 — 6-12 meses

- Multi-sucursal
- Boleta electrónica (SII)
- Programa de fidelización
- App móvil nativa (React Native)

### Fase 3 — 12+ meses

- Integración con bancos / conciliadores
- BI avanzado / predicciones de stock
- Marketplace de proveedores

---

## 11. 🔗 Documentos Vinculados

### En este vault

- **Reglas de negocio**: ver `packages/business-rules/`
- **Casos de uso**: proximamente en `docs/`
- **Personas**: Persona: Rosa, Persona: Matias
- **Roadmap post-MVP**: sección "Roadmap Post-MVP" más abajo
- **Plantilla de historia de usuario**: TPL_User_Story
- **Plantilla de ADR**: TPL_ADR

### Externos

- **Migración SQL inicial**: `supabase/migrations/0001_initial_schema.sql`
- **Backend NestJS**: `backend/src/auth/guards/roles.guard.ts`
- **Frontend POS**: `frontend/src/pages/worker/pos.tsx`

---

## 📝 Changelog

| Fecha      | Versión | Cambio                                       | Autor         |
| ---------- | ------- | -------------------------------------------- | ------------- |
| YYYY-MM-DD | 0.1.0   | Creación inicial con 4 épicas y 17 historias | Tu_Nombre |
