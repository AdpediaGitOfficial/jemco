import { beforeAll, describe, expect, it } from "vitest";
import { api, db, dept, login, raiseAndAccept, userId, type Session } from "./helpers";

let sales: Session, qa: Session, mgr: Session, deptMgr: Session, auditor: Session;
beforeAll(async () => { [sales, qa, mgr, deptMgr, auditor] = await Promise.all(["sales@jemco.local", "aishah@jemco.local", "qa.manager@jemco.local", "prod.manager@jemco.local", "auditor@jemco.local"].map((e) => login(e))); });

describe("reports", () => {
  it("roles: QA, manager, auditor, department manager yes; issuer and PIC no", async () => {
    for (const s of [qa, mgr, deptMgr, auditor]) expect((await api(s, "/reports/management")).status).toBe(200);
    expect((await api(sales, "/reports/management")).status).toBe(403);
    expect((await api(await login("pc.pic@jemco.local"), "/reports/register")).status).toBe(403);
  });
  it("months parameter is clamped and tolerant", async () => {
    for (const m of ["0", "999", "abc", "-5", ""]) expect((await api(qa, `/reports/management?months=${m}`)).status).toBe(200);
    expect((await api(qa, "/reports/management?months=3")).body.bucket).toBe("week");
    expect((await api(qa, "/reports/management?months=12")).body.bucket).toBe("month");
  });
  it("tiles agree with the register and the department scope is applied", async () => {
    const r = await api(qa, "/reports/management"); const reg = await api(qa, "/reports/register");
    const open = reg.body.filter((n: any) => !["CLOSED", "REJECTED"].includes(n.state)).length;
    expect(r.body.tiles.open).toBe(open);
    const d = await api(deptMgr, "/reports/register"); expect(d.body.every((n: any) => n.department === "Production")).toBe(true);
  });
  it("CSV exports carry a BOM, a header and quoted commas", async () => {
    await raiseAndAccept(qa, sales);
    const r = await api(auditor, "/reports/register.csv");
    expect(r.status).toBe(200); expect(r.headers.get("content-type")).toMatch(/text\/csv/); expect(String(r.body).charCodeAt(0)).toBe(0xfeff);
    expect(String(r.body).split("\n")[0]).toMatch(/^﻿number,state,priority/);
    const sc = await api(qa, "/reports/partners/supplier/csv"); expect(sc.status).toBe(200);
  });
  it("scorecards group by supplier or customer and only count linked complaints", async () => {
    await raiseAndAccept(qa, sales, { source: "SUPPLIER", customerName: undefined, supplierName: "Fastenal, Asia" });
    const s = await api(qa, "/reports/partners/supplier"); expect(s.body.rows.find((x: any) => x.name === "Fastenal, Asia")?.ncrs).toBeGreaterThanOrEqual(1);
    const c = await api(qa, "/reports/partners/customer"); expect(c.body.rows.every((x: any) => x.name)).toBe(true);
    expect((await api(qa, "/reports/partners/bogus")).body.kind).toBe("supplier");
    const csv = await api(qa, "/reports/partners/supplier/csv"); expect(String(csv.body)).toMatch(/"Fastenal, Asia"/);
  });
});

describe("admin", () => {
  it("is QA-manager only", async () => {
    for (const s of [qa, sales, deptMgr, auditor]) { expect((await api(s, "/admin/users")).status).toBe(403); expect((await api(s, "/admin/jobs/sla", { method: "POST" })).status).toBe(403); }
  });
  it("lookups: add, relabel, hide; protected codes and duplicates and unknown lists are refused", async () => {
    expect((await api(mgr, "/admin/lookups/process", { method: "POST", json: { code: "packing", labelEn: "Packing", labelMs: "Pembungkusan" } })).status).toBe(400);
    expect((await api(mgr, "/admin/lookups/colours", { method: "POST", json: { code: "RED", labelEn: "Red", labelMs: "Merah" } })).status).toBe(400);
    expect((await api(mgr, "/admin/lookups/process", { method: "POST", json: { code: "PACKING", labelEn: "Packing", labelMs: "Pembungkusan" } })).status).toBe(201);
    expect((await api(mgr, "/admin/lookups/process", { method: "POST", json: { code: "PACKING", labelEn: "Packing", labelMs: "Pembungkusan" } })).body.fields.code).toBe("exists");
    expect((await api(mgr, "/admin/lookups/process/PACKING", { method: "PATCH", json: { active: false, labelEn: "Packing & despatch" } })).body.active).toBe(false);
    expect((await api(sales, "/lookups")).body.process.some((o: any) => o.code === "PACKING")).toBe(false);
    expect((await api(mgr, "/admin/lookups/priority/URGENT", { method: "PATCH", json: { active: false } })).body.fields.active).toBe("protected");
    expect((await api(mgr, "/admin/lookups/priority/URGENT", { method: "PATCH", json: { labelEn: "Urgent / critical" } })).status).toBe(200);
    expect((await api(mgr, "/admin/lookups/process/NOPE", { method: "PATCH", json: { active: false } })).status).toBe(404);
  });
  it("SLA and calendar edits change the next clock", async () => {
    expect((await api(mgr, "/admin/sla/LOW", { method: "PUT", json: { triageDays: 3, responseDays: 10, resolutionDays: 400, verificationDays: 5 } })).status).toBe(400);
    expect((await api(mgr, "/admin/sla/LOW", { method: "PUT", json: { triageDays: 3, responseDays: 10, resolutionDays: 2, verificationDays: 5 } })).status).toBe(200);
    const { ncr } = await raiseAndAccept(qa, sales, { priority: "LOW" });
    const n = await db.ncr.findUniqueOrThrow({ where: { number: ncr } });
    const [{ d }] = await db.$queryRaw<{ d: number }[]>`SELECT working_days_between(current_date, ${n.respondBy}::date) AS d`;
    expect(d).toBe(2);
    await api(mgr, "/admin/sla/LOW", { method: "PUT", json: { triageDays: 3, responseDays: 10, resolutionDays: 30, verificationDays: 5 } });
    expect((await api(mgr, "/admin/calendar", { method: "POST", json: { date: "2026-13-01", reason: "x" } })).status).toBe(400);
    expect((await api(mgr, "/admin/calendar", { method: "POST", json: { date: "2027-02-01", reason: "Stock-take" } })).status).toBe(201);
    expect((await api(mgr, "/admin/calendar?year=2027")).body.some((h: any) => h.reason === "Stock-take")).toBe(true);
    expect((await api(mgr, "/admin/calendar/2027-02-01", { method: "DELETE" })).status).toBe(204);
  });
  it("users: create (temp password, forced change), duplicate email, role edits, self-protection, reset kills sessions", async () => {
    const r = await api(mgr, "/admin/users", { method: "POST", json: { email: "New.Hire@JEMCO.local", name: "New Hire", departmentId: await dept("WH"), roles: ["PIC"], locale: "ms" } });
    expect(r.status).toBe(201); expect(r.body.email).toBe("new.hire@jemco.local"); expect(r.body.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect((await api(mgr, "/admin/users", { method: "POST", json: { email: "new.hire@jemco.local", name: "Dup", roles: ["PIC"] } })).body.fields.email).toBe("exists");
    expect((await api(mgr, "/admin/users", { method: "POST", json: { email: "x@jemco.local", name: "No roles", roles: [] } })).status).toBe(400);
    const s = await login("new.hire@jemco.local", r.body.temporaryPassword); expect(s.user.roles).toEqual(["PIC"]);
    expect((await api(s, "/auth/me")).body.mustChangePassword).toBe(true);
    expect((await api(mgr, `/admin/users/${r.body.id}`, { method: "PATCH", json: { roles: ["PIC", "DEPT_MANAGER"] } })).status).toBe(200);
    expect((await login("new.hire@jemco.local", r.body.temporaryPassword)).user.roles.sort()).toEqual(["DEPT_MANAGER", "PIC"]);
    expect((await api(mgr, `/admin/users/${mgr.user.id}`, { method: "PATCH", json: { roles: ["ISSUER"] } })).body.fields.roles).toBe("self");
    expect((await api(mgr, `/admin/users/${mgr.user.id}`, { method: "PATCH", json: { active: false } })).status).toBe(400);
    const reset = await api(mgr, `/admin/users/${r.body.id}/reset-password`, { method: "POST" });
    expect((await api(s, "/auth/me")).status).toBe(401);
    expect((await login("new.hire@jemco.local", reset.body.temporaryPassword)).user.name).toBe("New Hire");
    expect((await api(mgr, "/admin/users/00000000-0000-4000-8000-000000000000", { method: "PATCH", json: { name: "x" } })).status).toBe(404);
  });
  it("routing validates ids; change history names the manager", async () => {
    expect((await api(mgr, "/admin/routing/LOGISTIC", { method: "PUT", json: { departmentId: "nope" } })).status).toBe(400);
    expect((await api(mgr, "/admin/routing/LOGISTIC", { method: "PUT", json: { departmentId: await dept("LOG"), primaryPicId: await userId("log.pic@jemco.local"), backupPicId: await userId("wh.pic@jemco.local") } })).status).toBe(200);
    const ch = await api(mgr, "/admin/changes"); expect(ch.status).toBe(200);
    expect(ch.body.some((r: any) => r.tableName === "routing_map" && r.actor?.name === "QA Manager")).toBe(true);
    expect(ch.body.some((r: any) => r.field === "password_hash")).toBe(false);
  });
  it("jobs run on demand: sla sweep, mail drain (dry-run marks sent, email-off skipped), effectiveness, digest", async () => {
    expect((await api(mgr, "/admin/jobs/sla", { method: "POST" })).body.ok).toBe(true);
    const sid = await userId("wh.pic@jemco.local");
    await api(await login("wh.pic@jemco.local"), "/auth/me", { method: "PATCH", json: { emailEnabled: false } });
    await db.notification.create({ data: { userId: sid, event: "TEST", subject: "t", body: "b", channel: "EMAIL" } });
    const pending = await db.notification.count({ where: { channel: "EMAIL", sentAt: null } }); expect(pending).toBeGreaterThan(0);
    expect((await api(mgr, "/admin/jobs/mail", { method: "POST" })).body.ok).toBe(true);
    expect(await db.notification.count({ where: { channel: "EMAIL", sentAt: null, attempts: { lt: 5 } } })).toBe(0);
    expect((await db.notification.findFirst({ where: { userId: sid, event: "TEST" } }))?.lastError).toMatch(/email off/);
    expect((await api(mgr, "/admin/jobs/effectiveness", { method: "POST" })).body).toHaveProperty("sent");
    expect((await api(mgr, "/admin/jobs/digest", { method: "POST" })).body.ok).toBe(true);
    expect((await api(mgr, "/admin/jobs/nope", { method: "POST" })).body.error).toBeTruthy();
  });
  it("notifications: a user sees only their own in-app rows and can mark them read", async () => {
    const s = await login("pc.pic@jemco.local");
    const list = await api(s, "/notifications"); expect(list.body.every((n: any) => n.channel === "IN_APP")).toBe(true);
    if (list.body[0]) { await api(s, `/notifications/${list.body[0].id}/read`, { method: "POST" }); expect((await api(s, "/notifications")).body[0].readAt).toBeTruthy(); }
    const foreign = await db.notification.findFirst({ where: { userId: { not: s.user.id }, channel: "IN_APP" } });
    if (foreign) { await api(s, `/notifications/${foreign.id}/read`, { method: "POST" }); expect((await db.notification.findUnique({ where: { id: foreign.id } }))?.readAt).toBeNull(); }
  });
});

describe("working-day rules in the database", () => {
  it("skips weekends and holidays, and numbering never repeats", async () => {
    const q = async (p: Promise<any[]>) => (await p)[0];
    expect((await q(db.$queryRaw`SELECT add_working_days('2026-10-09'::date, 1)::text AS d`)).d).toBe("2026-10-12"); // Fri + 1 = Mon
    expect((await q(db.$queryRaw`SELECT add_working_days('2026-12-24'::date, 1)::text AS d`)).d).toBe("2026-12-28"); // skips Christmas + weekend
    expect((await q(db.$queryRaw`SELECT working_days_between('2026-10-09'::date, '2026-10-16'::date) AS n`)).n).toBe(5);
    expect((await q(db.$queryRaw`SELECT working_days_between('2026-10-16'::date, '2026-10-09'::date) AS n`)).n).toBe(0);
    expect((await q(db.$queryRaw`SELECT is_working_day('2026-08-31'::date) AS w`)).w).toBe(false); // National Day
    const a = (await q(db.$queryRaw`SELECT next_number('TST') AS n`)).n, b = (await q(db.$queryRaw`SELECT next_number('TST') AS n`)).n;
    expect(a).not.toBe(b); expect(b).toMatch(/^TST-\d{4}-0002$/);
  });
  it("every active lookup option has labels in both languages", async () => {
    const rows = await db.lookupOption.findMany({ where: { active: true } });
    expect(rows.every((r) => r.labelEn.trim() && r.labelMs.trim())).toBe(true);
    expect(rows.filter((r) => r.list === "priority").every((r) => r.helpEn && r.helpMs)).toBe(true);
  });
});

describe("PDF", () => {
  it("renders the form for QA with Part 3 and for the PIC without it; access is checked", async () => {
    if (!process.env.CHROMIUM_PATH) return; // renderer not available on this machine
    const { ncr } = await raiseAndAccept(qa, sales);
    const pic = await login("pc.pic@jemco.local");
    const full = await api(qa, `/ncr/${ncr}/pdf`); expect(full.status).toBe(200); expect(full.headers.get("content-type")).toBe("application/pdf"); expect(String(full.body).startsWith("%PDF")).toBe(true);
    expect((await api(pic, `/ncr/${ncr}/pdf`)).status).toBe(200);
    expect((await api(sales, `/ncr/${ncr}/pdf`)).status).toBe(403);
    expect((await api(qa, "/ncr/NCR-1999-0001/pdf")).status).toBe(404);
  });
});
