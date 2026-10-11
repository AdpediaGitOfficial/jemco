/* Starts a fresh database (migrate + seed) and the API on a test port. */
import { spawn, execSync, type ChildProcess } from "child_process";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.TEST_API_PORT ?? 4100);
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5433/jemco_test";
let api: ChildProcess | undefined;

async function waitFor(url: string, ms = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const r = await fetch(url); if (r.ok) return; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`${url} did not come up`);
}

export async function setup() {
  const env = { ...process.env, DATABASE_URL };
  // A throwaway database per run: drop and recreate it, then apply the real migrations and seed.
  const url = new URL(DATABASE_URL); const name = url.pathname.slice(1);
  if (!/test/.test(name)) throw new Error(`refusing to reset "${name}": the test database name must contain "test"`);
  url.pathname = "/postgres";
  const admin = new PrismaClient({ datasources: { db: { url: url.href } } });
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  await admin.$disconnect();
  execSync("npx prisma migrate deploy", { env, stdio: "inherit", cwd: join(__dirname, "..") });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit", cwd: join(__dirname, "..") });
  api = spawn("node", ["dist/main.js"], {
    cwd: join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...env, NODE_ENV: "test", API_PORT: String(PORT), WEB_ORIGIN: "http://localhost:3100", UPLOAD_DIR: mkdtempSync(join(tmpdir(), "jemco-uploads-")),
      SMTP_HOST: "", CHROMIUM_PATH: process.env.CHROMIUM_PATH ?? "",
    },
  });
  api.stderr?.on("data", (d) => process.stderr.write(d));
  await waitFor(`http://localhost:${PORT}/v1/health`);
  process.env.TEST_API_PORT = String(PORT); process.env.TEST_DATABASE_URL = DATABASE_URL;
}
export async function teardown() { api?.kill(); }
