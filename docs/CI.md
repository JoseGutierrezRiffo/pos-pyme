# CI/CD

> Proyecto personal: el CI valida calidad pero no deploya. Los tests E2E son opcionales (requieren Supabase real).

## Workflows

| Workflow | Trigger | Jobs | Qué hace |
|----------|---------|------|----------|
| `ci.yml` | push a master/main, PRs | `quality-gates`, `security-audit`, `summary` | Las 4 herramientas core + audit de secrets |
| `e2e.yml` | manual (`workflow_dispatch`) | `e2e` (opcional) | Tests Playwright contra Supabase real (solo si secrets configurados) |
| `release-please.yml` | push a master | auto-PR | Crea PR automático bumpeando version + actualizando CHANGELOG |
| `release.yml` | push de tag `v*` | `release` | Build artifacts + GitHub Release + actualiza DEPLOYMENTS.md |

## Versionado y releases

### Conventional commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/) para que release-please sepa qué tipo de bump aplicar:

| Prefijo | Bump | Ejemplo |
|---------|------|---------|
| `feat:` | minor (0.1.0 → 0.2.0) | `feat: agregar módulo de inventario` |
| `fix:` | patch (0.1.0 → 0.1.1) | `fix: RLS impersonation en sales` |
| `feat!:` o `BREAKING CHANGE:` | major (0.x.0 → 1.0.0) | `feat!: cambiar a Supabase v3 API` |
| `chore:`, `docs:`, `test:`, `refactor:`, `ci:` | ninguno | `docs: actualizar README` |

### Flujo de release

```
1. Hacés cambios en feature branch, commiteás con conventional commit
2. Mergeás PR a master → CI corre (quality gates)
3. release-please.yml detecta commits releasables
4. Crea PR automático "chore: release v0.X.Y" con CHANGELOG actualizado
5. Vos revisás el PR, mergeás
6. Al mergear, release-please crea el tag v0.X.Y
7. release.yml se dispara con el tag:
   - Build artifacts
   - Crea GitHub Release con artifacts + notas
   - Actualiza docs/DEPLOYMENTS.md
   - (Opcional) Aplica migrations a Supabase prod
```

### Crear release manual (sin esperar a release-please)

```bash
# 1. Bump version en package.json
npm version patch  # o minor / major

# 2. Commit
git add package.json
git commit -m "chore: release v0.1.1"

# 3. Tag + push
git tag -a v0.1.1 -m "Release v0.1.1: hotfix RLS"
git push --follow-tags

# → release.yml se dispara
# → GitHub Release con artifacts
# → DEPLOYMENTS.md actualizado
```

### Rollback

3 opciones según urgencia:

```bash
# A) Hotfix forward (recomendado, preserva historial)
git checkout -b hotfix/v0.1.2 v0.1.1
# ... fix ...
git commit -m "fix: critical issue X"
git tag v0.1.2
git push --tags

# B) Rollback a tag anterior (rápido)
git checkout v0.1.1
# Re-deployar con ese tag (manual o via CI)

# C) Revert (preserva historial completo, agrega commit de rollback)
git revert --no-commit v0.2.0..HEAD
git commit -m "revert: back to v0.1.1 due to issue X"
git push
```

### Ver qué está corriendo

```bash
# Último tag
git describe --tags --abbrev=0

# Último release en GitHub
gh release list --repo JoseGutierrezRiffo/pos-pyme

# Historial completo
cat docs/DEPLOYMENTS.md
```

## Branch protection recomendado

En **Settings → Branches → Branch protection rules** para `master`:

- ✅ Require a pull request before merging
- ✅ Require approvals: 1 (si trabajás con otros)
- ✅ Require status checks to pass before merging:
  - `Quality Gates`
- ✅ Require branches to be up to date

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