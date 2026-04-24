#!/usr/bin/env bash
# Extrait un résumé markdown depuis les coverage-summary.json produits par Jest/Vitest.
#
# Usage: bash scripts/ci/coverage-summary.sh
# Output: markdown table sur stdout
set -euo pipefail

root="$(pwd)"

extract() {
  local label="$1"
  local summary_path="$2"
  if [[ ! -f "$summary_path" ]]; then
    echo "| ${label} | _no report_ | — | — | — |"
    return
  fi
  node -e "
    const s = require('${summary_path}').total;
    const fmt = (n) => n.toFixed(1).padStart(5) + '%';
    console.log(\`| ${label} | \${fmt(s.lines.pct)} | \${fmt(s.statements.pct)} | \${fmt(s.branches.pct)} | \${fmt(s.functions.pct)} |\`);
  "
}

cat <<EOF
| Projet | Lines | Statements | Branches | Functions |
|---|---:|---:|---:|---:|
EOF

extract "apps/api"       "${root}/coverage/apps/api/coverage-summary.json"
extract "apps/web"       "${root}/coverage/apps/web/coverage-summary.json"
extract "libs/game-engine" "${root}/coverage/libs/game-engine/coverage-summary.json"
