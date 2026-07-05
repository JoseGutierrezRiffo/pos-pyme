# Deployments

> **Este archivo se actualiza automáticamente** por el workflow `release.yml`
> cada vez que se pushea un tag `v*` a GitHub.
>
> **Para deploys manuales** (preview, staging, hotfixes fuera de banda),
> editá este archivo directamente.

## Producción

| Versión | Fecha | Commit | Tag | URL | Notas |
|---------|-------|--------|-----|-----|-------|
| v0.1.0 | 2026-07-05 | `a724726` | [v0.1.0](https://github.com/JoseGutierrezRiffo/pos-pyme/releases/tag/v0.1.0) | _pendiente_ | Initial MVP — Initial release via `gh release create` |

## Staging / Preview

| Versión | Fecha | Branch | URL | Notas |
|---------|-------|---------|-----|-------|
| _vacío_  |       |         |     |       |

## Cómo deployar

### Deploy normal (release nueva)

```bash
# 1. Crear tag (el versionado se hace con release-please, pero manual funciona)
git tag -a v0.X.Y -m "release: ..."
git push --tags
# → CI workflow release.yml se dispara
# → Genera GitHub Release con artifacts
# → Actualiza este archivo
```

### Rollback

Si una versión tiene problemas críticos:

```bash
# Opción A: Rollback al tag anterior (rápido, re-deploya)
git checkout v0.1.0
./scripts/deploy.sh production  # el script que tengas

# Opción B: Hotfix forward (más limpio, preserva historial)
git checkout -b hotfix/v0.1.1 v0.1.0
# ... fix ...
git commit -m "fix: ..."
git tag v0.1.1
git push --tags

# Opción C: Revert (preserva todo el historial, agrega un commit de rollback)
git checkout production  # o master, según tu branch de deploy
git revert --no-commit v0.2.0..HEAD
git commit -m "revert: back to v0.1.1 due to issue X"
git push
# → Re-deploya automáticamente (o manual)
```

### Ver qué está corriendo

```bash
# Versión deployed en producción
git describe --tags --abbrev=0

# Ver todos los tags ordenados por fecha
git tag --sort=-creatordate | head -10

# Ver deploys históricos en este archivo
cat docs/DEPLOYMENTS.md

# Ver el último release en GitHub
gh release list --repo JoseGutierrezRiffo/pos-pyme
```

## Schema de migraciones a DB

Cada release incluye las migrations SQL en `supabase/migrations/`.
El workflow `release.yml` las aplica automáticamente al release correspondiente
(via `supabase db push` con el access token de prod).

Para verificar qué migrations están aplicadas en prod:

```sql
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

## Secretos por ambiente

| Secreto | dev | staging | prod |
|---------|-----|---------|------|
| `SUPABASE_URL` | local o dev project | dev project | prod project |
| `SUPABASE_ANON_KEY` | dev | dev | prod |
| `SUPABASE_SERVICE_ROLE_KEY` | dev | dev | prod |
| `VERCEL_TOKEN` (si deploy a Vercel) | — | staging | prod |
| `RAILWAY_TOKEN` (si deploy a Railway) | — | staging | prod |

Configurar en GitHub: Settings → Secrets and variables → Actions → New repository secret.
