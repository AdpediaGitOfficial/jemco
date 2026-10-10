/* Demo dataset for UAT and screenshots: ~60 NCRs spread over the last 12 months
 * in realistic states. Never run against production. Idempotent by number prefix DEMO. */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rnd(a.length)];
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000);

const processes = ["PROD_NORMAL", "PROD_NORMAL", "PROD_HYPER", "POWDER_COATING", "POWDER_COATING", "WAREHOUSE", "PURCHASING", "LOGISTIC", "SALES_NORMAL"];
const deptOf: Record<string, string> = { PROD_NORMAL: "PROD", PROD_HYPER: "PROD", POWDER_COATING: "PC", WAREHOUSE: "WH", PURCHASING: "PUR", LOGISTIC: "LOG", SALES_NORMAL: "SALES" };
const sources = ["CUSTOMER", "CUSTOMER", "CUSTOMER", "INTERNAL_FEEDBACK", "SUPPLIER", "INTERNAL_AUDIT", "EXTERNAL_AUDIT"];
const priorities = ["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "URGENT"];
const customers = ["Syarikat Maju Sdn Bhd", "Tenaga Eng", "Perkasa Metal", "KL Switchgear", "Borneo Panels", "Selangor Fabrication"];
const suppliers = ["Nippon Powder", "Jotun Coatings", "Steelcorp Malaysia", "Fastenal Asia"];
const issues = ["Powder coat peeling on folded edge", "Dented corners after transport", "Wrong size delivered (L instead of XL bracket)", "Missing fasteners in kit", "Scratches on visible face", "Colour mismatch RAL 7035 vs 7016", "Late delivery by 4 days", "Weld spatter not cleaned", "Incorrect drawing revision used", "Label missing on carton"];
const categories = ["MANPOWER", "METHOD", "MATERIAL", "MACHINE", "SUPPLIER", "MEASUREMENT", "ENVIRONMENT", "DESIGN"];
const dispositions = [["REWORK_INTERNAL"], ["REWORK_INTERNAL"], ["RETURN_TO_SUPPLIER"], ["CREDIT_NOTE"], ["USE_AS_IS"], ["DISPOSAL"], ["REPAIR_BY_SUPPLIER", "CREDIT_NOTE"]];

async function main() {
  const existing = await db.complaint.count({ where: { number: { startsWith: "DEMO" } } });
  if (existing) { console.log(`demo data already present (${existing}); delete rows with number LIKE 'DEMO%' first to regenerate`); return; }
  const depts = Object.fromEntries((await db.department.findMany()).map((d) => [d.code, d.id]));
  const users = await db.user.findMany({ include: { roles: true } });
  const qa = users.find((u) => u.email === "aishah@jemco.local")!;
  const sales = users.find((u) => u.email === "sales@jemco.local")!;
  const picFor = (code: string) => users.find((u) => u.departmentId === depts[code] && u.roles.some((r) => r.role === "PIC")) ?? users.find((u) => u.roles.some((r) => r.role === "PIC"))!;
  const sla = Object.fromEntries((await db.slaPolicy.findMany()).map((p) => [p.priority, p]));

  for (let i = 0; i < 60; i++) {
    const age = 2 + rnd(360); const raised = daysAgo(age);
    const process = pick(processes); const source = pick(sources); const priority = pick(priorities);
    const dept = deptOf[process]; const pic = picFor(dept);
    const n = String(i + 1).padStart(4, "0");
    const c = await db.complaint.create({ data: {
      number: `DEMO-C-${n}`, type: Math.random() < 0.85 ? "CORRECTIVE" : "PREVENTIVE", source, process, priority,
      customerName: source === "CUSTOMER" ? pick(customers) : null, supplierName: source === "SUPPLIER" ? pick(suppliers) : null,
      poDoNumber: `PO-${1000 + rnd(9000)}`, quantity: 1 + rnd(50), quantityUnit: "PCS",
      description: `${pick(issues)}. Reported by ${sales.name}; goods currently at ${Math.random() < 0.5 ? "customer site" : "our warehouse"} awaiting instruction.`,
      status: "ACCEPTED", raisedById: sales.id, raisedAt: raised, triagedById: qa.id, triagedAt: new Date(raised.getTime() + 86400_000),
    } });
    // Lifecycle: older ones are closed; recent ones open in various states; a few overdue.
    const resolutionDays = sla[priority].resolutionDays;
    const target = Math.round(resolutionDays * (0.5 + Math.random()));          // actual days taken
    const closed = age > target + 3 && Math.random() < 0.9;
    const state = closed ? "CLOSED" : pick(["ASSIGNED", "IN_PROGRESS", "IN_PROGRESS", "AWAITING_VERIFICATION", "RETURNED"]);
    const returnCount = Math.random() < 0.2 ? 1 : Math.random() < 0.05 ? 2 : 0;
    const completedAt = closed || state === "AWAITING_VERIFICATION" ? new Date(raised.getTime() + target * 86400_000) : null;
    const verifiedAt = closed ? new Date(raised.getTime() + (target + 1 + rnd(3)) * 86400_000) : null;
    const ncr = await db.ncr.create({ data: {
      number: `DEMO-${n}`, complaintId: c.id, state, priority, departmentId: depts[dept], assigneeId: pic.id,
      respondBy: new Date(raised.getTime() + resolutionDays * 86400_000), returnCount, createdAt: new Date(raised.getTime() + 86400_000),
      containment: "Affected items quarantined and tagged.", rootCause: "Five-why: operator step skipped because the traveller did not list it.", rootCauseCategory: pick(categories),
      actionPlan: "Traveller updated; operators re-briefed; check added to final inspection.", completedAt, verifiedAt,
      verifiedById: closed ? qa.id : null, verificationResult: closed ? "SATISFACTORY" : null,
      dispositions: closed ? pick(dispositions) : [], costOfNc: closed ? 50 + rnd(2500) : null, qaJustification: closed ? "Evidence reviewed on the floor." : null,
      effectivenessDue: closed ? new Date(verifiedAt!.getTime() + 90 * 86400_000) : null,
    } });
    await db.transitionLog.createMany({ data: [
      { ncrId: ncr.id, fromState: null, toState: "ASSIGNED", actorId: qa.id, at: ncr.createdAt },
      ...(state !== "ASSIGNED" ? [{ ncrId: ncr.id, fromState: "ASSIGNED", toState: "IN_PROGRESS", actorId: pic.id, at: new Date(ncr.createdAt.getTime() + 86400_000) }] : []),
      ...(closed ? [{ ncrId: ncr.id, fromState: "IN_PROGRESS", toState: "AWAITING_VERIFICATION", actorId: pic.id, at: completedAt! }, { ncrId: ncr.id, fromState: "AWAITING_VERIFICATION", toState: "CLOSED", actorId: qa.id, at: verifiedAt! }] : []),
    ] });
    // Clocks: resolution clock, stopped when completed; open ones may be overdue.
    const due = new Date(ncr.createdAt.getTime() + resolutionDays * 86400_000);
    await db.slaClock.create({ data: { ncrId: ncr.id, kind: "RESOLUTION", startedAt: ncr.createdAt, dueAt: due, stoppedAt: completedAt, breachedAt: (completedAt ?? new Date()) > due ? due : null } });
    if (closed) await db.slaClock.create({ data: { ncrId: ncr.id, kind: "VERIFICATION", startedAt: completedAt!, dueAt: new Date(completedAt!.getTime() + sla[priority].verificationDays * 86400_000), stoppedAt: verifiedAt } });
    if (i % 10 === 9 && i > 10) await db.ncrLink.create({ data: { fromId: ncr.id, toId: (await db.ncr.findFirst({ where: { number: `DEMO-${String(i - 9).padStart(4, "0")}` } }))!.id, kind: "RECURRENCE_OF" } });
  }
  console.log("demo data: 60 complaints + NCRs");
}
main().finally(() => db.$disconnect());
