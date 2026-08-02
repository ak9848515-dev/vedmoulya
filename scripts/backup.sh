#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Database Backup Helper
# PR-002 / T7 — Backup & Disaster Recovery
#
# Usage:
#   bash scripts/backup.sh --db identity --out ./backups
#   bash scripts/backup.sh --db all   --out ./backups
#
# Requires: pg_dump, gzip, and the relevant *_DATABASE_URL env vars.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DB=""
OUT="backups"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db) DB="$2"; shift 2 ;;
    --db=*) DB="${1#--db=}"; shift ;;
    --out) OUT="$2"; shift 2 ;;
    --out=*) OUT="${1#--out=}"; shift ;;
    *) shift ;;
  esac
done

[[ -n "${DB:-}" ]] || { echo "Usage: bash scripts/backup.sh --db <identity|knowledge|memory|decision|execution|all> [--out dir]" >&2; exit 1; }

mkdir -p "$OUT"

services=(identity knowledge memory decision execution)

run_backup() {
  local svc="$1"
  local url_var="${svc^^}_DATABASE_URL"
  local url="${!url_var:-}"
  if [[ -z "$url" ]]; then
    echo "SKIP ${svc}: ${url_var} not set" >&2
    return 0
  fi
  local file="$OUT/${svc}-$(date +%F-%H%M%S).sql.gz"
  echo "Backing up ${svc} -> ${file}"
  pg_dump --format=custom --no-owner "$url" | gzip > "$file"
}

if [[ "$DB" == "all" ]]; then
  for svc in "${services[@]}"; do run_backup "$svc"; done
else
  run_backup "$DB"
fi

echo "Backup complete: $OUT/"
