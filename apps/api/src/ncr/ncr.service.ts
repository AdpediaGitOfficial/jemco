import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { SaveAction, VerifyInput } from "@jemco/shared";
import { PrismaService } from "../prisma/prisma.service";
import { WorkflowService } from "../workflow/workflow.service";
import { SlaService } from "../workflow/sla.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { AuthUser } from "../common/decorators";

const isQA = (u: AuthUser) => u.roles.includes("QA_COORDINATOR") || u.roles.includes("QA_MANAGER");
const EFFECTIVENESS_DAYS = 90;

const detail = {
  complaint: { select: { number: true, type: true, source: true, process: true, customerName: true, supplierName: true, poDoNumber: true, quantity: true, quantityUnit: true, description: true, raisedAt: true, raisedBy: { select: { name: true } }, attachments: true } },
  department: { select: { name: true } },
  assignee: { select: { id: true, name: true } },
  verifiedBy: { select: { name: true } },
  actions: { orderBy: { createdAt: "asc" as const }, include: { owner: { select: { name: true } } } },
  clocks: { where: { stoppedAt: null } },
  transitions: { orderBy: { at: "asc" as const }, include: { actor: { select: { name: true } } } },
  attachments: true,
};

@Injectable()
export class NcrService {
  constructor(private db: PrismaService, private wf: WorkflowService, private sla: SlaService, private notify: NotificationsService) {}

  list(user: AuthUser, state?: string) {
    const scope = isQA(user) || user.roles.includes("AUDITOR") ? {}
      : user.roles.includes("DEPT_MANAGER") && user.departmentId ? { departmentId: user.departmentId }
      : { assigneeId: user.id };
    return this.db.ncr.findMany({
      where: { ...scope, ...(state ? { state } : {}) },
      orderBy: [{ respondBy: "asc" }],
      include: { complaint: { select: { number: true, process: true, customerName: true, supplierName: true } }, assignee: { select: { name: true } }, department: { select: { name: true } }, clocks: { where: { stoppedAt: null } } },
    });
  }

  async get(user: AuthUser, number: string) {
    const n = await this.db.ncr.findUnique({ where: { number }, include: detail });
    if (!n) throw new NotFoundException();
    const allowed = isQA(user) || user.roles.includes("AUDITOR") || n.assigneeId === user.id
      || (user.roles.includes("DEPT_MANAGER") && n.departmentId === user.departmentId);
    if (!allowed) throw new ForbiddenException();
    // Part 3 is QA-only
    if (!isQA(user) && !user.roles.includes("AUDITOR")) {
      return { ...n, dispositions: [], dispositionNote: null, costOfNc: null, qaJustification: null };
    }
    return n;
  }

  private async assigneeOnly(user: AuthUser, number: string) {
    const n = await this.db.ncr.findUnique({ where: { number } });
    if (!n) throw new NotFoundException();
    if (n.assigneeId !== user.id && !isQA(user)) throw new ForbiddenException("only the assigned PIC can do this");
    return n;
  }

  /** PIC opens the record: ASSIGNED -> IN_PROGRESS, response clock stops. */
  async start(user: AuthUser, number: string) {
    const n = await this.assigneeOnly(user, number);
    if (n.state !== "ASSIGNED") return n;
    return this.db.asActor(user.id, async (tx) => {
      await this.sla.stop(tx, n.id, "RESPONSE");
      return this.wf.transition(tx, n.id, "IN_PROGRESS", user);
    });
  }

  /** Part 2B draft save; allowed in IN_PROGRESS and RETURNED. */
  async saveAction(user: AuthUser, number: string, body: SaveAction) {
    const n = await this.assigneeOnly(user, number);
    if (!["ASSIGNED", "IN_PROGRESS", "RETURNED"].includes(n.state)) throw new ForbiddenException(`cannot edit while ${n.state.toLowerCase()}`);
    return this.db.asActor(user.id, async (tx) => {
      if (n.state === "ASSIGNED") { await this.sla.stop(tx, n.id, "RESPONSE"); await this.wf.transition(tx, n.id, "IN_PROGRESS", user); }
      if (n.state === "RETURNED") await this.wf.transition(tx, n.id, "IN_PROGRESS", user);
      await tx.ncr.update({ where: { id: n.id }, data: { containment: body.containment, rootCause: body.rootCause, rootCauseCategory: body.rootCauseCategory, actionPlan: body.actionPlan } });
      // Action items: upsert given ids, mark the rest done=false but keep (never delete).
      const keep: string[] = [];
      for (const a of body.actions) {
        const row = a.id
          ? await tx.action.update({ where: { id: a.id }, data: { description: a.description, ownerId: a.ownerId, dueDate: new Date(a.dueDate), done: a.done, doneAt: a.done ? new Date() : null } })
          : await tx.action.create({ data: { ncrId: n.id, description: a.description, ownerId: a.ownerId, dueDate: new Date(a.dueDate), done: a.done, doneAt: a.done ? new Date() : null } });
        keep.push(row.id);
      }
      return tx.ncr.findUniqueOrThrow({ where: { id: n.id }, include: detail });
    });
  }

  /** PIC submits to QA: IN_PROGRESS -> AWAITING_VERIFICATION. */
  async submit(user: AuthUser, number: string) {
    const n = await this.db.ncr.findUnique({ where: { number }, include: { actions: true, complaint: { select: { type: true } } } });
    if (!n) throw new NotFoundException();
    if (n.assigneeId !== user.id) throw new ForbiddenException("only the assigned PIC can submit");
    const missing: string[] = [];
    if (n.complaint?.type !== "OFI" && !n.rootCause?.trim()) missing.push("rootCause");
    if (!n.actionPlan?.trim()) missing.push("actionPlan");
    if (!n.actions.length) missing.push("actions");
    if (n.actions.some((a) => !a.done)) missing.push("actionsDone");
    if (missing.length) throw new BadRequestException({ message: "incomplete", fields: Object.fromEntries(missing.map((m) => [m, "required"])) });
    return this.db.asActor(user.id, async (tx) => {
      await tx.ncr.update({ where: { id: n.id }, data: { completedAt: new Date() } });
      await this.sla.stop(tx, n.id, "RESOLUTION");
      await this.sla.start(tx, n.id, "VERIFICATION", n.priority);
      const r = await this.wf.transition(tx, n.id, "AWAITING_VERIFICATION", user);
      const qa = await tx.user.findMany({ where: { roles: { some: { role: "QA_COORDINATOR" } } }, select: { id: true } });
      await this.notify.notify(tx, qa.map((q) => q.id), "NCR_SUBMITTED", `${number} is ready to verify`, `${user.name} completed the corrective action.`, `/qa/verify`);
      return r;
    });
  }

  /** Part 3. */
  async verify(user: AuthUser, number: string, body: VerifyInput) {
    const n = await this.db.ncr.findUnique({ where: { number } });
    if (!n) throw new NotFoundException();
    if (n.state !== "AWAITING_VERIFICATION") throw new ForbiddenException("nothing to verify");
    return this.db.asActor(user.id, async (tx) => {
      await this.sla.stop(tx, n.id, "VERIFICATION");
      const base = { verifiedById: user.id, verifiedAt: new Date(), verificationResult: body.result, qaJustification: body.qaJustification };
      if (body.result === "SATISFACTORY") {
        const effectivenessDue = await this.sla.dueAfter(tx, EFFECTIVENESS_DAYS);
        await tx.ncr.update({ where: { id: n.id }, data: { ...base, dispositions: body.dispositions, dispositionNote: body.dispositionNote, costOfNc: body.costOfNc, effectivenessDue } });
        const r = await this.wf.transition(tx, n.id, "CLOSED", user);
        const c = n.complaintId ? await tx.complaint.findUnique({ where: { id: n.complaintId }, select: { raisedById: true } }) : null;
        await this.notify.notify(tx, [n.assigneeId ?? "", c?.raisedById ?? ""], "NCR_CLOSED", `${number} closed`, "QA verified the corrective action as satisfactory.", `/ncr/${number}`);
        return r;
      }
      // NON_SATISFACTORY: return, reset resolution clock to half, escalate on repeats
      const returnCount = n.returnCount + 1;
      await tx.ncr.update({ where: { id: n.id }, data: { ...base, returnReason: body.returnReason, returnCount, completedAt: null } });
      const half = Math.ceil((await this.sla.daysFor(tx, n.priority, "RESOLUTION")) / 2);
      await this.sla.start(tx, n.id, "RESOLUTION", n.priority, half);
      const r = await this.wf.transition(tx, n.id, "RETURNED", user, body.returnReason);
      const managers = await tx.user.findMany({ where: { departmentId: n.departmentId, roles: { some: { role: "DEPT_MANAGER" } } }, select: { id: true } });
      const escalate = returnCount >= 2 ? await tx.user.findMany({ where: { roles: { some: { role: "QA_MANAGER" } } }, select: { id: true } }) : [];
      await this.notify.notify(tx, [n.assigneeId ?? "", ...managers.map((m) => m.id), ...escalate.map((e) => e.id)], "NCR_RETURNED",
        `${number} returned for further work${returnCount >= 2 ? ` (return ${returnCount})` : ""}`, body.returnReason, `/ncr/${number}`);
      return r;
    });
  }

  async reopen(user: AuthUser, number: string, reason: string) {
    const n = await this.db.ncr.findUnique({ where: { number } });
    if (!n) throw new NotFoundException();
    return this.db.asActor(user.id, async (tx) => {
      const r = await this.wf.transition(tx, n.id, "ASSIGNED", user, reason);
      await this.sla.start(tx, n.id, "RESOLUTION", n.priority);
      await this.notify.notify(tx, [n.assigneeId ?? ""], "NCR_REOPENED", `${number} reopened`, reason, `/ncr/${number}`);
      return r;
    });
  }
}
