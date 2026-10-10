# JEMCO Complaint & NCR System

Replaces paper form F/QP/004-01 (V4) with a web application: complaints are raised, triaged by QA, actioned by a person in charge (PIC), verified and closed, with SLA clocks, an audit trail and dashboards. The specification is in `docs/`.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | Next.js frontend (App Router, Tailwind, next-intl `en`/`ms`) — screens only, no business rules |
| `apps/api` | NestJS REST API (`/v1`, OpenAPI at `/v1/docs`) — owns every rule: auth, workflow, SLA, notifications |
| `packages/shared` | Zod schemas and enums used by both |
| `apps/api/prisma` | Schema, migrations (incl. audit/state-machine triggers), seed |
| `docs/` | Requirements and technology plan (PDF) |

## Run locally

```bash
pnpm install
docker compose up -d                       # PostgreSQL 16 + MinIO
cp .env.example apps/api/.env              # edit DATABASE_URL if needed
pnpm --filter @jemco/shared build
pnpm --filter @jemco/api db:generate
pnpm --filter @jemco/api db:migrate:dev
pnpm --filter @jemco/api db:seed
pnpm --filter @jemco/api db:demo           # optional: 60 realistic NCRs for the dashboard
pnpm dev                                   # web :3000, api :4000
```

Seeded sign-ins (password `jemco1234`): `sales@jemco.local` (issuer), `aishah@jemco.local` (QA coordinator), `qa.manager@jemco.local`, `rahman@jemco.local` / `pc.pic@jemco.local` / `wh.pic@jemco.local` / `pur.pic@jemco.local` / `log.pic@jemco.local` (PICs), `prod.manager@jemco.local`, `auditor@jemco.local`.

## Attachments

Uploads go through the API (`POST /v1/attachments`, 25 MB, images/PDF/DWG/DXF) and are stored on local disk by default (`apps/api/uploads/`). Set `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` to use any S3-compatible bucket (R2, MinIO, AWS) instead. Photos are shrunk in the browser before upload. Evidence linked to a record can never be deleted.

## Reports

`GET /v1/reports/management?months=12` feeds the dashboard (department managers see their department only); `GET /v1/reports/register.csv` exports every NCR. Both are SQL so the screen and the export share one definition.

## Email

Every notification is queued twice: `IN_APP` (shown in the app) and `EMAIL`. A job drains the email queue every minute through SMTP when `SMTP_HOST` is set (Resend, SES, Google Workspace and MailHog all speak SMTP); without it, emails are logged and marked sent so dev and CI need no mail server. Emails are rendered in the recipient's language (`en`/`ms`); users can switch email off in **Account**. A Monday 08:00 digest lists each person's open items. Failed sends retry up to 5 times and keep the last error on the row.

## Admin (QA manager)

`/admin` covers choice lists (relabel, add, hide — workflow-critical codes cannot be hidden), routing (department, person in charge and backup per process; when the PIC is marked away, triage assigns the backup automatically), the SLA table, holidays, people (create with a temporary password that must be changed at first sign-in, roles, department, away/email flags, deactivate, reset password) and a change-history view. Every setting change is written to `change_log` by trigger with the manager's name.

## PDF of the form

`GET /v1/ncr/:number/pdf` renders the record as F/QP/004-01 (V4) with headless Chromium via `playwright-core`; Part 3 appears for QA and auditors only. Set `CHROMIUM_PATH` to the browser binary (or run the API on a Playwright base image). The PDF is cached in storage per record version.

## Effectiveness review

On closure an effectiveness review is scheduled 90 working days out. A daily job (08:30) reminds QA 7 days before and once when overdue; reviews due within 7 days appear in QA's to-do. QA records Effective, Not effective or Not applicable on the NCR page; Not effective opens a follow-up NCR linked as a recurrence, assigned to the same PIC with fresh clocks. `POST /v1/admin/jobs/{effectiveness|sla|mail|digest}` runs any scheduled job on demand (QA manager).

## Single sign-on

Set `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `OIDC_REDIRECT_URI` (see `.env.example`; Google Workspace and Microsoft 365 values are given there) and the login page shows a "Sign in with …" button. Sign-in is authorization code + PKCE with ID-token verification. `OIDC_ALLOWED_DOMAINS` restricts which email domains may sign in; with `OIDC_AUTO_PROVISION=true` a first sign-in from an allowed domain creates an Issuer account (the QA manager raises roles in Admin). Password sign-in stays available for accounts created in Admin.

## Supplier and customer scorecards

`GET /v1/reports/partners/supplier|customer?months=N` (and `/csv`) gives, per supplier or customer: NCRs, open, quantity affected, cost, disposition counts (returned, credit note, repaired by supplier, reworked), average days to close, urgent/high count and last NCR date. The page at `/reports/partners` charts the top 10 by cost and links each row to its NCRs in the register.

## Deploy

`apps/api/Dockerfile` and `apps/web/Dockerfile` build production images (the API image includes Chromium for PDFs). `deploy/` holds a Compose stack for one server with Caddy (automatic HTTPS), PostgreSQL, nightly backups and a restore script; see `deploy/README.md`. The `Release images` workflow publishes both images to GHCR on every push to `main` and on `v*` tags.

## Checks

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` — the same four CI runs.

## How a record moves

```
Complaint: SUBMITTED ─▶ (QA) ACCEPTED ─▶ NCR
                     ├▶ NEED_MORE_INFO ─▶ SUBMITTED
                     └▶ REJECTED
NCR: ASSIGNED ─▶ IN_PROGRESS ─▶ AWAITING_VERIFICATION ─▶ CLOSED
                     ▲                    │
                     └──── RETURNED ◀─────┘   (QA manager may reopen CLOSED ─▶ ASSIGNED)
```

Transitions live in `state_transitions` (who may trigger which); the API checks them and a database trigger re-checks them. Every change to a record row is written to `change_log` by trigger; record rows can never be deleted.
