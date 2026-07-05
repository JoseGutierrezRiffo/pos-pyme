# CI/CD

> Proyecto personal: el CI valida calidad pero no deploya. Los tests E2E son opcionales (requieren Supabase real).

## Workflows

| Workflow | Trigger | Jobs | Qué hace |
|----------|---------|------|----------|
| `ci.yml` | push a master/main, PRs | `quality-gates`, `security-audit`, `summary` | Las 4 herramientas core + audit de secrets |
| `e2e.yml` | igual | `e2e` (opcional) | Tests Playwright contra Supabase real (solo si secrets configurados) |

## Quality Gates (ci.yml → quality-gates job)

```yaml
- pnpm install --frozen-lockfile
- pnpm typecheck   # tsc --noEmit en los 9 workspaces
- pnpm lint        # eslint . --max-warnings 999 en los 6 workspaces
- pnpm build       # tsc / vite build según el workspace
- pnpm test        # vitest run en los 9 workspaces
```

Si alguna falla, el job falla y la PR no se puede mergear (si la rama tiene branch protection).

### Cache

Cacheamos `pnpm` store vía `actions/setup-node@v4` con `cache: pnpm`. Ahorra ~30s por run.

## Security Audit (ci.yml → security-audit job)

Solo corre en **push a master/main** (no en PRs) para evitar ruido por transitives:

1. `pnpm audit --prod --audit-level=high` — falla si hay vulnerabilidades HIGH+ en deps de producción
2. `grep` para detectar secrets hardcodeados comunes (JWTs de Supabase, `sk_live_*`, etc.)

## E2E Tests (e2e.yml — opcional)

Solo corre si el secret `E2E_SUPABASE_ANON_KEY` está configurado. Para activarlo:

1. **Settings → Secrets and variables → Actions** (en el repo de GitHub)
2. Agregar 3 secrets:
   - `E2E_SUPABASE_URL` — `https://tu-proyecto.supabase.co`
   - `E2E_SUPABASE_ANON_KEY` — anon key
   - `E2E_SERVICE_ROLE_KEY` — service_role key (solo para admin users query)
3. Push a master → corre automáticamente

### Qué hace

1. Setup pnpm + Node 20 + Playwright (descarga Chromium ~200MB)
2. Genera `tests/e2e/.env.local` con los secrets
3. Levanta el backend (`pnpm dev:api`)
4. Corre `pnpm test:e2e` (12 tests, ~40s)
5. Sube artifacts: `playwright-report/` y `test-results/`

### Si no configuras los secrets

El workflow no corre (skip silencioso vía `if: ${{ secrets.E2E_SUPABASE_ANON_KEY != '' }}`). El proyecto funciona sin esto — solo es para validar E2E en CI.

## Branch protection recomendado

En **Settings → Branches → Branch protection rules** para `master`:

- ✅ Require a pull request before merging
- ✅ Require approvals: 1 (si trabajás con otros)
- ✅ Require status checks to pass before merging:
  - `Quality Gates`
- ✅ Require branches to be up to date

## Setup en GitHub

```bash
# 1. Subir el repo a GitHub
git remote add origin https://github.com/<user>/pos-pyme.git
git push -u origin master

# 2. (Opcional) Configurar secrets para E2E en CI
#    Settings → Secrets and variables → Actions

# 3. Ver el badge en el README
#    Actions → CI → "..." → "Create status badge" → copiar markdown
```

## Debugging local

```bash
# Mismo Node
nvm use 20

# Misma versión pnpm
corepack enable && corepack prepare pnpm@8.10.2 --activate

# Mismo lockfile
pnpm install --frozen-lockfile

# Correr quality gates
pnpm typecheck && pnpm lint && pnpm build && pnpm test

# E2E (requiere Supabase + 3 servers)
set -a && source tests/e2e/.env.local && set +a
pnpm dev &
pnpm test:e2e
```

Si algún check falla localmente, va a fallar en CI. Iterá hasta que pase antes de pushear.