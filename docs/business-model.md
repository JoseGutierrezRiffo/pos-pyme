# Modelo de Negocio - POS Pyme (Multi-Tenant)

## Visión General

POS Pyme es un sistema **multi-tenant basado en aislamiento por datos**. Permite a un mismo usuario (profile) administrar, supervisar o trabajar en múltiples comercios de forma simultánea. El acceso, la visualización de costos financieros y el flujo de caja se segmentan mediante un encabezado HTTP (`X-Business-ID`) y políticas de seguridad estrictas en el backend y la base de datos.

---

## Modelo de Datos

### Entidades y Relaciones

```
┌─────────────┐       ┌──────────────────┐
│   profiles  │◄──────│ business_members │
│  (usuarios) │       │                  │
│             │       │ - user_id        │
│ - id        │       │ - business_id    │
│ - email     │       │ - role           │
│ - full_name │       │ - is_active      │
│ - is_active │       └────────┬─────────┘
└─────────────┘                │
                               │ belongs to
                      ┌────────▼─────────┐
                      │   businesses     │
                      │                  │
                      │ - id             │
                      │ - name           │
                      │ - slug (único)   │
                      │ - rut            │
                      │ - is_active      │
                      └────────┬─────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│   products      │  │     shifts      │  │     sales       │
│                 │  │   (Turnos)      │  │                 │
│ - business_id   │  │ - business_id   │  │ - business_id   │
│ - name          │  │ - user_id       │  │ - shift_id      │
│ - cost_price    │  │ - status        │  │ - cash_amount   │
│ - sale_price    │  │ - cash_initial │  │ - card_amount   │
│ - stock         │  │ - discrepancy   │  │ - transfer_amount│
└─────────────────┘  └─────────────────┘  └────────┬────────┘
                                                   │ has many
                                          ┌────────▼────────┐
                                          │   sale_items    │
                                          │ (Historial Real)│
                                          │                 │
                                          │ - sale_id       │
                                          │ - product_id    │
                                          │ - price_at_sale │
                                          │ - cost_at_sale  │
                                          └─────────────────┘
```

---

## Tabla: `shifts` (Control de Caja y Turnos)

Esta tabla representa las sesiones de trabajo. **Un empleado no puede vender si no posee un turno en estado `open`.**

| Campo              | Tipo          | Descripción                                                                    |
| ------------------ | ------------- | ------------------------------------------------------------------------------ |
| `id`               | uuid          | PK                                                                             |
| `business_id`      | uuid          | FK → businesses                                                                |
| `user_id`          | uuid          | FK → profiles (El trabajador que opera el turno)                               |
| `status`           | enum          | `'open' \| 'break' \| 'closed'`                                                |
| `cash_initial`     | numeric(12,2) | Monto en efectivo inicial ("sencillo" para vueltos).                           |
| `cash_withdrawals` | numeric(12,2) | Acumulado de retiros parciales de dinero para gastos del día.                  |
| `cash_declared`    | numeric(12,2) | Monto físico en efectivo contado a ciegas por el empleado al cerrar.           |
| `cash_expected`    | numeric(12,2) | **Calculado por sistema:** `cash_initial + ventas_efectivo - cash_withdrawals` |
| `discrepancy`      | numeric(12,2) | **Diferencia final:** `cash_declared - cash_expected`                          |
| `opened_at`        | timestamptz   | Fecha/hora de apertura.                                                        |
| `closed_at`        | timestamptz   | Fecha/hora de cierre definitivo.                                               |

---

## Tabla: `sales` y `sale_items` (Estructura Multiventa Antifraude)

Para soportar pagos mixtos y congelar los costos históricos frente a la inflación o cambios de precios del catálogo, las ventas se dividen en cabecera y detalle.

### `sales` (Cabecera)

| Campo             | Tipo          | Descripción                                                |
| ----------------- | ------------- | ---------------------------------------------------------- |
| `id`              | uuid          | PK                                                         |
| `business_id`     | uuid          | FK → businesses (Garantiza RLS rápido y reportes globales) |
| `shift_id`        | uuid          | FK → shifts (Asocia la venta al turno del empleado)        |
| `cash_amount`     | numeric(12,2) | Monto pagado en Efectivo                                   |
| `card_amount`     | numeric(12,2) | Monto pagado con Tarjetas (Débito/Crédito/Transbank)       |
| `transfer_amount` | numeric(12,2) | Monto pagado vía Transferencia Electrónica                 |
| `total`           | numeric(12,2) | Suma de todos los montos de pago anteriores                |
| `created_at`      | timestamptz   |                                                            |

### `sale_items` (Detalle de Productos Vendidos)

| Campo           | Tipo          | Descripción                                                  |
| --------------- | ------------- | ------------------------------------------------------------ |
| `id`            | uuid          | PK                                                           |
| `sale_id`       | uuid          | FK → sales ON DELETE CASCADE                                 |
| `product_id`    | uuid          | FK → products                                                |
| `quantity`      | numeric(10,3) | Permite números flotantes (ej: 0.500 para medio kilo de pan) |
| `price_at_sale` | numeric(12,2) | **Precio de venta congelado** al momento de la transacción   |
| `cost_at_sale`  | numeric(12,2) | **Costo de compra congelado** al momento de la transacción   |

---

## Roles y Permisos

### Membership Roles (por negocio)

| Rol      | Descripción             | Permisos                                                               |
| -------- | ----------------------- | ---------------------------------------------------------------------- |
| `owner`  | Dueño del negocio       | Todo: CRUD productos, ver financials, cerrar turnos, gestionar members |
| `admin`  | Administrador designado | Igual que owner (para delegar gestión)                                 |
| `worker` | Empleado                | Solo POS: abrir/cerrar turno, registrar ventas, ver sus propios turnos |

### Reglas de Negocio

1. **Un usuario puede tener múltiples roles en el mismo negocio?**
   - No. Un usuario tiene UN rol por negocio (owner, admin, o worker).

2. **Un usuario puede ser owner de varios negocios?**
   - Sí. Puede crear negocios ilimitados y ser owner de todos.

3. **Un usuario puede ser worker de varios negocios?**
   - Sí. Puede trabajar en múltiples negocios simultáneamente.

4. **Un usuario puede ser owner de un negocio y worker de otro?**
   - Sí. Son roles independientes por negocio.

---

## Reglas de Negocio Críticas para el Backend (NestJS)

### 1. Middleware/Guard de Seguridad de Contexto (X-Business-ID)

Cada request HTTP hacia la API debe contener obligatoriamente el header `X-Business-ID`. El backend aplicará este flujo estricto:

1. **Validación de Suscripción:** Verifica si el business asociado está activo (`is_active = true`). Si el negocio está suspendido por falta de pago, bloquea cualquier petición con un error `403 Forbidden` a todos los miembros de forma inmediata.

2. **Validación de Rol:** Extrae el token del usuario desde Supabase Auth, consulta la tabla `business_members` para ese `business_id` y valida si tiene los permisos requeridos.

3. **Sanitización de Datos de Empleados:** Si el usuario tiene el rol `worker`, el interceptor de NestJS removerá de manera automática el campo `cost_price` en cualquier lista de productos antes de enviar el JSON final al frontend.

### 2. Concurrencia e Integridad de Stock

Al procesar una venta (`POST /api/sales`), la base de datos controlará la reducción del inventario mediante una **transacción atómica aislada** en base de datos.

No se lee el stock en memoria de JS para luego restarlo. Se ejecuta una consulta directa que evalúa la condición al vuelo:

```sql
UPDATE products
SET stock = stock - quantity_sold
WHERE id = product_uuid AND stock >= quantity_sold;
```

Si la fila modificada devuelve **0 registros afectados**, significa que no había stock suficiente en ese milisegundo, cancelando la transacción (Rollback) para evitar stock negativo.

### 3. Restricciones del Flujo de Turnos (shifts)

- Un worker **no puede** iniciar un nuevo turno mediante `POST /api/shifts/open` si existe un registro previo de su autoría con el estado `'open'` o `'break'` en ese negocio.

- Durante el estado `'break'` (Colación), la API del terminal POS **rechazará** cualquier intento de procesar una venta bajo ese `shift_id` devolviendo un error controlado al frontend.

---

## Contexto: X-Business-ID Header

Todos los requests del frontend incluyen:

```
X-Business-ID: <uuid_del_negocio_seleccionado>
```

El backend:

1. Valida que el usuario tenga acceso al negocio
2. Filtra todos los queries por ese `business_id`
3. Si es worker, aplica filtros adicionales (solo sus turnos, sin `cost_price`)

---

## Row Level Security (RLS)

### Funciones Helper

```sql
-- Obtener todos los negocios de un usuario
get_user_businesses(user_uuid) → SETOF uuid

-- Obtener rol de usuario en un negocio
get_user_role_in_business(user_uuid, business_uuid) → membership_role

-- Verificar acceso a negocio
user_has_business_access(user_uuid, business_uuid) → boolean
```

### Políticas por Tabla

#### `products`

| Rol         | SELECT                          | INSERT | UPDATE | DELETE |
| ----------- | ------------------------------- | ------ | ------ | ------ |
| owner/admin | ✅ (su negocio)                 | ✅     | ✅     | ✅     |
| worker      | ✅ (su negocio, sin cost_price) | ❌     | ❌     | ❌     |

#### `shifts`

| Rol         | SELECT          | INSERT          | UPDATE               |
| ----------- | --------------- | --------------- | -------------------- |
| owner/admin | ✅ (su negocio) | ✅              | ✅                   |
| worker      | ✅ (sus turnos) | ✅ (open/close) | ✅ (solo sus turnos) |

#### `sales`

| Rol         | SELECT          | INSERT |
| ----------- | --------------- | ------ |
| owner/admin | ✅ (su negocio) | ❌     |
| worker      | ✅ (sus ventas) | ✅     |

---

## API Endpoints

### Businesses

```
GET    /api/businesses                    → Listar mis negocios
POST   /api/businesses                   → Crear negocio
GET    /api/businesses/:id              → Detalle negocio
PATCH  /api/businesses/:id               → Editar negocio
DELETE /api/businesses/:id               → Eliminar negocio (solo owner)
```

### Business Members

```
GET    /api/businesses/:id/members        → Listar miembros
POST   /api/businesses/:id/members       → Invitar miembro
PATCH  /api/businesses/:id/members/:uid   → Cambiar rol
DELETE /api/businesses/:id/members/:uid  → Eliminar miembro
```

### Products (scoped by business)

```
GET    /api/products                     → Listar (filtro por X-Business-ID)
POST   /api/products                     → Crear (owner/admin)
PATCH  /api/products/:id                 → Editar (owner/admin)
DELETE /api/products/:id                 → Eliminar (owner/admin)
```

### Shifts (scoped by business)

```
GET    /api/shifts                       → Listar (owner ve todos, worker sus turnos)
POST   /api/shifts/open                  → Abrir turno
POST   /api/shifts/break                 → Ir a colación
POST   /api/shifts/resume                → Volver de colación
POST   /api/shifts/close                 → Cerrar turno (a ciegas)
GET    /api/shifts/:id                   → Detalle turno
```

### Sales (scoped by business)

```
POST   /api/sales                        → Registrar venta
GET    /api/sales                        → Listar ventas (owner todas, worker las suyas)
```

---

## Glossary

| Término            | Definición                                                          |
| ------------------ | ------------------------------------------------------------------- |
| **Owner**          | Dueño legal del negocio, puede hacer todo                           |
| **Admin**          | Administrador con permisos de owner (delegación)                    |
| **Worker**         | Empleado, solo puede usar POS                                       |
| **Membership**     | Relación usuario↔negocio con rol                                    |
| **Slug**           | Identificador URL friendly y único                                  |
| **Multi-tenant**   | Arquitectura donde un sistema sirve a múltiples clientes (negocios) |
| ** cash_declared** | Monto de efectivo que el worker declara al cerrar (a ciegas)        |
| ** cash_expected** | Monto de efectivo esperado según cálculos del sistema               |
| ** Discrepancy**   | Diferencia entre declared y expected                                |

---

## Referencias

- Migración actual: `supabase/migrations/0001_initial_schema.sql`
- Próxima migración: `supabase/migrations/0005_businesses_multi_tenant.sql`
