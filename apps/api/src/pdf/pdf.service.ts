import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../attachments/storage";
import { renderForm, type FormData } from "./form.template";

const FORM_VERSION = "F/QP/004-01 (V4)";
const fmt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * Renders an NCR as the paper form with headless Chromium (playwright-core).
 * Set CHROMIUM_PATH in production, or run on the Playwright base image.
 * The PDF is cached in storage per record version.
 */
@Injectable()
export class PdfService {
  private log = new Logger("pdf");
  private logo: string;
  constructor(private db: PrismaService, private storage: StorageService) {
    const p = [join(__dirname, "..", "assets", "logo.png"), join(process.cwd(), "assets", "logo.png")].find(existsSync);
    this.logo = p ? `data:image/png;base64,${readFileSync(p).toString("base64")}` : "";
  }

  private async chromium() {
    const { chromium } = await import("playwright-core");
    const executablePath = process.env.CHROMIUM_PATH || undefined;
    return chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  }

  async forNcr(number: string, showPart3: boolean): Promise<{ key: string; buffer: Buffer }> {
    const n = await this.db.ncr.findUniqueOrThrow({
      where: { number },
      include: {
        complaint: { include: { raisedBy: true, attachments: true } }, department: true, assignee: true, verifiedBy: true,
        actions: { include: { owner: true }, orderBy: { createdAt: "asc" } }, attachments: true,
        transitions: { include: { actor: true }, orderBy: { at: "asc" } },
      },
    });
    const key = `pdf/${n.number}-${n.updatedAt.getTime()}-${showPart3 ? "full" : "part2"}.pdf`;
    try { const s = await this.storage.get(key); const chunks: Buffer[] = []; for await (const c of s) chunks.push(c as Buffer); if (chunks.length) return { key, buffer: Buffer.concat(chunks) }; } catch { /* not cached */ }

    const lk = await this.db.lookupOption.findMany({ orderBy: { sortOrder: "asc" } });
    const opts = (list: string) => lk.filter((o) => o.list === list && (o.active || o.code === (list === "process" ? n.complaint?.process : ""))).map((o) => ({ code: o.code, label: o.labelEn }));
    const label = (list: string, code: string | null) => lk.find((o) => o.list === list && o.code === code)?.labelEn ?? code ?? "";
    const c = n.complaint;
    const data: FormData = {
      number: n.number, date: fmt(c?.raisedAt ?? n.createdAt), version: FORM_VERSION,
      type: c?.type ?? "", source: c?.source ?? "", process: c?.process ?? "", priority: n.priority,
      typeOptions: opts("type"), sourceOptions: opts("source"), processOptions: opts("process"), priorityOptions: opts("priority"), dispositionOptions: opts("disposition"),
      supplierName: c?.supplierName ?? "", customerName: c?.customerName ?? "", poDoNumber: c?.poDoNumber ?? "", deliveryDate: fmt(c?.deliveryDate), cefNumber: c?.cefNumber ?? "",
      quantity: c ? `${c.quantity} ${label("unit", c.quantityUnit)}` : "",
      issue: c?.description ?? "", issuedBy: c?.raisedBy.name ?? "", dateAssigned: fmt(n.createdAt), respondBy: fmt(n.respondBy), assignee: n.assignee?.name ?? "", department: n.department.name,
      rootCause: n.rootCause ?? "", rootCauseCategory: label("rootCause", n.rootCauseCategory), containment: n.containment ?? "", actionPlan: n.actionPlan ?? "",
      actions: n.actions.map((a) => ({ description: a.description, owner: a.owner.name, due: fmt(a.dueDate), done: a.done })),
      dateCompleted: fmt(n.completedAt), completedBy: n.completedAt ? n.assignee?.name ?? "" : "",
      showPart3, dispositions: n.dispositions, dispositionNote: n.dispositionNote ?? "", cost: n.costOfNc ? String(n.costOfNc) : "",
      result: n.verificationResult ?? "", verifiedBy: n.verifiedBy?.name ?? "", verifiedDate: fmt(n.verifiedAt), qaRemarks: n.qaJustification ?? "",
      effectiveness: n.effectivenessResult ? `${n.effectivenessResult}${n.effectivenessNotes ? ` — ${n.effectivenessNotes}` : ""} (${fmt(n.effectivenessReviewedAt)})` : n.effectivenessDue ? `Review due ${fmt(n.effectivenessDue)}` : "",
      attachments: [...(c?.attachments ?? []), ...n.attachments].map((a) => a.fileName),
      history: n.transitions.map((t) => ({ when: t.at.toISOString().replace("T", " ").slice(0, 16), who: t.actor.name, what: `${t.fromState ?? "—"} → ${t.toState}`, reason: t.reason ?? "" })),
      logoDataUrl: this.logo, generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
    };
    let browser;
    try { browser = await this.chromium(); } catch (e) { this.log.error(`chromium unavailable: ${e}`); throw new ServiceUnavailableException("PDF renderer unavailable"); }
    try {
      const page = await browser.newPage();
      await page.setContent(renderForm(data), { waitUntil: "load" });
      const buffer = Buffer.from(await page.pdf({ format: "A4", printBackground: true, displayHeaderFooter: false }));
      await this.storage.put(key, buffer, "application/pdf");
      return { key, buffer };
    } finally { await browser.close(); }
  }
}
