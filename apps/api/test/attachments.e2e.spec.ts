import { beforeAll, describe, expect, it } from "vitest";
import { api, BASE, db, login, raiseAndAccept, validComplaint, type Session } from "./helpers";

let sales: Session, qa: Session, pic: Session, other: Session;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
async function upload(s: Session, name: string, body: Buffer, type: string, query = "") {
  const fd = new FormData(); fd.append("file", new Blob([body], { type }), name);
  const r = await fetch(`${BASE()}/attachments${query}`, { method: "POST", headers: { cookie: s.cookie }, body: fd });
  const text = await r.text(); let json: any = text; try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, body: json };
}
beforeAll(async () => { sales = await login("sales@jemco.local"); qa = await login("aishah@jemco.local"); pic = await login("pc.pic@jemco.local"); other = await login("wh.pic@jemco.local"); });

describe("attachments", () => {
  it("accepts images, PDF and drawings; rejects executables, scripts and disguised types", async () => {
    expect((await upload(sales, "a.png", png, "image/png")).status).toBe(201);
    expect((await upload(sales, "plan.dwg", Buffer.from("x"), "application/octet-stream")).status).toBe(201);
    expect((await upload(sales, "spec.pdf", Buffer.from("%PDF-1.4"), "application/pdf")).status).toBe(201);
    for (const [n, t] of [["evil.exe", "application/octet-stream"], ["run.sh", "text/x-sh"], ["page.html", "text/html"], ["x.png.exe", "image/png"], ["svg.svg", "image/svg+xml"]]) {
      const r = await upload(sales, n, Buffer.from("x"), t); expect(r.status, n).toBe(400); expect(r.body.fields.file).toBe("type");
    }
  });
  it("rejects a file over 25 MB", async () => {
    const r = await upload(sales, "big.png", Buffer.alloc(25 * 1024 * 1024 + 1), "image/png");
    expect([400, 413]).toContain(r.status);
  });
  it("a path-traversal file name is stored under a safe key", async () => {
    const r = await upload(sales, "../../etc/passwd.png", png, "image/png");
    expect(r.status).toBe(201); expect(r.body.storageKey).toMatch(/^\d{4}\/[0-9a-f-]{36}\.png$/);
  });
  it("unlinked upload: owner can delete; others cannot see or delete it", async () => {
    const a = (await upload(sales, "a.png", png, "image/png")).body;
    expect((await api(other, `/attachments/${a.id}`)).status).toBe(403);
    expect((await api(other, `/attachments/${a.id}`, { method: "DELETE" })).status).toBe(403);
    expect((await api(sales, `/attachments/${a.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await api(sales, `/attachments/${a.id}`)).status).toBe(404);
  });
  it("linked to a complaint: visible to issuer, QA and the assigned PIC; never deletable; served with the right type", async () => {
    const a = (await upload(sales, "a.png", png, "image/png")).body;
    const c = (await api(sales, "/complaints", { method: "POST", json: validComplaint({ attachmentIds: [a.id] }) })).body.number;
    expect((await api(sales, `/complaints/${c}`)).body.attachments.map((x: any) => x.id)).toEqual([a.id]);
    expect((await api(sales, `/attachments/${a.id}`, { method: "DELETE" })).status).toBe(403);
    expect((await api(other, `/attachments/${a.id}`)).status).toBe(403);
    const r = await fetch(`${BASE()}/attachments/${a.id}`, { headers: { cookie: qa.cookie } });
    expect(r.status).toBe(200); expect(r.headers.get("content-type")).toBe("image/png"); expect((await r.arrayBuffer()).byteLength).toBe(png.length);
    const tr = await api(qa, `/complaints/${c}/triage`, { method: "POST", json: { decision: "ACCEPT", priority: "HIGH", departmentId: (await db.department.findUniqueOrThrow({ where: { code: "PC" } })).id, assigneeId: pic.user.id } });
    expect((await api(pic, `/attachments/${a.id}`)).status).toBe(200);
    expect((await api(pic, `/ncr/${tr.body.ncrNumber}`)).body.complaint.attachments.length).toBe(1);
  });
  it("evidence on an NCR: only the assignee (or QA) may attach; unknown NCR is 404", async () => {
    const { ncr } = await raiseAndAccept(qa, sales);
    const id = (await db.ncr.findUniqueOrThrow({ where: { number: ncr } })).id;
    expect((await upload(other, "e.png", png, "image/png", `?ncrId=${id}`)).status).toBe(403);
    expect((await upload(pic, "e.png", png, "image/png", `?ncrId=00000000-0000-4000-8000-000000000000`)).status).toBe(404);
    const e = await upload(pic, "e.png", png, "image/png", `?ncrId=${id}`); expect(e.status).toBe(201);
    expect((await api(qa, `/ncr/${ncr}`)).body.attachments.map((x: any) => x.id)).toEqual([e.body.id]);
    expect((await api(pic, `/attachments/${e.body.id}`, { method: "DELETE" })).status).toBe(403);
  });
  it("a complaint cannot claim another user's upload", async () => {
    const a = (await upload(pic, "p.png", png, "image/png")).body;
    const c = (await api(sales, "/complaints", { method: "POST", json: validComplaint({ attachmentIds: [a.id] }) })).body.number;
    expect((await api(sales, `/complaints/${c}`)).body.attachments).toEqual([]);
  });
});
