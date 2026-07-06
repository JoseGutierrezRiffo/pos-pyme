# Auditorías de Code Review

Este directorio guarda el feedback de las reviews de código automatizadas
por el qa-expert agent. Es para el **agente**, no para humanos (excepto
cuando hacés una auditoría agregada).

## Quién crea

La skill `qa-commit-review` del qa-expert agent. Después de cada review
interactivo, pregunta si querés registrar el feedback. Si decís sí,
crea un archivo acá.

## Convenciones

### Naming de archivos

`reviews/YYYY-MM-DD-<short-sha>.md`

- **YYYY-MM-DD**: fecha del review (no del commit)
- **short-sha**: 7 chars del SHA (lo que muestra `git log` por default)
- **Full SHA**: 40 chars, va adentro del archivo en la sección "Meta"

Ejemplos:
- `reviews/2026-07-05-1821ace.md`
- `reviews/2026-07-05-4eda0ab.md`

### Schema de cada review

```markdown
# Review: <short-sha> — <branch> — <date>

## Meta
- SHA: <full sha, 40 chars>
- Branch: <branch>
- Commit message: <message>
- Files changed: <count> (+<add> -<del>)
- Author: <git user.name>
- Reviewer: qa-expert (M2.7)
- Date: <ISO timestamp>
- Duration: <Xs>

## Verdict
- 🔴 Critical: <count>
- 🟠 High: <count>
- 🟡 Medium: <count>
- 🔵 Low: <count>
- ✅ LGTM: <count areas>

## Issues

### 1. [<severity>] <título corto>
- File: <path>:<line>
- Problem: <descripción>
- Fix sugerido: <sugerencia concreta>
- Status: ⏳ pending (o ✅ fixed in <sha>)
- Fixed in: <sha del fix cuando se commitee>

### 2. ...

## Áreas aprobadas
- ✅ <lista de cosas que están bien>
```

### Cuándo se crea

- ✅ **SÍ:** Cambios de código, features nuevas, refactors, fixes no triviales
- ❌ **NO:** Cambios triviales (typos, formatting, docs, comments solos)

### Cuándo NO se crea (linkear en su lugar)

Si revisás el mismo SHA dos veces, no dupliques — linkeá a la review existente:

```markdown
# Review duplicada: abc123

Ver reviews/2026-07-05-abc123.md (la primera review).
Esta vez: ✅ LGTM
```

## Análisis agregado (opcional)

Para ver patrones recurrentes:

```bash
bash agent-harness/scripts/audit-analysis.sh
# Genera agent-harness/audits/patterns.md
```

Output esperado:
- Issues por severidad (crítico, alto, medio, bajo)
- Issues por categoría (race conditions, N+1, type safety, etc.)
- Issues por archivo (top 10 archivos con más issues)
- Tendencia temporal (mes a mes)
- Reglas aprendidas (auto-generadas desde los patterns)

## Auditoría periódica

Recomendado: correr `audit-analysis.sh` mensualmente. Cuando el
volumen crece (>50 reviews, >1MB), considerar purga selectiva:
- Mantener todos los critical/high
- Mantener últimos 6 meses de medium/low
- Mover antiguos a `archive/`

## Convexiones con el repo

Este directorio **NO** es parte del producto. Es solo para el agente.
No poner código, configs, ni nada que el proyecto necesita.

Si en algún momento crece a GitHub Issues o Linear, exportar
`reviews/*.md` y archivar este directorio.
