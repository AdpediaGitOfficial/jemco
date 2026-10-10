import { beforeAll, describe, expect, it } from "vitest";
import { api, db, dept, login, userId, validComplaint, type Session } from "./helpers";

let sales: Session, qa: Session, pic: Session, auditor: Session;
beforeAll(async () => { sales = await login("sales@jemco.local"); qa = await login("aishah@jemco.local"); pic = await login("pc.pic@jemco.local"); auditor = await login("auditor@jemco.local"); });

describe("complaints: intake", () => {
  it("creates with a yearly running number and notifies QA", async () => {
    const r = await api(sales, "/complaints", { method: "POST", json: validComplaint() });
    expect(r.status).toBe(201); expect(r.body.number).toMatch(/^CMP-\d{4}-\d{4}$/); expect(r.body.status).toBe("SUBMITTED");
    const n = await db.notification.findFirst({ where: { event: "COMPLAINT_SUBMITTED", link: "/qa/triage" }, orderBy: { createdAt: "desc" } });
    expect(n).toBeTruthy();
  });
  it("numbers are unique under concurrency", async () => {
    const rs = await Promise.all(Array.from({ length: 8 }, () => api(sales, "/complaints", { method: "POST", json: validComplaint() })));
    const nums = rs.map((r) => r.body.number); expect(new Set(nums).size).toBe(8);
  });
  it.each([
    ["description under 50 chars", { description: "too short" }, "description"],
    ["description over 5000 chars", { description: "x".repeat(5001) }, "description"],
    ["customer missing for customer source", { customerName: undefined }, "customerName"],
    ["supplier missing for supplier source", { source: "SUPPLIER", customerName: undefined }, "supplierName"],
    ["other source without text", { source: "OTHER" }, "sourceOther"],
    ["other process without text", { process: "OTHER" }, "processOther"],
    ["unknown priority", { priority: "CRITICAL" }, "priority"],
    ["zero quantity", { quantity: 0 }, "quantity"],
    ["quantity as string", { quantity: "20" }, "quantity"],
    ["bad delivery date", { deliveryDate: "31/12/2026" }, "deliveryDate"],
    ["PO missing", { poDoNumber: "" }, "poDoNumber"],
    ["unknown unit", { quantityUnit: "BOX" }, "quantityUnit"],
  ])("rejects %s", async (_n, over, field) => {
    const r = await api(sales, "/complaints", { method: "POST", json: validComplaint(over as any) });
    expect(r.status).toBe(400); expect(r.body.fields).toHaveProperty(field);
  });
  it("accepts unicode, a supplier complaint and an OFI without customer/supplier", async () => {
    expect((await api(sales, "/complaints", { method: "POST", json: validComplaint({ description: "Pelanggan terima 20 braket, salutan serbuk terkelupas di tepi lipatan — 客户收到的支架涂层脱落，等待指示。" }) })).status).toBe(201);
    expect((await api(sales, "/complaints", { method: "POST", json: validComplaint({ source: "SUPPLIER", customerName: undefined, supplierName: "Nippon Powder" }) })).status).toBe(201);
    expect((await api(sales, "/complaints", { method: "POST", json: validComplaint({ type: "OFI", source: "INTERNAL_FEEDBACK", customerName: undefined }) })).status).toBe(201);
  });
  it("ignores attachment ids that are not the issuer's own unlinked uploads", async () => {
    const r = await api(sales, "/complaints", { method: "POST", json: validComplaint({ attachmentIds: ["00000000-0000-4000-8000-000000000000"] }) });
    expect(r.status).toBe(201);
    expect((await api(sales, `/complaints/${r.body.number}`)).body.attachments).toEqual([]);
  });
  it("issuers see only their own; QA and auditors see all; a PIC sees nothing of others", async () => {
    const mine = await api(sales, "/complaints"); expect(mine.body.every((c: any) => c.raisedBy.name === "Sales Rep")).toBe(true);
    const all = await api(qa, "/complaints"); expect(all.body.length).toBeGreaterThanOrEqual(mine.body.length);
    expect((await api(auditor, "/complaints")).status).toBe(200);
    const first = mine.body[0].number;
    expect((await api(pic, `/complaints/${first}`)).status).toBe(403);
    expect((await api(sales, "/complaints/CMP-1999-0001")).status).toBe(404);
  });
});

describe("complaints: triage", () => {
  let number: string;
  beforeAll(async () => { number = (await api(sales, "/complaints", { method: "POST", json: validComplaint() })).body.number; });
  it("only QA may triage", async () => {
    expect((await api(sales, `/complaints/${number}/triage`, { method: "POST", json: { decision: "REJECT", reason: "OTHER", reasonText: "x" } })).status).toBe(403);
    expect((await api(pic, `/complaints/${number}/triage`, { method: "POST", json: { decision: "REJECT", reason: "OTHER", reasonText: "x" } })).status).toBe(403);
  });
  it("need-more-info round trip: question, issuer answers, back to SUBMITTED; answering twice is refused", async () => {
    expect((await api(qa, `/complaints/${number}/triage`, { method: "POST", json: { decision: "NEED_MORE_INFO", question: "Which batch number?" } })).status).toBe(201);
    expect((await api(sales, `/complaints/${number}`)).body.status).toBe("NEED_MORE_INFO");
    expect((await api(pic, `/complaints/${number}/answer`, { method: "POST", json: { answer: "x" } })).status).toBe(403);
    expect((await api(sales, `/complaints/${number}/answer`, { method: "POST", json: { answer: "Batch 2210." } })).status).toBe(201);
    expect((await api(sales, `/complaints/${number}`)).body.status).toBe("SUBMITTED");
    expect((await api(sales, `/complaints/${number}/answer`, { method: "POST", json: { answer: "again" } })).status).toBe(403);
  });
  it("accept needs a valid department and assignee", async () => {
    expect((await api(qa, `/complaints/${number}/triage`, { method: "POST", json: { decision: "ACCEPT", priority: "HIGH" } })).status).toBe(400);
    expect((await api(qa, `/complaints/${number}/triage`, { method: "POST", json: { decision: "ACCEPT", priority: "HIGH", departmentId: await dept("PC"), assigneeId: "00000000-0000-4000-8000-000000000000" } })).status).toBe(400);
  });
  it("accept with a changed priority logs the reason; the NCR is numbered and clocks start", async () => {
    const r = await api(qa, `/complaints/${number}/triage`, { method: "POST", json: { decision: "ACCEPT", priority: "MEDIUM", priorityChangeReason: "Customer has stock to continue.", departmentId: await dept("PC"), assigneeId: await userId("pc.pic@jemco.local") } });
    expect(r.status).toBe(201); expect(r.body.ncrNumber).toMatch(/^NCR-\d{4}-\d{4}$/);
    const n = await db.ncr.findUniqueOrThrow({ where: { number: r.body.ncrNumber }, include: { clocks: true, transitions: true } });
    expect(n.priority).toBe("MEDIUM"); expect(n.clocks.map((c) => c.kind).sort()).toEqual(["RESOLUTION", "RESPONSE"]);
    expect(n.transitions[0].reason).toBe("Customer has stock to continue.");
    expect((await api(sales, `/complaints/${number}`)).body.ncr.number).toBe(r.body.ncrNumber);
  });
  it("cannot triage twice", async () => {
    expect((await api(qa, `/complaints/${number}/triage`, { method: "POST", json: { decision: "REJECT", reason: "OTHER", reasonText: "x" } })).status).toBe(403);
  });
  it("reject records the reason and tells the issuer", async () => {
    const c = (await api(sales, "/complaints", { method: "POST", json: validComplaint() })).body.number;
    expect((await api(qa, `/complaints/${c}/triage`, { method: "POST", json: { decision: "REJECT", reason: "NOT_NC", reasonText: "" } })).status).toBe(400);
    expect((await api(qa, `/complaints/${c}/triage`, { method: "POST", json: { decision: "REJECT", reason: "NOT_NC", reasonText: "This is a sales enquiry, not a non-conformance." } })).status).toBe(201);
    const got = await api(sales, `/complaints/${c}`); expect(got.body.status).toBe("REJECTED"); expect(got.body.rejectionText).toMatch(/sales enquiry/);
    expect(await db.notification.findFirst({ where: { event: "COMPLAINT_REJECTED", link: `/complaints/${c}` } })).toBeTruthy();
  });
  it("assigning an away PIC falls back to the routing backup when one exists", async () => {
    const mgr = await login("qa.manager@jemco.local");
    const primary = await userId("pc.pic@jemco.local"), backup = await userId("wh.pic@jemco.local");
    await api(mgr, "/admin/routing/POWDER_COATING", { method: "PUT", json: { departmentId: await dept("PC"), primaryPicId: primary, backupPicId: backup } });
    await api(mgr, `/admin/users/${primary}`, { method: "PATCH", json: { outOfOffice: true } });
    const c = (await api(sales, "/complaints", { method: "POST", json: validComplaint() })).body.number;
    const r = await api(qa, `/complaints/${c}/triage`, { method: "POST", json: { decision: "ACCEPT", priority: "HIGH", departmentId: await dept("PC"), assigneeId: primary } });
    expect((await db.ncr.findUniqueOrThrow({ where: { number: r.body.ncrNumber } })).assigneeId).toBe(backup);
    await api(mgr, `/admin/users/${primary}`, { method: "PATCH", json: { outOfOffice: false } });
    await api(mgr, "/admin/routing/POWDER_COATING", { method: "PUT", json: { departmentId: await dept("PC"), primaryPicId: primary, backupPicId: null } });
  });
});
