# JEMCO NCR API — NestJS + Prisma, with Chromium for PDF rendering.
# Build from the repository root:  docker build -f apps/api/Dockerfile -t jemco-api .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @jemco/api... 
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @jemco/shared build \
 && pnpm --filter @jemco/api db:generate \
 && pnpm --filter @jemco/api build \
 && pnpm --filter @jemco/api --prod deploy --legacy /out

FROM base AS runtime
ENV NODE_ENV=production PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CHROMIUM_PATH=/usr/bin/chromium
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-core \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -r app && useradd -r -g app -d /app app
COPY --from=build --chown=app:app /out /app
RUN mkdir -p /app/uploads && chown app:app /app/uploads
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://localhost:4000/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Runs pending migrations, then the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
