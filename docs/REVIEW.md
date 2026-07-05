# Code Review local (sin costo)

> Workflow para un solo integrante que quiere "revisión senior" sin pagar
> Copilot o CodeRabbit. Usa el agente `qa-expert` (M2.7) de opencode local.

## TL;DR

```bash
# Antes de cada commit (manual):
bash scripts/quick-review.sh --staged > prompt.md
# Abrí opencode con el agente qa-expert, pegá el prompt, recibí feedback

# O automático (si tenés opencode CLI):
bash scripts/quick-review-llm.sh
# Espera ~30-60s y mostrara el review en TUI

# Setup una vez:
git config core.hooksPath .githooks   # activa el reminder pre-commit
```

## Flujo diario

```
1. Hacés cambios en tu branch
2. git add + git diff (revisás visualmente)
3. bash scripts/quick-review.sh
   → genera un prompt con tu diff + contexto del proyecto
   → pegás en opencode con el agente qa-expert
   → recibís el review (~30s)
4. Aplicás las sugerencias que te parezcan razonables
5. git commit (con reminder si dejaste el hook activo)
6. git push → CI corre (typecheck, lint, build, test)
7. Creás PR → mergeás
```

## Scripts

### `scripts/quick-review.sh` (manual, siempre funciona)

Genera un prompt con el diff actual y lo imprime. Pegás el prompt en
opencode manualmente.

```bash
# Formas de invocación
bash scripts/quick-review.sh              # diff working tree
bash scripts/quick-review.sh --staged     # solo staged
bash scripts/quick-review.sh --unpushed  # vs origin/main (recomendado pre-push)
bash scripts/quick-review.sh --branch feature/foo
bash scripts/quick-review.sh --base master
```

Output: prompt formateado con secciones (Contexto, Diff, Instrucciones, Output esperado).

### `scripts/quick-review-llm.sh` (auto, requiere opencode CLI)

Ejecuta el agente qa-expert sobre el diff. Muestra el review en TUI.

```bash
bash scripts/quick-review-llm.sh
```

Si no tenés opencode CLI, el script sugiere instalar o usar `quick-review.sh` manualmente.

**Nota:** el output sale en TUI con escape codes. Si querés output limpio:
```bash
bash scripts/quick-review-llm.sh 2>&1 | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' | tail -50
```

### Pre-commit hook (opcional)

Activa el reminder automático en cada commit:
```bash
git config core.hooksPath .githooks
```

El hook `.githooks/pre-commit`:
- Detecta si hay cambios de código
- Imprime el mensaje con los comandos para correr review
- **NO bloquea** el commit (solo es un reminder)
- Para skipear: `git commit --no-verify`
- Para desactivar para siempre: `git config core.hooksPath /dev/null`

## Limitaciones (honestas)

| | Limitación | Mitigación |
|---|-----------|-----------|
| 1 | El agente es el mismo modelo que escribe código (M2.7). No es estrictamente un "senior" independiente. | Pedíle explícitamente "buscá issues que el autor pasó por alto". Mismas alucinaciones posibles. |
| 2 | Detecta mejor issues de sintaxis/lógica que de arquitectura | Para arquitectura, contratá 1h/mes de un freelancer. Para lógica, este workflow es suficiente. |
| 3 | Falsos positivos: el agente puede señalar cosas que no son problemas reales | Vos decidís qué aplicar y qué descartar. El review es una sugerencia, no un veredicto. |
| 4 | Sin contexto de runtime: el agente solo ve código, no el comportamiento | Para tests de runtime, usar el flujo E2E (`pnpm test:e2e`). |
| 5 | El script LLM usa TUI, no output plain-text | Workaround: pipe a `sed` para limpiar escape codes. |

## Cuándo es suficiente vs cuándo no

**Suficiente para:**
- Linting lógico (off-by-one, null checks, validaciones faltantes)
- Detección de secrets hardcodeados
- Verificación de naming consistente
- Catch de imports rotos
- Confirmar que los tests cubren los casos nuevos
- Catch de TODOs olvidados

**No suficiente para (necesitás humano o Copilot Pro):**
- Decisiones de arquitectura (qué patrón usar)
- Naming a nivel de producto (qué nombre le pongo a esta feature)
- Trade-offs de UX (¿debería ser modal o página nueva?)
- Compliance / regulatory (GDPR, accessibility WCAG, etc.)
- Performance a nivel de carga (requiere testing real con k6)

## Comparación con alternativas pagas

| | Este workflow | Copilot Pro | CodeRabbit | Senior freelancer |
|---|---|---|---|---|
| **Costo** | $0 | $10/mes | $0-15/mes (tier free) | $50-200/hr |
| **Setup** | 1 min | 5 min (activar Copilot + instalar app) | 5 min | horas buscando |
| **Velocidad por PR** | 30-60s | 30s | 60s | horas-días |
| **Detecta bugs lógicos** | bueno | muy bueno | muy bueno | excelente |
| **Detecta arquitectura** | regular | bueno | muy bueno | excelente |
| **Falsos positivos** | frecuentes | pocos | pocos | raros |
| **Sesgo** | ninguno | sesgo del modelo | sesgo del modelo | experiencia |

Para un proyecto personal, **este workflow es más que suficiente**. Si en algún momento el proyecto crece (equipo, tráfico, monetización), considerá Copilot Pro.

## Configuración del opencode.jsonc

El `qa-expert` agent vive en:
```
agent-harness/agents/qa-expert/
├── agent.json
├── system-prompt.md
└── skills/
```

Para que opencode lo encuentre, agregalo a `~/.config/opencode/opencode.jsonc`:
```json
{
  "agents": {
    "qa-expert": "/path/to/agent-harness/agents/qa-expert"
  }
}
```

(O el agent puede estar en `~/.config/opencode/agents/qa-expert/` directamente.)
