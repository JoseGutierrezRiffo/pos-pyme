#!/usr/bin/env bash
# quick-review-llm.sh — corre el agente qa-expert sobre el diff actual
#
# Requiere: opencode CLI instalado (brew install opencode o similar)
#           y al menos un diff staged o unstaged
#
# Uso:
#   bash scripts/quick-review-llm.sh           # diff working tree
#   bash scripts/quick-review-llm.sh --staged   # solo staged
#   bash scripts/quick-review-llm.sh --unpushed # vs origin/main
#
# Output: el review del agente, formateado.

set -e

# Check opencode available
if ! command -v opencode >/dev/null 2>&1; then
  echo "❌ opencode CLI no encontrado en PATH"
  echo ""
  echo "Opciones:"
  echo "  1. Instalar opencode: https://opencode.ai"
  echo "  2. Usar bash scripts/quick-review.sh y pegar el prompt manualmente"
  exit 1
fi

# Get the diff and the prompt
DIFF_OUTPUT=$(bash "$(dirname "$0")/quick-review.sh" "$@") || {
  CODE=$?
  if [[ $CODE -eq 1 ]]; then
    echo "ℹ️  No hay diff para revisar"
    exit 1
  fi
  exit $CODE
}

# Extract just the prompt portion (between "# Code Review Request" and end of cat block)
PROMPT=$(echo "$DIFF_OUTPUT" | awk '/^# Code Review Request/{p=1} /^PROMPT$/{p=0} p')

if [[ -z "$PROMPT" ]]; then
  echo "❌ No pude extraer el prompt del output"
  exit 1
fi

echo "🤖 Ejecutando qa-expert agent sobre el diff..."
echo "(esto puede tardar 30-60 segundos)"
echo ""

# Run opencode in non-interactive mode
# Note: opencode CLI uses --prompt for non-interactive prompts
opencode \
  --agent qa-expert \
  --prompt "$PROMPT" 2>&1
