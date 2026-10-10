# Deploying JEMCO NCR on one server

Option B from the technology plan: one VPS (4 vCPU, 8 GB, Ubuntu 24.04), Docker, this Compose stack. Caddy gets a TLS certificate automatically for `DOMAIN`.

## First time

```bash
# on the server
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 git
git clone https://github.com/AdpediaGitOfficial/jemco.git && cd jemco/deploy
cp .env.example .env && nano .env            # DOMAIN, DB_PASSWORD, mail, optional S3 and SSO
docker compose pull                          # or: docker compose build
docker compose up -d                         # API runs migrations on start
docker compose exec api npx tsx prisma/seed.ts   # lookups, SLA table, departments, demo sign-ins
```

Point the DNS A record for `DOMAIN` at the server before `up -d`, or Caddy cannot get a certificate. Open `https://DOMAIN`, sign in as `qa.manager@jemco.local` / `jemco1234`, go to **Admin → People**, create the real accounts and **deactivate the demo ones**.

## Updating

```bash
cd jemco/deploy && git pull && docker compose pull && docker compose up -d
```

Migrations run automatically; a failed migration stops the API and the old version keeps serving until fixed.

## Backups

The `backup` service writes `pg_dump` output to the `backups` volume every night at 02:00 and keeps 35 days. Copy them off the server (for example with `rclone` to object storage). Restore with `./restore.sh <file>`. Attachments live in the `uploads` volume unless `S3_BUCKET` is set; include it in off-server copies.

## Checks

- `docker compose ps` — all services `running (healthy)`
- `https://DOMAIN/api/v1/health` — `{"ok":true}`
- `docker compose logs -f api` — mail, SLA and job logs

## Managed-platform alternative (option A)

Build the two images the same way and run them on Railway/Render/Fly with a managed PostgreSQL (Neon, Supabase) and R2 for attachments; set the same environment variables, `WEB_ORIGIN` to the web URL and `NEXT_PUBLIC_API_URL` to the API URL (CORS is already configured for a separate origin).
