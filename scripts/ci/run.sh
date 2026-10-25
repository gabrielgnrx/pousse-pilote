#!/usr/bin/env bash
# Lance une étape de CI. En cas d'échec, la fin de la sortie est publiée en annotations GitHub
# (lisibles sans ouvrir les journaux), découpée en morceaux de 3 000 caractères au plus.
set -uo pipefail
name="$1"
shift
log="$(mktemp)"
"$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
if [ "$status" -ne 0 ]; then
  tail -c 27000 "$log" | node -e '
    const name = process.argv[1];
    let s = require("fs").readFileSync(0, "utf8");
    s = s.replace(/\x1b\[[0-9;]*m/g, "");
    const esc = (t) => t.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
    const parts = [];
    for (let i = 0; i < s.length; i += 3000) parts.push(s.slice(i, i + 3000));
    parts.slice(-9).forEach((p, i, a) => console.log(`::error title=${name} ${i + 1}/${a.length}::${esc(p)}`));
  ' "$name"
fi
exit "$status"
