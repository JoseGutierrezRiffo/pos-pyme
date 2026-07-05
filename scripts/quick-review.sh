#!/usr/bin/env bash
# quick-review.sh — genera un prompt de code review con el diff actual
#
# Uso:
#   bash scripts/quick-review.sh              # diff staged + unstaged
#   bash scripts/quick-review.sh --staged     # solo staged (pre-commit)
#   bash scripts/quick-review.sh --unpushed  # vs origin/main (pre-push)
#   bash scripts/quick-review.sh --branch feature/foo   # vs base branch
#
# El script imprime el prompt en stdout. Pegalo en opencode con el agente
# qa-expert para revisión.
#
# Exit codes:
#   0 = hay diff para revisar
#   1 = no hay diff (working tree limpio)
#   2 = no estamos en un repo git

set -e

# Parse args
MODE="working"
BASE_BRANCH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --staged)    MODE="staged"; shift ;;
    --unpushed)  MODE="unpushed"; shift ;;
    --working)   MODE="working"; shift ;;
    --branch)    MODE="branch"; BASE_BRANCH="$2"; shift 2 ;;
    --base)      MODE="base"; BASE_BRANCH="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 3 ;;
  esac
done

# Verify git
git rev-parse --is-inside-work-tree > /dev/null 2>&1 || {
  echo "❌ No estás en un repo git"
  exit 2
}

# Get diff based on mode
case "$MODE" in
  working)
    DIFF=$(git diff HEAD 2>/dev/null)
    WHAT="working tree (unstaged + staged)"
    ;;
  staged)
    DIFF=$(git diff --cached HEAD 2>/dev/null)
    WHAT="staged changes"
    ;;
  unpushed)
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    DIFF=$(git diff origin/$BRANCH...HEAD 2>/dev/null || git diff main...HEAD 2>/dev/null || echo "")
    WHAT="commits unpushed en $BRANCH"
    ;;
  branch)
    [[ -z "$BASE_BRANCH" ]] && BASE_BRANCH="master"
    DIFF=$(git diff $BASE_BRANCH...HEAD 2>/dev/null)
    WHAT="diff vs $BASE_BRANCH"
    ;;
  base)
    [[ -z "$BASE_BRANCH" ]] && BASE_BRANCH="main"
    DIFF=$(git diff $BASE_BRANCH 2>/dev/null)
    WHAT="diff vs $BASE_BRANCH (working tree)"
    ;;
esac

if [[ -z "$DIFF" ]]; then
  echo "ℹ️  No hay diff para revisar ($WHAT)"
  exit 1
fi

# Get context info
PROJECT_NAME=$(basename "$(git rev-parse --show-toplevel)")
BRANCH=$(git rev-parse --abbrev-ref HEAD)
FILES_CHANGED=$(echo "$DIFF" | grep -c '^diff --git' || true)
LINES_ADDED=$(echo "$DIFF" | grep -c '^+' || true)
LINES_REMOVED=$(echo "$DIFF" | grep -c '^-' || true)

# Print the prompt
cat <<PROMPT
# Code Review Request — ${PROJECT_NAME}

## Contexto
- Branch: \`${BRANCH}\`
- Tipo de cambio: ${WHAT}
- Archivos cambiados: ${FILES_CHANGED}
- Lineas: +${LINES_ADDED} / -${LINES_REMOVED}

## Diff
\`\`\`diff
${DIFF}
\`\`\`

## Instrucciones para vos (qa-expert agent)
Revisá este diff como si fueras un senior engineer revisando un PR. Buscá:

1. **Bugs lógicos** — race conditions, off-by-one, null pointer, validaciones faltantes
2. **Seguridad** — XSS, SQL injection, secrets hardcodeados, auth bypass
3. **Performance** — N+1 queries, re-renders innecesarios, missing keys
4. **Type safety** — any sin razón, casts que podrían ser type guards
5. **Errores que se le escaparian al CI** — el CI corre typecheck/lint/build/test, no detecta lógica incorrecta
6. **Mala prácticas del codebase** — convenciones de naming, patrones del proyecto (mirar archivos similares)
7. **Tests faltantes** — para código nuevo o modificado
8. **Documentación** — comentarios solo donde el código no se explica solo

**Contexto del proyecto:**
- Monorepo: pnpm + Turborepo
- Frontend: Vite + React 18 + Jotai + Tailwind
- Backend: NestJS 10 + Zod (validation) + Supabase
- Tests: Vitest unit, Playwright E2E
- Conventional commits (feat/fix/feat!)

## Output esperado
Para cada issue encontrado:
- Severidad: critical / high / medium / low
- Archivo y línea
- Por qué es un problema
- Sugerencia de fix concreto

Si está todo OK, decí "✅ LGTM" con 1-2 cosas que destacarías del cambio.
PROMPT

echo ""
echo "─────────────────────────────────────────────────────────"
echo "📋 Prompt generado. Para revisarlo:"
echo ""
echo "  1. Abrí opencode con el agente qa-expert"
echo "  2. Pegá el prompt de arriba"
echo "  3. Aplicá las sugerencias que te parezcan razonables"
echo ""
echo "💡 Tip: bash scripts/quick-review.sh --unpushed  (pre-push)"
echo "💡 Tip: bash scripts/quick-review-llm.sh  (auto, si tenés opencode CLI)"
echo "─────────────────────────────────────────────────────────"
