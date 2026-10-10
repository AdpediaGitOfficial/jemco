import { PrismaClient } from "@prisma/client";
export const BASE = () => `http://localhost:${process.env.TEST_API_PORT ?? 4100}/v1`;
export const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5433/jemco_test" } } });

export type Session = { cookie: string; user: { id: string; name: string; roles: string[]; departmentId: string | null } };

/** Logs in and returns the cookie to send on later calls. */
export async function login(email: string, password = "jemco1234"): Promise<Session> {
  const r = await fetch(`${BASE()}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!r.ok) throw new Error(`login ${email}: ${r.status} ${await r.text()}`);
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  return { cookie, user: await r.json() };
}
export async function api(s: Session | null, path: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  const r = await fetch(`${BASE()}${path}`, { ...rest, redirect: "manual", headers: { ...(s ? { cookie: s.cookie } : {}), ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) }, body: json !== undefined ? JSON.stringify(json) : rest.body });
  const raw = Buffer.from(await r.arrayBuffer()); const text = raw.toString("utf8"); let body: any = text; try { body = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, body, raw, headers: r.headers };
}
export const validComplaint = (over: Record<string, unknown> = {}) => ({
  type: "CORRECTIVE", source: "CUSTOMER", process: "POWDER_COATING", priority: "HIGH", customerName: "Syarikat Maju Sdn Bhd", poDoNumber: "DO-20451",
  quantity: 20, quantityUnit: "PCS", description: "Customer received 20 brackets with the powder coat peeling along the folded edge. Goods are at customer site awaiting instruction.", attachmentIds: [], ...over,
});
export async function dept(code: string) { return (await db.department.findUniqueOrThrow({ where: { code } })).id; }
export async function userId(email: string) { return (await db.user.findUniqueOrThrow({ where: { email } })).id; }
/** Issuer raises, QA accepts: returns the NCR number. */
export async function raiseAndAccept(qa: Session, issuer: Session, over: Record<string, unknown> = {}, assigneeEmail = "pc.pic@jemco.local", deptCode = "PC") {
  const c = await api(issuer, "/complaints", { method: "POST", json: validComplaint(over) });
  if (c.status !== 201) throw new Error(`create ${c.status} ${JSON.stringify(c.body)}`);
  const tr = await api(qa, `/complaints/${c.body.number}/triage`, { method: "POST", json: { decision: "ACCEPT", priority: (over.priority as string) ?? "HIGH", departmentId: await dept(deptCode), assigneeId: await userId(assigneeEmail) } });
  if (tr.status !== 201) throw new Error(`triage ${tr.status} ${JSON.stringify(tr.body)}`);
  return { complaint: c.body.number as string, ncr: tr.body.ncrNumber as string };
}
export async function completeAction(pic: Session, ncr: string, ownerId: string) {
  return api(pic, `/ncr/${ncr}/action`, { method: "POST", json: { containment: "Quarantined the batch.", rootCause: "Pre-treatment step skipped on folded edges because the traveller did not list it.", rootCauseCategory: "METHOD", actionPlan: "Traveller updated; operators re-briefed.", actions: [{ description: "Update traveller", ownerId, dueDate: "2026-10-20", done: true }] } });
}
