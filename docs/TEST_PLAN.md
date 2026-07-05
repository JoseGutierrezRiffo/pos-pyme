# Plan de Pruebas E2E — pos-pyme

> Plan ejecutado por el **qa-expert agent** usando **Playwright MCP** (`@playwright/mcp@latest`).
> Specs de referencia: `agent-harness/specs/pos-pyme/ui/{overview,web-admin,web-worker,user-flows}.md`.

## Setup

### Pre-requisitos para ejecutar este plan

1. **Backend corriendo** (uno de):
   - Local: `pnpm dev:api` (NestJS en `:3000`)
   - Staging: `https://api-staging.pos-pyme.cl/api`
2. **Frontend dev corriendo** (uno o ambos):
   - `pnpm dev:admin` → `http://localhost:5173`
   - `pnpm dev:worker` → `http://localhost:5174`
3. **Supabase configurado** con migraciones 0001..0008 aplicadas y al menos:
   - 1 business con `slug = 'negocio-test'`, `is_active = true`
   - 2 usuarios de prueba: `worker@test.cl` / `admin@test.cl` con password `Test1234!`
   - Productos seed (coca-cola, papas lays, sprite)
   - Memberships para ambos usuarios en el business
4. **Playwright MCP corriendo** (configurado en `~/.config/opencode/opencode.jsonc`)

### Convenciones

- **Cada test es independiente** — si uno falla, los demás corren igual.
- **Setup/teardown por test** — usar `browser_navigate` al inicio y limpiar storage al final.
- **Screenshots** — capturar `browser_take_screenshot` en pasos clave (login, POS cargado, cuadre OK/CRITICO).
- **No escribir datos reales** — usar prefijos `test-` para distinguir.
- **Timeouts generosos** — Supabase cold start puede tardar 5-10s en el primer request.

### Datos de prueba seed

```ts
// Workers
const TEST_USERS = {
  worker: { email: 'worker@test.cl', password: 'Test1234!', role: 'worker' },
  admin:  { email: 'admin@test.cl',  password: 'Test1234!', role: 'admin'  },
};

// Productos (después de aplicar seed_low_stock.sql)
const TEST_PRODUCTS = {
  coca:    { sku: 'BEB-001', name: 'Coca-Cola 350ml', price: 1500 },
  papas:   { sku: 'SNK-001', name: 'Papas Lays 100g',  price: 1200 },
  sprite:  { sku: 'BEB-002', name: 'Sprite 350ml',     price: 1500, stock: 1 }, // low stock
};

// Cuadre esperado
const CALC_HELPERS = {
  expectedCash: (initial, ventas, retiros) => initial + ventas - retiros,
  classify: (diff) => Math.abs(diff) <= 1000 ? 'OK' : Math.abs(diff) <= 3000 ? 'ATENCION' : 'CRITICO',
};
```

---

## Test Suite A: web-worker (POS del trabajador)

### A1. Login del trabajador

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| A1.1 | Login válido | Llenar email + password válidos, click "Ingresar" | Redirect a `/pos` (o `/open-shift` si no hay turno) | critical |
| A1.2 | Login con email inválido | Email formato inválido | Error inline "Email inválido" | medium |
| A1.3 | Login con password corto (<6) | Password de 3 chars | Error inline "Mínimo 6 caracteres" | medium |
| A1.4 | Login con credenciales incorrectas | Email válido + password wrong | Error genérico (no leak de cuál campo está mal) | high |
| A1.5 | Login con email no registrado | Email no existe en Supabase | Error genérico | high |
| A1.6 | Sesión persiste en reload | Login OK → F5 | Sigue logged in, redirige a `/pos` | medium |
| A1.7 | Sesión se cierra con "Salir y cerrar sesión" | Después de cerrar turno → logout | Vuelve a `/login`, no hay sesión en storage | high |

### A2. Apertura de turno

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| A2.1 | Abrir con monto válido | Input "20.000" → "Abrir turno" | POST `/shifts/open` con `cash_initial: 20000`, redirect `/pos`, currentShiftAtom seteado | critical |
| A2.2 | Rechazar monto 0 | Input "0" → submit | No llama API, botón disabled o error inline | medium |
| A2.3 | Rechazar monto negativo | Input "-1000" → submit | No llama API | medium |
| A2.4 | Rechazar monto vacío | No input → submit | Botón disabled o validación Zod inline | low |
| A2.5 | Acepta formatos CLP | Input "$20.000", "20.000", "20000" → submit | Todos crean turno con `cash_initial: 20000` | medium |
| A2.6 | Sin business seleccionado | Mock selectedBusinessAtom=null → submit | Error "Por favor selecciona un negocio" | medium |
| A2.7 | Error de red en POST | Mock fetch reject | Error mostrado, sigue en `/open-shift`, no se perdió input | high |
| A2.8 | Doble click no crea dos turnos | Click 2 veces rápido | Solo 1 POST /shifts/open (button disabled o idempotency) | high |

### A3. POS — Catálogo y carrito

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| A3.1 | Carga catálogo | Navegar a `/pos` con turno abierto | GET `/products` retorna productos, renderizan en grid | critical |
| A3.2 | Filtrar por categoría | Click tab "Bebidas" | Solo productos de esa categoría visibles | medium |
| A3.3 | Buscar por SKU | Type "BEB-001" en buscador | Filtra productos a coincidencia exacta de SKU | medium |
| A3.4 | Buscar por nombre | Type "coca" en buscador | Filtra productos a coincidencia parcial de nombre | medium |
| A3.5 | Producto sin stock | Click producto con stock=0 | Agrega al carrito pero badge "Sin stock" o disabled | high |
| A3.6 | Producto con stock bajo | Click producto con stock<=min | Badge "Stock bajo" visible | medium |
| A3.7 | Agregar al carrito | Click producto | Aparece en carrito con qty=1, total actualizado | critical |
| A3.8 | Incrementar cantidad | Click "+" en item del carrito | qty++, line_total actualizado | high |
| A3.9 | Decrementar cantidad | Click "-" con qty=2 | qty-- | high |
| A3.10 | Eliminar del carrito | Click "🗑️" en item | Item desaparece, total recalculado | medium |
| A3.11 | Carrito vacío | Vaciar carrito | Mensaje "Tocá un producto para empezar" | low |

### A4. POS — Cobro y registro de venta

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| A4.1 | Venta 100% efectivo | Cart $1500, input efectivo $1500, submit | POST `/sales` con `cash_amount: 1500, card: 0, transfer: 0`. Carrito vacía, stock decrementa | critical |
| A4.2 | Venta mixta (efectivo + tarjeta) | Cart $3000, $1500 cada uno | POST con ambos montos, suma = total | critical |
| A4.3 | Venta 100% tarjeta | Cart $2000, tarjeta $2000 | POST `card_amount: 2000` | critical |
| A4.4 | Rechazar venta sin pago | Cart con productos, todos los montos $0 | No llama API, error "Al menos un método de pago debe tener monto > 0" | high |
| A4.5 | Rechazar suma < total | Cart $5000, efectivo $3000 | No llama API, advertencia visual | high |
| A4.6 | Descontar stock post-venta | Venta 2 cocas | Stock de cocas decrementa en 2 | critical |
| A4.7 | Confirmación visible | Después de venta exitosa | Toast "Venta registrada" o feedback | medium |
| A4.8 | Venta con carrito vacío | Carrito vacío → "Cobrar" disabled | Botón disabled o error | medium |
| A4.9 | Error de red al cobrar | Mock fetch reject en POST /sales | Error mostrado, carrito preservado, venta NO se pierde | critical |
| A4.10 | Doble submit no duplica venta | Submit 2 veces rápido | Solo 1 POST /sales | high |
| A4.11 | Decimales en quantity | Venta con quantity=0.5 (producto por peso) | POST con `quantity: 0.5` | medium |

### A5. Colación

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| A5.1 | Iniciar colación | Click "⏸ Colación" en POS | POST `/shifts/break/start`, POS se reemplaza por ColacionScreen con cronómetro | high |
| A5.2 | Cronómetro se incrementa | Esperar 5s en ColacionScreen | Cronómetro muestra 00:05 o más | medium |
| A5.3 | Terminar colación | Click "Terminar colación" | POST `/shifts/break/end`, vuelve a POS, currentShiftAtom refrescado | high |
| A5.4 | Colación sin turno abierto | Mock currentShift=null | Botón disabled o redirect a /open-shift | medium |

### A6. Retiro de caja

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| A6.1 | Retiro válido | Modal → razón "compra_insumos", monto 5000, nota | POST `/cash-withdrawals`, success toast, withdrawalsCount++ | high |
| A6.2 | Validar razón requerida | Submit sin razón | Validación inline | medium |
| A6.3 | Validar monto positivo | Submit con monto 0 o negativo | Validación inline | medium |
| A6.4 | Validar nota <= 200 chars | Submit con nota >200 chars | Validación inline | low |

### A7. Cierre de turno

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| A7.1 | Cierre cuadra exacto | Turno con ventas $5.000 efectivo, retiros $0, contar $25.000 (initial $20.000) | Status OK, direction "cuadra" | critical |
| A7.2 | Cierre con descuadre menor ATENCION | Contar $24.000 vs esperado $25.000 | Status ATENCION, direction "falta", texto formatea descuadre | critical |
| A7.3 | Cierre con descuadre mayor CRITICO | Contar $20.000 vs esperado $25.000 | Status CRITICO, direction "falta" | critical |
| A7.4 | Cierre con sobrante | Contar $26.000 vs esperado $25.000 | Status OK (|$1000|≤$1000), direction "sobra" | high |
| A7.5 | Conteo ciego | En step "count" el input NO muestra el esperado | El número esperado no se ve en pantalla, solo el input | high |
| A7.6 | Cierre con notas | Llenar notas "OK" en step summary | POST incluye `notes: "OK"` | medium |
| A7.7 | Step navegación | Step summary → count → result | Botón "Cancelar" en summary funciona | medium |
| A7.8 | Shift ya cerrado | currentShift.shift_status = 'closed' | No debería poder iniciar nueva venta | high |
| A7.9 | Resultado: cuadre exacto | Después de cerrar: $0 descuadre | Muestra "✅ Cuadra exacto" | high |
| A7.10 | Trigger notificación admin | Después de cerrar | POST `/notifications` creado (verificar via GET /notifications) | medium |
| A7.11 | Reload durante cierre | Refresh en step count | Vuelve a /pos si el turno ya está cerrado | medium |

---

## Test Suite B: web-admin (Portal del dueño)

### B1. Login del admin

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| B1.1 | Login admin válido | Email + password, click "Ingresar" | Redirect a `/dashboard` | critical |
| B1.2 | Login con rol worker | User con role worker intenta entrar | Redirect a `/login` (no tiene acceso a admin) | high |
| B1.3 | Sesión persiste en reload | F5 después de login | Sigue en `/dashboard` | medium |

### B2. Dashboard

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| B2.1 | Carga KPIs 7 días | Login + ir a `/dashboard` | GET `/shifts/daily-summary?from=...&to=...` retorna datos, 4 cards KPI visibles | critical |
| B2.2 | Stock crítico | Productos con stock ≤ min_stock | GET `/products/low-stock` retorna lista, LowStockAlert renderiza | critical |
| B2.3 | Aprobaciones pendientes | Cash withdrawals pendientes | GET `/cash-withdrawals?status=pending` retorna, PendingApprovals renderiza | high |
| B2.4 | Gráfico de barras | last 7 days sales | BarChart renderiza con datos | medium |
| B2.5 | Cambio de business | BusinessSelector cambia de A a B | Queries se refetchedan con nuevo business_id | high |
| B2.6 | Sin business seleccionado | Mock selectedBusinessAtom=null | Empty state "Selecciona un negocio" | medium |
| B2.7 | Error de red en KPIs | Mock fetch reject | Empty state con mensaje de error + retry | medium |

### B3. Calendar

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| B3.1 | Vista mensual | Navegar a `/calendar` | Grid 7×N con días del mes | critical |
| B3.2 | Días con turnos destacados | Día con 1+ shifts cerrados | Color de fondo según status (OK=verde, ATENCION=amber, CRITICO=rojo) | high |
| B3.3 | Click en día abre drawer | Click día con turnos | Drawer lateral con ShiftCard por cada turno | critical |
| B3.4 | ShiftCard muestra detalle | Drawer abierto | Inicio/Fin, duración, ventas, retiros, colación, resultado | high |
| B3.5 | Desglose por método de pago | ShiftCard visible | 3 badges: 💵 efectivo / 💳 tarjeta / 📲 transferencia | medium |
| B3.6 | Resumen diario correcto | Día con turnos | Suma ventas + retiros + breaks | high |
| B3.7 | Navegación mes anterior/siguiente | Click ← / → | Cambia mes, recalcula | medium |
| B3.8 | Exportar CSV | Click "Exportar CSV" | Download de `calendario-YYYY-MM.csv` con header + filas | medium |
| B3.9 | Días sin turnos | Mes sin actividad | Celdas sin color de status, no error | low |
| B3.10 | Cambio de mes | Cambiar mes, esperar fetch | Loading state visible, luego datos | medium |

### B4. Products

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| B4.1 | Listar productos | Navegar a `/products` | Tabla con productos del business | critical |
| B4.2 | Crear producto | Click "+ Nuevo" → llenar form → save | POST `/products`, producto aparece en tabla, modal cierra | critical |
| B4.3 | Editar producto | Click fila → ProductFormModal pre-cargado → save | PATCH `/products/:id`, tabla refleja cambios | high |
| B4.4 | Eliminar producto | Click 🗑️ → confirmar | Soft-delete (is_active=false), producto desaparece de UI | high |
| B4.5 | Buscar | Type en buscador | Filtra por SKU/nombre | medium |
| B4.6 | Validar precio > 0 | Submit con precio 0 | Validación inline | medium |
| B4.7 | Validar SKU único | Crear producto con SKU existente | Error del backend mostrado | high |
| B4.8 | Validar nombre requerido | Submit sin nombre | Validación inline | low |
| B4.9 | Paginación | Lista con >20 productos | Page 1, 2, etc. funcional | low |

### B5. Notifications

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| B5.1 | Lista notificaciones | Navegar a `/notifications` | GET `/notifications?only_unread=false` retorna lista | critical |
| B5.2 | Marcar como leída | Click "Marcar leída" | POST `/notifications/:id/read`, item se mueve a "leídas" | high |
| B5.3 | Marcar todas como leídas | Click "Marcar todas" | POST `/notifications/read-all`, lista vacía | high |
| B5.4 | Filtro por tipo | Seleccionar "low_stock" | Solo notificaciones de ese tipo visibles | medium |
| B5.5 | Badge de no leídas | Tener 3 no leídas | NotificationBell muestra "3" | medium |
| B5.6 | Trigger desde shift_close | Cerrar un turno en web-worker | Notificación aparece en web-admin en <5s | high |

---

## Test Suite C: Multi-tenant (CRÍTICO — seguridad)

> Estas pruebas verifican que el RLS de Supabase aísla correctamente los datos entre businesses.
> Si alguna falla, hay un **bug de seguridad** que requiere fix inmediato.

### C1. Aislamiento de datos

| # | Test | Pre-condición | Pasos | Esperado | Severidad |
|---|------|---------------|-------|----------|-----------|
| C1.1 | User A no ve productos de B | User en business A con session. Business B tiene productos propios. | Login → `/products` | Solo productos de A visibles | **CRITICAL** |
| C1.2 | User A no ve shifts de B | A tiene shifts, B tiene shifts propios | Login → calendar | Solo shifts de A en daily-summary | **CRITICAL** |
| C1.3 | User A no ve sales de B | A y B tienen sales distintos | Login → algún reporte de ventas | Solo sales de A | **CRITICAL** |
| C1.4 | User A no puede insertar sale con user_id de B | A intenta `POST /sales { user_id: '<B-user-id>' }` | Llamada API directa | Backend rechaza con 403 o RLS filtra | **CRITICAL** |
| C1.5 | Owner de A no puede ver sales de B como si fuera admin | A.owner intenta GET /shifts/daily-summary de B | Llamada API | Solo shifts de A en respuesta | high |
| C1.6 | Cambiar business en BusinessSelector | Logged as multi-business user | Cambiar de A a B | Datos en pantalla cambian, queries se refetchedan con nuevo business_id | critical |

### C2. Permisos por rol

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| C2.1 | Worker NO accede a web-admin | Login worker → intentar `/dashboard` | Redirect a `/login` | high |
| C2.2 | Owner puede crear shifts para workers | Owner abre OpenShift y crea shift para un worker | Turno creado | medium |
| C2.3 | Worker NO puede crear shift para otro | Worker intenta crear shift con user_id de otro | RLS rechaza (user_id != auth.uid()) | **CRITICAL** |

---

## Test Suite D: Auth + Sesión

### D1. Tokens y expiración

| # | Test | Pasos | Esperado | Severidad |
|---|------|-------|----------|-----------|
| D1.1 | JWT válido en cada request API | Inspección manual del header Authorization | Bearer token presente | high |
| D1.2 | Token expirado → redirect /login | Modificar token a uno expirado | AuthGate redirige | high |
| D1.3 | Token inválido (firma manipulada) | Modificar firma del JWT | API retorna 401, FE redirige a /login | **CRITICAL** |
| D1.4 | Logout limpia storage | Login → logout → inspeccionar localStorage | No hay tokens ni user data persistida | high |
| D1.5 | Refresh token funciona | Login → esperar 1h (mockear) → reload | Sesión refresca automáticamente | medium |

---

## Test Suite E: Performance (smoke)

> No son tests de carga formales; son smoke checks para detectar regresiones obvias.

| # | Test | Métrica | Umbral |
|---|------|---------|--------|
| E1 | Tiempo de login | Click submit → dashboard cargado | < 3s |
| E2 | Tiempo de carga de POS | Navigate `/pos` → productos visibles | < 2s |
| E3 | Tiempo de cálculo de cuadre | Click "Contar efectivo" → step result | < 1s |
| E4 | Bundle size web-admin | `pnpm build` + revisar dist/ | < 500KB gzipped |
| E5 | Bundle size web-worker | `pnpm build` + revisar dist/ | < 500KB gzipped |
| E6 | FCP web-admin | Lighthouse en `/dashboard` | < 2s |
| E7 | FCP web-worker | Lighthouse en `/pos` | < 2s |

---

## Test Suite F: Accesibilidad (a11y)

> Ejecutado con Playwright + `@axe-core/playwright` o revisión manual.
> Los criterios WCAG 2.1 AA son el target.

| # | Test | Verifica | Severidad |
|---|------|----------|-----------|
| F1 | Contraste de color | Ratio >= 4.5:1 en texto | high |
| F2 | Touch targets ≥ 44px | Botones del POS | high |
| F3 | Labels asociados a inputs | Login, OpenShift, ProductForm | high |
| F4 | Navegación por teclado | Tab order lógico, Enter activa submit | high |
| F5 | Focus visible | Outline visible en todos los interactivos | medium |
| F6 | Texto alt en imágenes | Logo, iconos, productos | medium |
| F7 | ARIA labels en iconos | Botones con solo emoji (🔍, 🗑️) | medium |
| F8 | Headings jerárquicos | h1 → h2 → h3 sin saltar niveles | low |
| F9 | Idioma declarado | `<html lang="es">` | medium |

---

## Ejecución con QA-Expert + Playwright MCP

### Comando

```bash
# Pre-req: backend + web-admin + web-worker corriendo
pnpm dev &

# Setup env + correr tests (12 tests, ~40s)
set -a && source tests/e2e/.env.local && set +a
pnpm test:e2e
```

Alternativa con MCP (en opencode CLI):

```bash
# En opencode, con qa-expert agent:
"Ejecutá el plan de pruebas E2E de docs/TEST_PLAN.md para pos-pyme usando Playwright MCP"
```

### Seeds requeridas (migration 0009)

Los productos con `available_portions: null` (sin recipe) se muestran como **AGOTADO** en el POS, lo que bloquea el test **A4.1 (vender)**. Para tener datos listos:

```bash
pnpm setup:db
# Aplica migration 0009_seed_recipes_and_ingredients.sql que crea:
#   - 5 ingredientes (Agua, Chocolate, Papas, Sal, Aceite) en Negocio Principal
#   - 3 recetas (BEB-003, DUL-001, SNK-001) con sus ingredientes
#   - Stock inicial: Agua=100lt, Chocolate=10kg, Papas=5kg, Sal=2kg, Aceite=3lt
# Migration es idempotente (corre múltiples veces sin duplicar).
```

### Lo que el qa-expert hace

1. Carga este plan como contexto
2. Para cada test:
   - Lee pre-condiciones
   - Usa `browser_navigate` para cargar la página
   - Usa `browser_click`, `browser_type`, `browser_select_option` para interactuar
   - Usa `browser_assert_text` o screenshots para verificar
   - Captura screenshots en pasos clave
3. Al final:
   - Resumen de pass/fail
   - Screenshots organizados por test
   - Issues encontrados con severidad

### Formato de output esperado del qa-expert

```markdown
# Resultados E2E — pos-pyme

## Resumen
- Total: 47 tests
- Pasados: 45 (96%)
- Fallados: 2
- Críticos: 1

## Por suite

### web-worker (Suite A)
- ✅ A1.1 Login válido
- ✅ A1.2 Login con email inválido
- ❌ A2.1 Abrir con monto válido (ver screenshot-fail.png)
- ✅ A3.1 Carga catálogo
- ✅ A4.1 Venta 100% efectivo
- ✅ A4.6 Descontar stock post-venta
- ... (32 más)

### web-admin (Suite B)
- ✅ B1.1 Login admin válido
- ❌ B3.8 Exportar CSV (botón no responde)
- ... (16 más)

### Multi-tenant (Suite C)
- ✅ C1.1 User A no ve productos de B
- ✅ C1.2 User A no ve shifts de B
- ✅ C1.4 Impersonation bloqueada (CRITICAL — fix 0008 funciona)
- ... (3 más)

### Auth (Suite D)
- ✅ D1.3 Token inválido rechazado

### Performance (Suite E)
- ⚠️ E1 Tiempo de login: 2.4s (objetivo <3s) ✅
- ⚠️ E2 Tiempo de carga POS: 1.8s (objetivo <2s) ✅

### A11y (Suite F)
- ✅ F3 Labels asociados
- ⚠️ F2 Touch targets POS: 3 botones <44px (ver detalles)

## Issues críticos

1. **CRITICAL** A2.1: Abrir turno con $20.000 falla con error 500
   - Ver: docs/TEST_PLAN.md#A2.1
   - Screenshot: qa-runs/A2.1-fail.png
   - Sugerencia: revisar network tab, posible RLS issue en /shifts/insert

2. **HIGH** B3.8: Botón "Exportar CSV" no responde al click
   - Ver: docs/TEST_PLAN.md#B3.8
   - Posible causa: falta onClick handler o bug en downloadCSV()
```

---

## Criterios de éxito

Para considerar el plan **PASADO**:

- ✅ Tests `critical` y `high`: **100%** passing
- ✅ Tests `medium`: >= **90%** passing (issues aceptables como deuda técnica)
- ✅ Tests `low`: >= **70%** passing (best-effort)
- ⚠️ Tests `perf` con métricas dentro de umbrales
- ⚠️ Tests `a11y` con axe-core sin violaciones `critical`

Para considerar el plan **BLOQUEANTE** (no se puede mergear):

- ❌ Cualquier test `critical` falla (incluye Suite C de seguridad)
- ❌ Tests `high` con regresiones vs baseline

---

## Re-ejecución

Este plan se re-ejecuta:

- ✅ En cada PR (via GitHub Actions, idealmente Playwright como step)
- ✅ Antes de cada release
- ✅ Después de migraciones a Supabase
- ✅ Trimestral como auditoría

## Próximos pasos (después de este plan)

1. Convertir tests manuales a tests Playwright automatizados (`tests/e2e/*.spec.ts`)
2. Integrar con `coverage.yml` workflow
3. Visual regression testing con Percy/Chromatic
4. Load testing con k6 o Artillery