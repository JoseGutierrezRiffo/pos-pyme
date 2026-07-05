# POS Pyme

[![CI](https://github.com/USER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/USER/REPO/actions/workflows/ci.yml)

Sistema de inventario, turnos y caja para micro-PYMEs.

## 🏗️ Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + Jotai
- **Backend**: NestJS 10 (TypeScript)
- **DB + Auth**: Supabase (PostgreSQL)
- **Monorepo**: pnpm workspaces + Turborepo
- **Validation**: Zod (compartido FE/BE)
- **Type safety**: Tipos generados desde Supabase

## 📁 Estructura

```
.
├── apps/
│   ├── api/            # NestJS backend
│   ├── web-admin/      # React: Portal Administrador
│   └── web-worker/     # React: Portal POS Trabajador (PWA)
├── packages/
│   ├── business-rules/ # Lógica de negocio (cuadre, formato CLP)
│   ├── validation/     # Esquemas Zod compartidos
│   ├── supabase-types/ # Tipos auto-generados desde Supabase
│   └── ui/             # Componentes compartidos
├── supabase/
│   └── migrations/     # Migraciones SQL
└── obsidian/           # Vault de conocimiento (PRD, personas, casos)
```

## 🚀 Setup

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales de Supabase
```

### 3. Aplicar migrations (incluye seeds) a Supabase

Con Supabase CLI (requiere Docker solo para `db start` local; `db push` contra remoto no lo necesita):

```bash
pnpm setup:db
# Aplica migrations/0001..0009 en orden, incluyendo:
#   - schema inicial, multi-tenant, RLS impersonation fix
#   - 0009_seed_recipes_and_ingredients.sql (idempotente)
```

Alternativa manual (sin CLI):
1. Ir a https://supabase.com/dashboard → tu proyecto
2. SQL Editor → New Query
3. Pegar y correr `supabase/migrations/0001_initial_schema.sql` hasta `0009_seed_recipes_and_ingredients.sql` en orden

### 4. Generar tipos de Supabase (opcional)

```bash
pnpm gen:types
```

### 5. Levantar todo en dev

```bash
pnpm dev
```

Esto levanta:

- API en http://localhost:3000
- Web Admin en http://localhost:5173
- Web Worker en http://localhost:5174

### 6. Tests E2E (opcional)

Requiere los 3 servers corriendo + Supabase con migrations aplicadas.

```bash
# Setup env (automatiza: cierra shift abierto, configura credenciales)
set -a && source tests/e2e/.env.local && set +a

# Correr todos los tests (12 tests, ~40s)
pnpm test:e2e

# Solo un test específico
pnpm test:e2e -g "A4.1"
```

## 📜 Scripts

| Script                       | Descripción                                       |
| ---------------------------- | ------------------------------------------------- |
| `pnpm dev`                   | Levanta todas las apps en paralelo                |
| `pnpm build`                 | Build de producción de todo                       |
| `pnpm test`                  | Corre tests en todos los packages                 |
| `pnpm test:coverage`         | Tests + reporte de cobertura                      |
| `pnpm lint`                  | Lint en todo el monorepo                          |
| `pnpm typecheck`             | Verifica tipos TypeScript                         |
| `pnpm format`                | Aplica Prettier a todo el código                  |
| `pnpm gen:types`             | Regenera tipos desde Supabase                     |
| `pnpm audit`                 | Auditoría de seguridad de dependencias            |
| `pnpm clean`                 | Limpia node_modules y builds                      |

## 🧪 Crear primer usuario admin

1. Supabase Dashboard → Authentication → Users → Add user
2. Crear con email/password
3. SQL Editor:
   ```sql
   insert into public.profiles (id, email, full_name, role)
   values ('UUID_DEL_USUARIO', 'admin@demo.com', 'Doña Rosa', 'admin');
   ```

## 📚 Documentación

- **PRD**: `obsidian/02_PRD/PRD_Master.md`
- **Reglas de negocio**: definidas en `packages/business-rules/`
- **Plantillas Obsidian**: `obsidian/99_Templates/`
- **CI/CD**: [`docs/CI.md`](docs/CI.md) — workflows de GitHub Actions

## ✅ Quality Gates

CI corre automáticamente en cada PR y push a `master` (workflow `.github/workflows/ci.yml`):

| Gate           | Comando         | Estado                                                     |
| -------------- | --------------- | ---------------------------------------------------------- |
| Typecheck      | `pnpm typecheck` | ✅ 9/9 workspaces                                          |
| Lint           | `pnpm lint`     | ✅ 6/6 workspaces (0 errors, ~38 warnings baseline)         |
| Build          | `pnpm build`    | ✅ 6/6 workspaces                                          |
| Test           | `pnpm test`     | ✅ 89 unit tests (45+32+12)                                |
| E2E (opcional) | `pnpm test:e2e` | ✅ 12 tests Playwright (requiere secrets Supabase)         |
| Coverage       | `pnpm test:coverage` | ✅ 98.8% en `@pos-pyme/business-rules`                  |
