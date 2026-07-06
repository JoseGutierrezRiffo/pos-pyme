#!/usr/bin/env bash
# audit-analysis.sh — genera agent-harness/audits/patterns.md
# a partir de agent-harness/audits/reviews/*.md
#
# Uso:
#   bash agent-harness/scripts/audit-analysis.sh
#   bash agent-harness/scripts/audit-analysis.sh --since 30   # últimos 30 días
#
# Output: agent-harness/audits/patterns.md (siempre, sobrescribe)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HARNESS_DIR="$(dirname "$SCRIPT_DIR")"
REVIEWS_DIR="$HARNESS_DIR/audits/reviews"
OUTPUT="$HARNESS_DIR/audits/patterns.md"

# Args
SINCE_DAYS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --since) SINCE_DAYS="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [ ! -d "$REVIEWS_DIR" ] || [ -z "$(ls -A "$REVIEWS_DIR" 2>/dev/null)" ]; then
  echo "ℹ️  No hay reviews en $REVIEWS_DIR"
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ Necesita python3 instalado"
  exit 1
fi

# Pasar variables a Python via env (evita problemas de shell expansion)
export REVIEWS_DIR="$REVIEWS_DIR"
export OUTPUT="$OUTPUT"
export SINCE_DAYS="$SINCE_DAYS"

python3 <<'PYTHON'
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta

reviews_dir = os.environ["REVIEWS_DIR"]
output_path = os.environ["OUTPUT"]
since_days = int(os.environ.get("SINCE_DAYS", "0"))

# Categorías predefinidas con regex
CATEGORIES = [
    ("Race conditions",        r"race condition",                                True),
    ("N+1 queries",            r"\bn\+1\b|n\+1 query",                             True),
    ("Seguridad (XSS, SQL, etc)", r"xss|sql injection|secret|auth bypass",      True),
    ("Type safety (any)",       r"\bany\b|unsafe cast|type guard",                True),
    ("Tests faltantes",         r"test faltante|missing test|no test",             True),
    ("Mala práctica",           r"mala pr[aá]ctica|naming|convention",            True),
    ("Performance",             r"performance|n\+1|memo|re-render",                True),
    ("Error handling",          r"error handling|null|undefined|exception",       True),
]

files = sorted(os.listdir(reviews_dir))
files = [f for f in files if f.endswith(".md") and not f.startswith(".")]

# Filtra por fecha si --since fue pasado
if since_days > 0:
    cutoff = datetime.now() - timedelta(days=since_days)
    filtered = []
    for f in files:
        try:
            date_str = f[:10]
            file_date = datetime.strptime(date_str, "%Y-%m-%d")
            if file_date >= cutoff:
                filtered.append(f)
        except ValueError:
            filtered.append(f)
    files = filtered

total = len(files)
if total == 0:
    print(f"No hay reviews en los últimos {since_days} días")
    sys.exit(0)

by_severity = defaultdict(int)
by_category = defaultdict(int)
by_file = defaultdict(int)
by_status = defaultdict(int)
monthly = defaultdict(lambda: defaultdict(int))
dates = []

for f in files:
    path = os.path.join(reviews_dir, f)
    try:
        with open(path) as fh:
            content = fh.read()
    except Exception:
        continue

    dates.append(f[:10])
    month_key = f[:7]

    for sev in ["critical", "high", "medium", "low"]:
        count = len(re.findall(rf"\[{sev}\]", content, re.IGNORECASE))
        if count > 0:
            by_severity[sev] += count
            monthly[month_key][sev] += count

    content_lower = content.lower()
    for cat, pattern, _ in CATEGORIES:
        if re.search(pattern, content_lower):
            by_category[cat] += 1

    for m in re.finditer(r"(?:File|path|archivo)[:\s]+([^\s:]+\.[a-z]+)(?::\d+)?", content):
        by_file[m.group(1)] += 1

# Generar output
output = f"""# Patrones recurrentes (auto-generado)

Última actualización: {datetime.now().isoformat()[:19]}
Total reviews analizadas: {total}
Período: {min(dates) if dates else "N/A"} → {max(dates) if dates else "N/A"}

## Por severidad

| Severidad | Count |
|---|---|
| Critical | {by_severity['critical']} |
| High     | {by_severity['high']} |
| Medium   | {by_severity['medium']} |
| Low      | {by_severity['low']} |
| **Total**   | **{sum(by_severity.values())}** |

## Por categoría

| Categoría | Count |
|---|---|
"""

for cat, _, _ in CATEGORIES:
    output += f"| {cat} | {by_category[cat]} |\n"

output += "\n## Por archivo (top 10)\n\n| Archivo | Issues |\n|---|---|\n"
for f, n in sorted(by_file.items(), key=lambda x: -x[1])[:10]:
    output += f"| `{f}` | {n} |\n"

if monthly:
    output += "\n## Por mes (tendencia)\n\n| Mes | Critical | High | Medium | Low | Total |\n|---|---|---|---|---|---|\n"
    for month in sorted(monthly.keys()):
        sev = monthly[month]
        total_m = sum(sev.values())
        output += f"| {month} | {sev['critical']} | {sev['high']} | {sev['medium']} | {sev['low']} | {total_m} |\n"

# Reglas aprendidas
if by_category:
    top = sorted(by_category.items(), key=lambda x: -x[1])[:3]
    output += "\n## Reglas aprendidas (sugeridas)\n\n"
    rules = {
        "Race conditions": "Cuando agregás useEffect con fetch, cleanup con AbortController",
        "N+1 queries": "Para listados con N sub-requests, usar Promise.all o batch endpoints",
        "Type safety (any)": "Evitar `any` — usar tipos específicos o unknown + narrowing",
        "Tests faltantes": "Para flujos críticos (auth, payment), testear antes de mergear",
        "Mala práctica": "Seguir convenciones del codebase — leer archivos similares primero",
    }
    for cat, n in top:
        if cat in rules:
            output += f"- {rules[cat]} (detectado {n}x)\n"

output += "\n---\n\n"
output += "Regenerar: `bash agent-harness/scripts/audit-analysis.sh`\n"
output += "Con filtro: `bash agent-harness/scripts/audit-analysis.sh --since 30`\n"

with open(output_path, "w") as f:
    f.write(output)

print(f"Generado {output_path}")
print(f"  Total reviews: {total}")
print(f"  Total issues: {sum(by_severity.values())}")
if by_category:
    print(f"  Top categoria: {sorted(by_category.items(), key=lambda x: -x[1])[0]}")
PYTHON
