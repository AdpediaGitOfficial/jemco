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
pnpm dev                                   # web :3000, api :4000
```

Seeded sign-ins (password `jemco1234`): `sales@jemco.local` (issuer), `aishah@jemco.local` (QA coordinator), `qa.manager@jemco.local`, `rahman@jemco.local` / `pc.pic@jemco.local` / `wh.pic@jemco.local` / `pur.pic@jemco.local` / `log.pic@jemco.local` (PICs), `prod.manager@jemco.local`, `auditor@jemco.local`.

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
