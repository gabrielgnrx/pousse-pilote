#!/usr/bin/env bash
# Rejoue toutes les migrations et les scénarios SQL sur des bases PostgreSQL 16 neuves (sans Supabase,
# avec une imitation minimale de l'authentification et du stockage : supabase/tests/supabase_stub.sql).
# Connexion : variables PG* habituelles (PGHOST, PGUSER, PGPASSWORD…).
#
# Chaque scénario se joue juste après la migration qu'il teste, sur la même base : les données
# s'accumulent d'un scénario à l'autre. Les scénarios historiques forment deux chaînes indépendantes
# (ils ont été écrits ainsi), jouées sur deux bases. Les scénarios v2 se nomment
# supabase/tests/v2_<numéro de migration>_*.sql et se jouent dans la chaîne principale.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp)"

run() {
  local db="$1" f="$2"
  # Les migrations marquées « Supabase seulement » (pg_cron, Vault…) ne se jouent pas hors Supabase.
  if head -1 "$f" | grep -q "Supabase seulement"; then
    echo "ignorée (Supabase seulement) : $f"
    return
  fi
  psql -d "$db" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>"$tmp" || {
    echo "ÉCHEC ($db) : $f"
    cat "$tmp"
    exit 1
  }
  echo "ok ($db) : $f"
}

fresh_db() {
  psql -d postgres -qc "drop database if exists $1" >/dev/null
  # Les rôles sont communs à tout le serveur : on repart de zéro (le stub les recrée).
  psql -d postgres -qc "drop role if exists anon" -c "drop role if exists authenticated" >/dev/null 2>&1 || true
  psql -d postgres -qc "create database $1" >/dev/null
}

# chain <base> <fonction qui donne les scénarios à jouer après une migration>
chain() {
  local db="$1" scenarios="$2"
  fresh_db "$db"
  run "$db" supabase/tests/supabase_stub.sql
  for f in supabase/migrations/*.sql; do
    run "$db" "$f"
    local n
    n="$(basename "$f" | cut -c1-4)"
    for s in $($scenarios "$n"); do run "$db" "supabase/tests/$s.sql"; done
  done
}

first_batch="scenario scenario_engagement scenario_rappels scenario_jeu scenario_actions scenario_qg"

main_chain() {
  case "$1" in
    0013) echo "$first_batch" ;;
    0015) echo scenario_quiz ;;
    0016) echo scenario_duels ;;
    0017) echo scenario_nature ;;
    0023) echo scenario_coherence ;;
    0024) echo scenario_equite_points ;;
    0025) echo scenario_anti_triche ;;
  esac
  for s in supabase/tests/v2_"$1"_*.sql; do
    if [ -e "$s" ]; then basename "$s" .sql; fi
  done
}

reliability_chain() {
  case "$1" in
    0013) echo "$first_batch" ;;
    0018) echo scenario_fiabilite ;;
    0020) echo scenario_equite ;;
    0021) echo scenario_plusieurs ;;
    0022) echo scenario_fil ;;
  esac
}

chain pousse_test main_chain
chain pousse_test_fiabilite reliability_chain
# Les données de démo se chargent sur la base complète, et se rejouent sans rien refaire.
run pousse_test_fiabilite supabase/seed_demo.sql
run pousse_test_fiabilite supabase/seed_demo.sql
run pousse_test_fiabilite supabase/tests/seed_demo_check.sql
echo "Tous les scénarios SQL passent."
