#!/usr/bin/env bash
# Recommite sur la branche les fichiers régénérés par la CI (verrouillage npm, types Supabase).
set -euo pipefail
files=(package-lock.json src/lib/supabase/database.types.ts)
existing=()
for f in "${files[@]}"; do [ -e "$f" ] && existing+=("$f"); done
if [ -z "$(git status --porcelain -- "${existing[@]}")" ]; then
  echo "Rien à recommiter."
  exit 0
fi
git config user.name "pousse-ci"
git config user.email "ci@pousse.invalid"
git add -- "${existing[@]}"
git commit -m "chore: fichiers générés à jour (CI)"
git push origin "HEAD:${GITHUB_REF_NAME}"
