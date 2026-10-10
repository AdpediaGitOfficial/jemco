#!/bin/sh
# Restore a backup into the running db container:  ./restore.sh backups/jemco-20261010-0200.sql.gz
# Stops the API first so nothing writes during the restore.
set -eu
[ -n "${1:-}" ] || { echo "usage: $0 <file.sql.gz>"; exit 1; }
docker compose stop api
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" -c "CREATE DATABASE \"$POSTGRES_DB\";"'
gunzip -c "$1" | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose start api
echo "restored $1"
