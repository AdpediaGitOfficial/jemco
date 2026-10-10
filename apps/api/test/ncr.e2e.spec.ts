import { beforeAll, describe, expect, it } from "vitest";
import { api, completeAction, db, login, raiseAndAccept, userId, type Session } from "./helpers";

let sales: Session, qa: Session, mgr: Session, pic: Session, other: Session, deptMgr: Session, auditor: Session;
beforeAll(async () => {
  [sales, qa, mgr, pic, other, deptMgr, auditor] = await Promise.all(["sales@jemco.local", "aishah@jemco.local", "qa.manager@jemco.local", "pc.pic@jemco.local", "log.pic@jemco.local", "prod.manager@jemco.local", "auditor@jemco.local"].map((e) => login(e, e === "log.pic@jemco.local" ? "jemco1234-restored" : "jemco1234")));
});

describe("NCR lifecycle", () => {
  let ncr: string;
  beforeAll(async () => { ncr = (await raiseAndAccept(qa, sales)).ncr; });

  it("visibility: assignee, QA, auditor yes; unrelated PIC and issuer no; Part 3 hidden from the PIC", async () => {
    expect((await api(pic, `/ncr/${ncr}`)).status).toBe(200);
    expect((await api(qa, `/ncr/${ncr}`)).status).toBe(200);
    expect((await api(auditor, `/ncr/${ncr}`)).status).toBe(200);
    expect((await api(other, `/ncr/${ncr}`)).status).toBe(403);
    expect((await api(sales, `/ncr/${ncr}`)).status).toBe(403);
    expect((await api(pic, "/ncr/NCR-1999-0001")).status).toBe(404);
  });
  it("only the assignee can work it; a stray PIC gets 403 on every write", async () => {
    for (const p of ["start", "action", "submit"]) expect((await api(other, `/ncr/${ncr}/${p}`, { method: "POST", json: { actions: [] } })).status).toBe(403);
  });
  it("start stops the response clock and moves to IN_PROGRESS; starting twice is harmless", async () => {
    expect((await api(pic, `/ncr/${ncr}/start`, { method: "POST" })).body.state).toBe("IN_PROGRESS");
    expect((await api(pic, `/ncr/${ncr}/start`, { method: "POST" })).status).toBe(201);
    const clocks = await db.slaClock.findMany({ where: { ncr: { number: ncr } } });
    expect(clocks.find((c) => c.kind === "RESPONSE")?.stoppedAt).toBeTruthy(); expect(clocks.find((c) => c.kind === "RESOLUTION")?.stoppedAt).toBeNull();
  });
  it("submit refuses until root cause, plan and done action items exist, naming each gap", async () => {
    const r = await api(pic, `/ncr/${ncr}/submit`, { method: "POST" });
    expect(r.status).toBe(400); expect(Object.keys(r.body.fields).sort()).toEqual(["actionPlan", "actions", "rootCause"]);
    await api(pic, `/ncr/${ncr}/action`, { method: "POST", json: { rootCause: "x", actionPlan: "y", actions: [{ description: "do it", ownerId: pic.user.id, dueDate: "2026-10-20", done: false }] } });
    const r2 = await api(pic, `/ncr/${ncr}/submit`, { method: "POST" }); expect(Object.keys(r2.body.fields)).toEqual(["actionsDone"]);
  });
  it("action items: an unknown owner is a 400, not a crash; saved items keep their ids on re-save", async () => {
    const bad = await api(pic, `/ncr/${ncr}/action`, { method: "POST", json: { actions: [{ description: "x", ownerId: "00000000-0000-4000-8000-000000000000", dueDate: "2026-10-20", done: true }] } });
    expect(bad.status).toBe(400);
    const saved = await completeAction(pic, ncr, pic.user.id);
    expect(saved.status).toBe(201); const ids = saved.body.actions.map((a: any) => a.id);
    const again = await api(pic, `/ncr/${ncr}/action`, { method: "POST", json: { rootCause: "r", actionPlan: "p", actions: saved.body.actions.map((a: any) => ({ id: a.id, description: a.description, ownerId: a.ownerId, dueDate: a.dueDate.slice(0, 10), done: true })) } });
    expect(again.body.actions.map((a: any) => a.id)).toEqual(ids);
  });
  it("submit moves to AWAITING_VERIFICATION, stops resolution, starts verification, tells QA; PIC can no longer edit", async () => {
    expect((await api(pic, `/ncr/${ncr}/submit`, { method: "POST" })).body.state).toBe("AWAITING_VERIFICATION");
    const clocks = await db.slaClock.findMany({ where: { ncr: { number: ncr }, stoppedAt: null } });
    expect(clocks.map((c) => c.kind)).toEqual(["VERIFICATION"]);
    expect((await api(pic, `/ncr/${ncr}/action`, { method: "POST", json: { actions: [] } })).status).toBe(403);
    expect((await api(pic, `/ncr/${ncr}/submit`, { method: "POST" })).status).toBe(403);
  });
  it("verify: only QA; needs a result; non-satisfactory returns with half the clock and a reason", async () => {
    expect((await api(pic, `/ncr/${ncr}/verify`, { method: "POST", json: { result: "SATISFACTORY", dispositions: ["REWORK_INTERNAL"], qaJustification: "x" } })).status).toBe(403);
    expect((await api(qa, `/ncr/${ncr}/verify`, { method: "POST", json: { result: "NON_SATISFACTORY", qaJustification: "x" } })).status).toBe(400);
    const r = await api(qa, `/ncr/${ncr}/verify`, { method: "POST", json: { result: "NON_SATISFACTORY", returnReason: "Need photos of the updated traveller.", qaJustification: "Evidence missing." } });
    expect(r.body.state).toBe("RETURNED"); expect(r.body.returnCount).toBe(1);
    const res = await db.slaClock.findFirst({ where: { ncr: { number: ncr }, kind: "RESOLUTION", stoppedAt: null } });
    expect(res).toBeTruthy();
    expect(await db.notification.findFirst({ where: { event: "NCR_RETURNED", link: `/ncr/${ncr}`, userId: pic.user.id } })).toBeTruthy();
  });
  it("rework: saving from RETURNED goes back to IN_PROGRESS; second return escalates to the QA manager", async () => {
    expect((await completeAction(pic, ncr, pic.user.id)).body.state).toBe("IN_PROGRESS");
    await api(pic, `/ncr/${ncr}/submit`, { method: "POST" });
    const r = await api(qa, `/ncr/${ncr}/verify`, { method: "POST", json: { result: "NON_SATISFACTORY", returnReason: "Still no photos.", qaJustification: "x" } });
    expect(r.body.returnCount).toBe(2);
    expect(await db.notification.findFirst({ where: { event: "NCR_RETURNED", link: `/ncr/${ncr}`, userId: mgr.user.id } })).toBeTruthy();
  });
  it("close: dispositions required, effectiveness review scheduled ~90 working days out, record locked", async () => {
    await completeAction(pic, ncr, pic.user.id); await api(pic, `/ncr/${ncr}/submit`, { method: "POST" });
    expect((await api(qa, `/ncr/${ncr}/verify`, { method: "POST", json: { result: "SATISFACTORY", dispositions: [], qaJustification: "x" } })).status).toBe(400);
    const r = await api(qa, `/ncr/${ncr}/verify`, { method: "POST", json: { result: "SATISFACTORY", dispositions: ["REWORK_INTERNAL", "CREDIT_NOTE"], costOfNc: 450, qaJustification: "Traveller rev 3 verified." } });
    expect(r.body.state).toBe("CLOSED");
    const due = new Date(r.body.effectivenessDue).getTime(); const days = (due - Date.now()) / 86400_000;
    expect(days).toBeGreaterThan(110); expect(days).toBeLessThan(140); // 90 working days ≈ 126 calendar days
    expect((await api(pic, `/ncr/${ncr}/action`, { method: "POST", json: { actions: [] } })).status).toBe(403);
    expect((await api(qa, `/ncr/${ncr}/verify`, { method: "POST", json: { result: "SATISFACTORY", dispositions: ["DISPOSAL"], qaJustification: "x" } })).status).toBe(403);
    expect((await db.slaClock.count({ where: { ncr: { number: ncr }, stoppedAt: null } }))).toBe(0);
  });
  it("Part 3 is visible to QA/auditor and blank for the PIC; the full record has an ordered history", async () => {
    expect((await api(qa, `/ncr/${ncr}`)).body.qaJustification).toBe("Traveller rev 3 verified.");
    expect((await api(auditor, `/ncr/${ncr}`)).body.dispositions).toEqual(["REWORK_INTERNAL", "CREDIT_NOTE"]);
    const p = await api(pic, `/ncr/${ncr}`); expect(p.body.qaJustification).toBeNull(); expect(p.body.dispositions).toEqual([]);
    const states = p.body.transitions.map((t: any) => t.toState);
    expect(states).toEqual(["ASSIGNED", "IN_PROGRESS", "AWAITING_VERIFICATION", "RETURNED", "IN_PROGRESS", "AWAITING_VERIFICATION", "RETURNED", "IN_PROGRESS", "AWAITING_VERIFICATION", "CLOSED"]);
  });
  it("effectiveness: QA only, closed only, once; NOT_EFFECTIVE opens a linked follow-up with clocks", async () => {
    expect((await api(pic, `/ncr/${ncr}/effectiveness`, { method: "POST", json: { result: "EFFECTIVE" } })).status).toBe(403);
    const open = (await raiseAndAccept(qa, sales)).ncr;
    expect((await api(qa, `/ncr/${open}/effectiveness`, { method: "POST", json: { result: "EFFECTIVE" } })).status).toBe(403);
    const r = await api(qa, `/ncr/${ncr}/effectiveness`, { method: "POST", json: { result: "NOT_EFFECTIVE", notes: "Peeling recurred on batch 2211." } });
    expect(r.status).toBe(201); expect(r.body.followUp).toMatch(/^NCR-/);
    expect((await api(qa, `/ncr/${ncr}/effectiveness`, { method: "POST", json: { result: "EFFECTIVE" } })).status).toBe(403);
    const f = await db.ncr.findUniqueOrThrow({ where: { number: r.body.followUp }, include: { clocks: true, linksFrom: true } });
    expect(f.state).toBe("ASSIGNED"); expect(f.assigneeId).toBe(pic.user.id); expect(f.clocks.length).toBe(2); expect(f.linksFrom[0].kind).toBe("RECURRENCE_OF");
  });
  it("reopen: QA manager only, with a reason, restarts the resolution clock", async () => {
    expect((await api(qa, `/ncr/${ncr}/reopen`, { method: "POST", json: { reason: "x" } })).status).toBe(403);
    expect((await api(mgr, `/ncr/${ncr}/reopen`, { method: "POST", json: { reason: "" } })).status).toBe(400);
    const r = await api(mgr, `/ncr/${ncr}/reopen`, { method: "POST", json: { reason: "Customer reports the same defect on the replacement batch." } });
    expect(r.body.state).toBe("ASSIGNED");
    expect(await db.slaClock.findFirst({ where: { ncr: { number: ncr }, kind: "RESOLUTION", stoppedAt: null } })).toBeTruthy();
  });
  it("an OFI can be submitted without a root cause", async () => {
    const { ncr: ofi } = await raiseAndAccept(qa, sales, { type: "OFI", source: "INTERNAL_FEEDBACK", customerName: undefined, priority: "LOW" });
    await api(pic, `/ncr/${ofi}/action`, { method: "POST", json: { actionPlan: "Move the label printer.", actions: [{ description: "Move printer", ownerId: pic.user.id, dueDate: "2026-10-20", done: true }] } });
    expect((await api(pic, `/ncr/${ofi}/submit`, { method: "POST" })).body.state).toBe("AWAITING_VERIFICATION");
  });
  it("department manager sees their department's NCRs only; list filters by state", async () => {
    const r = await api(deptMgr, "/ncr"); expect(r.body.every((n: any) => n.department.name === "Production")).toBe(true);
    const closed = await api(qa, "/ncr?state=CLOSED"); expect(closed.body.every((n: any) => n.state === "CLOSED")).toBe(true);
  });
  it("database guards hold even when the API is bypassed", async () => {
    const n = await db.ncr.findUniqueOrThrow({ where: { number: ncr } });
    await expect(db.$executeRaw`UPDATE ncrs SET state = 'CLOSED' WHERE id = ${n.id}::uuid`).rejects.toThrow(/not allowed/);
    await expect(db.$executeRaw`DELETE FROM ncrs WHERE id = ${n.id}::uuid`).rejects.toThrow(/not allowed/);
    await expect(db.$executeRaw`DELETE FROM change_log WHERE row_id = ${n.id}`).rejects.toThrow(/not allowed/);
  });
  it("every change was audited with the actor", async () => {
    const n = await db.ncr.findUniqueOrThrow({ where: { number: ncr } });
    const rows = await db.changeLog.findMany({ where: { tableName: "ncrs", rowId: n.id, field: "state" } });
    expect(rows.length).toBeGreaterThanOrEqual(10); expect(rows.every((r) => r.actorId)).toBe(true);
  });
});

describe("to-do", () => {
  it("shows each role what it must act on", async () => {
    const { ncr } = await raiseAndAccept(qa, sales);
    const p = await api(pic, "/todo"); expect(p.body.find((i: any) => i.number === ncr)?.action).toBe("START");
    const c = (await api(sales, "/complaints", { method: "POST", json: await import("./helpers").then((h) => h.validComplaint()) })).body.number;
    const q = await api(qa, "/todo"); expect(q.body.find((i: any) => i.number === c)?.action).toBe("TRIAGE");
    await api(qa, `/complaints/${c}/triage`, { method: "POST", json: { decision: "NEED_MORE_INFO", question: "Batch?" } });
    const s = await api(sales, "/todo"); expect(s.body.find((i: any) => i.number === c)?.action).toBe("ANSWER");
    expect((await api(sales, "/todo")).body.every((i: any) => i.action === "ANSWER")).toBe(true);
  });
});
