#!/usr/bin/env bash
# Fail le build si la couverture descend sous les seuils minimum définis ici.
#
# Les seuils sont délibérément un peu en dessous du niveau actuel pour ne pas
# exploser au moindre ajout de code non testé, tout en empêchant une régression
# significative. Les ajuster à la hausse au fil du temps.

set -euo pipefail

root="$(pwd)"

check() {
  local label="$1"
  local summary_path="$2"
  local min_lines="$3"
  local min_statements="$4"
  local min_branches="$5"
  local min_functions="$6"

  if [[ ! -f "$summary_path" ]]; then
    echo "::warning::No coverage summary for ${label} at ${summary_path}"
    return 0
  fi

  node - <<JS
const s = require('${summary_path}').total;
const checks = [
  ['lines',      s.lines.pct,      ${min_lines}],
  ['statements', s.statements.pct, ${min_statements}],
  ['branches',   s.branches.pct,   ${min_branches}],
  ['functions',  s.functions.pct,  ${min_functions}],
];
let failed = false;
for (const [name, actual, min] of checks) {
  const ok = actual >= min;
  const symbol = ok ? '✅' : '❌';
  console.log(\`${label} \${name.padEnd(10)} \${actual.toFixed(1)}% (min \${min}%)  \${symbol}\`);
  if (!ok) failed = true;
}
if (failed) {
  console.error('::error::Coverage threshold failed for ${label}');
  process.exit(1);
}
JS
}

# Seuils choisis en-dessous du niveau actuel — à remonter progressivement
check "apps/api"         "${root}/coverage/apps/api/coverage-summary.json"         60 60 40 55
check "apps/web"         "${root}/coverage/apps/web/coverage-summary.json"         15 15  8 20
check "libs/game-engine" "${root}/coverage/libs/game-engine/coverage-summary.json" 95 95 80 95

echo ""
echo "🎯 All coverage thresholds met."
