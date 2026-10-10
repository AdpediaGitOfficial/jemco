#!/bin/sh
# Nightly pg_dump at 02:00 server time; keeps KEEP_DAYS days. Runs inside the backup container.
set -eu
mkdir -p /backups
while true; do
  now=$(date +%s); target=$(date -d "tomorrow 02:00" +%s 2>/dev/null || date -d "@$((now + 86400))" +%s)
  sleep $(( target > now ? target - now : 60 ))
  f="/backups/jemco-$(date +%Y%m%d-%H%M).sql.gz"
  if pg_dump --no-owner --no-privileges | gzip > "$f"; then echo "backup written: $f"; else echo "backup FAILED"; rm -f "$f"; fi
  find /backups -name 'jemco-*.sql.gz' -mtime +"${KEEP_DAYS:-35}" -delete
done
