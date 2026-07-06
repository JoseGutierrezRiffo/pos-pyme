# AI-Project-Harness v1.0

**Generic AI Product Development Lifecycle Controller (AIPDLC)**

Sistema wrapper agent **completamente independiente** y **proyecto-agnóstico** para manejar cualquier proyecto de desarrollo de software.

---

## Tabla de Contenidos

1. [Estructura](#estructura)
2. [Agentes](#agentes)
3. [Skills](#skills)
4. [Specs](#specs)
5. [Memory](#memory)
6. [Scripts CLI](#scripts-cli)
7. [Uso](#uso)

---

## Estructura

```
agent-harness/
├── agents/                    # Agentes (uno por proyecto)
│   └── <project>/            # Agente para proyecto
│       ├── agent.json        # Config del agente
│       ├── system-prompt.md  # System prompt
│       ├── memory/           # Memoria del agente
│       │   └── session.json
│       └── skills/           # Skills específicos del agente
│
├── memory/                    # Memoria global del harness
│
├── skills/                    # Skills disponibles
│   ├── builtin/             # Skills incorporados
│   │   ├── task-management.json
│   │   ├── phase-management.json
│   │   └── code-analysis.json
│   └── custom/              # Skills custom (se crean por proyecto)
│
├── specs/                     # Especificaciones
│   ├── <project>/            # Specs del proyecto
│   │   ├── product-spec.json
│   │   ├── architecture/
│   │   ├── features/
│   │   ├── api/
│   │   └── ui/
│   └── generic/             # Specs genéricas
│
├── projects/                  # Proyectos gestionados
│   └── <project>/
│       ├── config.json
│       └── state/
│
├── core/                      # Sistema core del harness
│   ├── manifest.json
│   ├── system-prompt.md
│   └── technology-detector.json
│
├── phases/                    # Definiciones AIPDLC
│   └── definitions.json
│
├── templates/                 # Templates
│   ├── prompt-templates.json
│   └── project-types/
│
├── tools/                     # Herramientas
│   └── tool-definitions.json
│
├── scripts/                   # Scripts CLI
│   ├── create-project.js
│   ├── task-manager.js
│   ├── phase-manager.js
│   ├── sprint-manager.js
│   └── analyzer.js
│
└── state/                     # Estado global
    └── projects.json
```

---

## Agentes

Cada **proyecto tiene su propio agente** orchestrator.

### Crear un Agente

```bash
# 1. Crear carpeta del agente
mkdir -p agents/<project-name>/{memory,skills}

# 2. Crear agent.json
cat > agents/<project-name>/agent.json << 'EOF'
{
  "id": "orchestrator-<project>",
  "name": "<Project> Orchestrator Agent",
  "type": "orchestrator",
  "project": "<project>",
  "version": "1.0.0",
  "config": {
    "model": "minimax-coding-plan/MiniMax-M2.7",
    "temperature": 0.7,
    "maxTokens": 32000
  },
  "capabilities": [...]
}
EOF

# 3. Crear system-prompt.md
cat > agents/<project-name>/system-prompt.md << 'EOF'
# <Project> Orchestrator Agent

You are the Orchestrator Agent for the <Project> project.
...
EOF
```

### Estructura de un Agente

| Archivo | Propósito |
|---------|----------|
| `agent.json` | Config del agente (rol, modelo, capacidades) |
| `system-prompt.md` | System prompt con contexto del proyecto |
| `memory/` | Memoria persistente del agente |
| `skills/` | Skills específicos del agente |

---

## Skills

Skills son **capacidades específicas** que el agente puede usar.

### Tipos de Skills

| Tipo | Ubicación | Descripción |
|------|-----------|-------------|
| **builtin** | `skills/builtin/` | Skills universales del harness |
| **custom** | `skills/custom/` | Skills custom para cualquier proyecto |
| **agent** | `agents/<agent>/skills/` | Skills específicos de un agente |

### Estructura de un Skill

```json
{
  "id": "task-management",
  "name": "Task Management Skill",
  "version": "1.0.0",
  "category": "project-management",
  "description": "Habilidad para gestionar tareas",
  "commands": [
    { "name": "create-task", "description": "...", "prompt": "..." }
  ],
  "scripts": ["scripts/task-manager.js"],
  "templates": { ... }
}
```

### Skills Disponibles

| Skill | Categoría | Descripción |
|-------|-----------|-------------|
| `task-management` | project-management | CRUD de tareas y sprints |
| `phase-management` | project-management | Fases AIPDLC y quality gates |
| `code-analysis` | development | Análisis de código y calidad |

---

## Specs

Specs son **especificaciones detalladas** del proyecto.

### Estructura

```
specs/
├── <project>/              # Specs proyecto
│   ├── product-spec.json   # Spec principal del producto
│   ├── architecture/       # Decisiones de arquitectura
│   ├── features/           # Specs de features individuales
│   ├── api/                # Contratos de API
│   └── ui/                 # Especificaciones de UI/UX
│
└── generic/               # Templates/specs genéricas
```

### Crear una Spec

```bash
mkdir -p specs/<project>/<category>
cat > specs/<project>/<category>/<spec-name>.md << 'EOF'
# <Spec Name>

## Overview
...

## Details
...

## Acceptance Criteria
- [ ] ...
EOF
```

---

## Memory

### Tipos de Memoria

| Tipo | Ubicación | TTL | Propósito |
|------|-----------|-----|----------|
| **Session** | `agents/<agent>/memory/session.json` | Sesión | Contexto actual |
| **Long-term** | `memory/` | Permanente | Decisiones y learnings |
| **Project** | `projects/<project>/memory/` | Proyecto | Estado del proyecto |

### Guardar en Memoria

```bash
# Después de cada tarea, guardar en session.json
node scripts/memory.js <agent> save '{"task":"...","action":"...","result":"..."}'
```

---

## Scripts CLI

### Gestión de Tareas

```bash
node scripts/task-manager.js <project> list
node scripts/task-manager.js <project> create '{"title":"...","phase":"...","priority":"high"}'
node scripts/task-manager.js <project> complete <taskId>
node scripts/task-manager.js <project> block <taskId> <reason>
```

### Gestión de Fases

```bash
node scripts/phase-manager.js <project> status
node scripts/phase-manager.js <project> transition <phase>
node scripts/phase-manager.js <project> gate
node scripts/phase-manager.js list-phases
```

### Gestión de Sprints

```bash
node scripts/sprint-manager.js <project> list
node scripts/sprint-manager.js <project> create '{"name":"Sprint 1","startDate":"...","endDate":"..."}'
node scripts/sprint-manager.js <project> start <sprintId>
node scripts/sprint-manager.js <project> add-story '{"title":"...","points":5}'
node scripts/sprint-manager.js <project> velocity
```

### Análisis de Código

```bash
node scripts/analyzer.js <projectPath> all
node scripts/analyzer.js <projectPath> tech
node scripts/analyzer.js <projectPath> complexity
```

## Auditorías de Code Review

El qa-expert agent corre la skill `qa-commit-review` cuando vos invocás
"Revisá el último commit" o similar. Si encontrás issues, tenés la opción
de registrar el feedback en `audits/reviews/` para análisis agregado futuro.

**Para análisis agregado:**

```bash
bash scripts/audit-analysis.sh
# O con filtro:
bash scripts/audit-analysis.sh --since 30
```

Ver `audits/README.md` para convenciones.

---

## Uso

### 1. Crear un Proyecto

```bash
node scripts/create-project.js <name> <type> <path> [options]
```

### 2. Crear Agente para el Proyecto

```bash
mkdir -p agents/<name>/{memory,skills,memory}
# Editar agent.json y system-prompt.md
```

### 3. Crear Specs Iniciales

```bash
mkdir -p specs/<name>/{architecture,features,api,ui}
# Crear product-spec.json
```

### 4. Iniciar Trabajo

```bash
# Ver estado
node scripts/phase-manager.js <name> status

# Crear tareas iniciales
node scripts/task-manager.js <name> create '{"title":"...","phase":"discovery","priority":"high"}'
```

---

## Proyecto Activo

Para ver o cambiar el proyecto activo, revisa `state/projects.json` (`currentProject`).

### Ver Estado de un Proyecto

```bash
node scripts/phase-manager.js <project> status
node scripts/task-manager.js <project> list
node scripts/analyzer.js /abs/path/to/<project> tech
```

---

**El harness está listo. Los componentes se crean y gestionan en sus carpetas correspondentes.**
