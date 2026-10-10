/* Seed: lookup lists, SLA policy, state transitions, departments, routing map,
 * demo users. Idempotent: safe to run again. */
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

const lookups: Array<[string, string, string, string, string?, string?]> = [
  // list, code, en, ms, helpEn, helpMs
  ["type", "CORRECTIVE", "Corrective action", "Tindakan pembetulan", "Something has already gone wrong", "Sesuatu telah berlaku"],
  ["type", "PREVENTIVE", "Preventive action", "Tindakan pencegahan", "Something could go wrong if not fixed", "Sesuatu boleh berlaku jika tidak dibaiki"],
  ["type", "OFI", "Suggestion for improvement", "Cadangan penambahbaikan", "An idea to make things better", "Idea untuk menjadikan lebih baik"],
  ["source", "INTERNAL_FEEDBACK", "Internal feedback", "Maklum balas dalaman"],
  ["source", "INTERNAL_AUDIT", "Internal audit finding", "Penemuan audit dalaman"],
  ["source", "EXTERNAL_AUDIT", "External audit finding", "Penemuan audit luaran"],
  ["source", "MANAGEMENT_REVIEW", "Management review action item", "Tindakan semakan pengurusan"],
  ["source", "SUPPLIER", "Supplier / subcontractor", "Pembekal / subkontraktor"],
  ["source", "CUSTOMER", "Customer feedback", "Maklum balas pelanggan"],
  ["source", "OTHER", "Other", "Lain-lain"],
  ["process", "PROD_HYPER", "Production (Hyper / Special)", "Pengeluaran (Hyper / Khas)"],
  ["process", "PROD_NORMAL", "Production (Normal)", "Pengeluaran (Biasa)"],
  ["process", "POWDER_COATING", "Powder coating", "Salutan serbuk"],
  ["process", "WAREHOUSE", "Warehouse / outgoing", "Gudang / keluar"],
  ["process", "PURCHASING", "Purchasing / incoming", "Pembelian / masuk"],
  ["process", "LOGISTIC", "Logistics", "Logistik"],
  ["process", "QUALITY", "Quality matters", "Hal kualiti"],
  ["process", "SALES_HYPER", "Sales (Hyper / Special)", "Jualan (Hyper / Khas)"],
  ["process", "SALES_NORMAL", "Sales (Normal)", "Jualan (Biasa)"],
  ["process", "OTHER", "Other", "Lain-lain"],
  ["priority", "LOW", "Low", "Rendah", "Respond as availability allows", "Balas apabila ada kelapangan"],
  ["priority", "MEDIUM", "Medium", "Sederhana", "Respond as soon as feasible", "Balas secepat mungkin"],
  ["priority", "HIGH", "High", "Tinggi", "Respond by the deadline; may interrupt other work", "Balas mengikut tarikh akhir; boleh ganggu kerja lain"],
  ["priority", "URGENT", "Urgent / critical", "Segera / kritikal", "Respond immediately with all resources; legal or compliance risk", "Balas segera dengan semua sumber; risiko undang-undang"],
  ["disposition", "REPAIR_BY_SUPPLIER", "Repair / replace by supplier", "Baiki / ganti oleh pembekal"],
  ["disposition", "RETURN_TO_SUPPLIER", "Return to supplier", "Pulangkan kepada pembekal"],
  ["disposition", "CREDIT_NOTE", "Credit note by supplier", "Nota kredit oleh pembekal"],
  ["disposition", "REWORK_INTERNAL", "Rework / repair by production", "Kerja semula oleh pengeluaran"],
  ["disposition", "SPECIAL_ADAPTION", "Special adaption", "Penyesuaian khas"],
  ["disposition", "DISPOSAL", "Disposal", "Pelupusan"],
  ["disposition", "USE_AS_IS", "Use as is (concession)", "Guna seadanya (konsesi)"],
  ["disposition", "OTHER", "Other", "Lain-lain"],
  ["rootCause", "MATERIAL", "Material", "Bahan"],
  ["rootCause", "METHOD", "Method", "Kaedah"],
  ["rootCause", "MACHINE", "Machine", "Mesin"],
  ["rootCause", "MANPOWER", "Manpower", "Tenaga kerja"],
  ["rootCause", "MEASUREMENT", "Measurement", "Pengukuran"],
  ["rootCause", "ENVIRONMENT", "Environment", "Persekitaran"],
  ["rootCause", "SUPPLIER", "Supplier", "Pembekal"],
  ["rootCause", "DESIGN", "Design", "Reka bentuk"],
  ["unit", "PCS", "pcs", "unit"],
  ["unit", "KG", "kg", "kg"],
  ["unit", "M", "m", "m"],
  ["unit", "SET", "set", "set"],
];

const sla = [
  { priority: "URGENT", triageDays: 1, responseDays: 1, resolutionDays: 5, verificationDays: 1 },
  { priority: "HIGH", triageDays: 1, responseDays: 2, resolutionDays: 10, verificationDays: 2 },
  { priority: "MEDIUM", triageDays: 2, responseDays: 5, resolutionDays: 20, verificationDays: 3 },
  { priority: "LOW", triageDays: 3, responseDays: 10, resolutionDays: 30, verificationDays: 5 },
];

const QA = ["QA_COORDINATOR", "QA_MANAGER"];
const transitions: Array<[string, string, string[], boolean]> = [
  ["ASSIGNED", "IN_PROGRESS", ["PIC", ...QA], false],
  ["IN_PROGRESS", "AWAITING_VERIFICATION", ["PIC"], false],
  ["AWAITING_VERIFICATION", "CLOSED", QA, false],
  ["AWAITING_VERIFICATION", "RETURNED", QA, true],
  ["RETURNED", "IN_PROGRESS", ["PIC"], false],
  ["CLOSED", "ASSIGNED", ["QA_MANAGER"], true], // reopen
];

const departments = [
  ["PROD", "Production"], ["PC", "Powder Coating"], ["WH", "Warehouse"], ["PUR", "Purchasing"],
  ["LOG", "Logistics"], ["QA", "QA/QC"], ["SALES", "Sales"],
];
const routing: Array<[string, string]> = [
  ["PROD_HYPER", "PROD"], ["PROD_NORMAL", "PROD"], ["POWDER_COATING", "PC"], ["WAREHOUSE", "WH"],
  ["PURCHASING", "PUR"], ["LOGISTIC", "LOG"], ["QUALITY", "QA"], ["SALES_HYPER", "SALES"],
  ["SALES_NORMAL", "SALES"], ["OTHER", "QA"],
];

async function main() {
  for (const [i, [list, code, labelEn, labelMs, helpEn, helpMs]] of lookups.entries()) {
    await db.lookupOption.upsert({
      where: { list_code: { list, code } },
      update: { labelEn, labelMs, helpEn, helpMs },
      create: { list, code, labelEn, labelMs, helpEn, helpMs, sortOrder: i },
    });
  }
  for (const p of sla) await db.slaPolicy.upsert({ where: { priority: p.priority }, update: p, create: p });
  for (const [fromState, toState, roles, reasonRequired] of transitions) {
    await db.stateTransition.upsert({
      where: { fromState_toState: { fromState, toState } },
      update: { roles, reasonRequired },
      create: { fromState, toState, roles, reasonRequired },
    });
  }
  const deptIds: Record<string, string> = {};
  for (const [code, name] of departments) {
    const d = await db.department.upsert({ where: { code }, update: { name }, create: { code, name } });
    deptIds[code] = d.id;
  }

  // Demo users: one per role. Password for all: "jemco1234" (dev only).
  const hash = await argon2.hash("jemco1234");
  const users = [
    ["aishah@jemco.local", "Aishah", "QA", ["QA_COORDINATOR"]],
    ["qa.manager@jemco.local", "QA Manager", "QA", ["QA_MANAGER", "QA_COORDINATOR"]],
    ["sales@jemco.local", "Sales Rep", "SALES", ["ISSUER"]],
    ["rahman@jemco.local", "Rahman (Production PIC)", "PROD", ["PIC"]],
    ["pc.pic@jemco.local", "Powder Coating PIC", "PC", ["PIC"]],
    ["wh.pic@jemco.local", "Warehouse PIC", "WH", ["PIC"]],
    ["pur.pic@jemco.local", "Purchasing PIC", "PUR", ["PIC"]],
    ["log.pic@jemco.local", "Logistics PIC", "LOG", ["PIC"]],
    ["prod.manager@jemco.local", "Production Manager", "PROD", ["DEPT_MANAGER"]],
    ["auditor@jemco.local", "ISO Auditor", null, ["AUDITOR"]],
  ] as const;
  const userIds: Record<string, string> = {};
  for (const [email, name, dept, roles] of users) {
    const u = await db.user.upsert({
      where: { email },
      update: { name, departmentId: dept ? deptIds[dept] : null },
      create: { email, name, passwordHash: hash, departmentId: dept ? deptIds[dept] : null },
    });
    userIds[email] = u.id;
    for (const role of roles) {
      await db.userRole.upsert({ where: { userId_role: { userId: u.id, role } }, update: {}, create: { userId: u.id, role } });
    }
  }
  const picByDept: Record<string, string> = {
    PROD: userIds["rahman@jemco.local"], PC: userIds["pc.pic@jemco.local"], WH: userIds["wh.pic@jemco.local"],
    PUR: userIds["pur.pic@jemco.local"], LOG: userIds["log.pic@jemco.local"], QA: userIds["aishah@jemco.local"],
    SALES: userIds["sales@jemco.local"],
  };
  for (const [process, dept] of routing) {
    await db.routingMap.upsert({
      where: { process },
      update: { departmentId: deptIds[dept], primaryPicId: picByDept[dept] },
      create: { process, departmentId: deptIds[dept], primaryPicId: picByDept[dept] },
    });
  }
  // Malaysian public holidays 2026 (national); QA edits the rest in admin.
  const holidays: Array<[string, string]> = [
    ["2026-01-01", "New Year"], ["2026-02-17", "Chinese New Year"], ["2026-02-18", "Chinese New Year"],
    ["2026-03-20", "Hari Raya Aidilfitri"], ["2026-03-21", "Hari Raya Aidilfitri"], ["2026-05-01", "Labour Day"],
    ["2026-05-27", "Hari Raya Haji"], ["2026-05-31", "Wesak Day"], ["2026-06-01", "Agong's Birthday"],
    ["2026-06-16", "Awal Muharram"], ["2026-08-25", "Maulidur Rasul"], ["2026-08-31", "National Day"],
    ["2026-09-16", "Malaysia Day"], ["2026-11-08", "Deepavali"], ["2026-12-25", "Christmas"],
  ];
  for (const [date, reason] of holidays) {
    await db.workingCalendar.upsert({ where: { date: new Date(date) }, update: { reason }, create: { date: new Date(date), reason } });
  }
  console.log("seeded");
}

main().finally(() => db.$disconnect());
