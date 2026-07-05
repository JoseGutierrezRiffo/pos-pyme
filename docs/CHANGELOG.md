# Changelog

Todos los cambios notables de pos-pyme se documentan acá.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/),
y este proyecto sigue [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-07-05

### Added

- **Backend (NestJS 10)**
  - Auth JWT contra Supabase (`/auth/me`, `/auth/login`, guards `JwtAuthGuard` + `RolesGuard`)
  - 8 módulos: auth, businesses, products, sales, shifts, stock-movements, ingredients, notifications
  - Multi-tenant via `business_members` + RLS (migration 0005/0006)
  - 9 migrations SQL (0001-0009): schema inicial, multi-tenant, recipes, RLS impersonation fix, seeds

- **Frontend (Vite + React 18)**
  - `apps/web-admin` (5173): Dashboard, Calendar, Products, Notifications, Login
  - `apps/web-worker` (5174): Login, OpenShift, POS, CloseShift, ColacionScreen, ProfileSlideover
  - Tailwind CSS, Jotai state, react-router-dom
  - Service Worker PWA (web-worker)

- **Packages compartidos**
  - `@pos-pyme/business-rules`: cash reconciliation, formatCLP, inventory classification (98.8% coverage)
  - `@pos-pyme/validation`: 7 schemas Zod compartidos FE↔BE (Login, Shift, Sale, Product, etc.)
  - `@pos-pyme/supabase-types`: tipos de DB

- **Quality**
  - ESLint 9 (flat config) + Prettier
  - Vitest 2 con 89 unit tests (45 + 32 + 12 smoke)
  - Playwright con 12 E2E tests (worker + admin)
  - 2 GitHub Actions workflows: CI (quality gates + security audit) + E2E (manual)

- **Documentación**
  - `docs/PRD.md` — Product Requirements Document
  - `docs/CI.md` — Setup de CI/CD
  - `docs/TEST_PLAN.md` — Plan de pruebas E2E (47 tests, 6 suites)
  - `docs/templates/PERSONA.md` — Plantilla de user persona
  - `agent-harness/specs/pos-pyme/ui/` — Specs de UI para agente harness

- **CI/CD**
  - Auto-push al push: lint + typecheck + build + unit tests
  - Manual: E2E con Playwright (requiere Supabase)
  - Branch protection-friendly: todo se valida en PR

### Security

- **Migration 0008** fixea RLS impersonation: `sales_member_write` permitía
  a cualquier member del business insertar ventas con `user_id` de otro.
  Ahora `sales_self_write` exige `user_id = auth.uid()`.
- **EmailTestController** (development only) escapaba HTML de `message`.
  Ahora escapa HTML y requiere `NODE_ENV !== 'production'`.
- **10 `pnpm.overrides`** resuelven deps vulnerables transitivas (vitest 3.2.6, glob 10.5+, multer 2.2+, etc.)

### Notes

Este es el primer MVP funcional. La seed de recipes (migration 0009) debe
aplicarse después de las migrations 0001-0008 para que `available_portions`
no sea null. Ver `docs/CI.md` y `docs/TEST_PLAN.md`.

[Unreleased]: https://github.com/JoseGutierrezRiffo/pos-pyme/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/JoseGutierrezRiffo/pos-pyme/releases/tag/v0.1.0
