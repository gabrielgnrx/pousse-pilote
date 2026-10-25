#!/usr/bin/env bash
# Génère src/lib/supabase/database.types.ts depuis une base locale rejouée à partir des migrations
# (aucun accès au projet Supabase de production n'est nécessaire). Demande Docker (Supabase CLI).
# Connexion : variables PG* habituelles ; la base pousse_types est recréée.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=pousse_types
psql -d postgres -qc "drop database if exists $DB" >/dev/null
psql -d postgres -qc "create database $DB" >/dev/null
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/supabase_stub.sql >/dev/null
for f in supabase/migrations/*.sql; do
  if head -1 "$f" | grep -q "Supabase seulement"; then continue; fi
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done
url="postgresql://${PGUSER:-postgres}:${PGPASSWORD:-postgres}@${PGHOST:-localhost}:${PGPORT:-5432}/$DB"
out=src/lib/supabase/database.types.ts
{
  echo "// Fichier généré par scripts/db-types.sh (npm run db:types) : ne pas modifier à la main."
  npx --yes supabase@latest gen types typescript --db-url "$url" --schema public
} > "$out.tmp"
mv "$out.tmp" "$out"
echo "Types écrits dans $out"
