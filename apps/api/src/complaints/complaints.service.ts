import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateComplaint, TriageDecision } from "@jemco/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SlaService } from "../workflow/sla.service";
import type { AuthUser } from "../common/decorators";

const isQA = (u: AuthUser) => u.roles.includes("QA_COORDINATOR") || u.roles.includes("QA_MANAGER");

@Injectable()
export class ComplaintsService {
  constructor(private db: PrismaService, private notify: NotificationsService, private sla: SlaService) {}

  async create(user: AuthUser, input: CreateComplaint) {
    return this.db.asActor(user.id, async (tx) => {
      const [{ n }] = await tx.$queryRaw<{ n: string }[]>`SELECT next_number('CMP') AS n`;
      const c = await tx.complaint.create({
        data: {
          number: n, type: input.type, source: input.source, sourceOther: input.sourceOther,
          process: input.process, processOther: input.processOther, priority: input.priority,
          customerName: input.customerName, supplierName: input.supplierName, poDoNumber: input.poDoNumber,
          deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null, cefNumber: input.cefNumber,
          quantity: input.quantity, quantityUnit: input.quantityUnit, description: input.description,
          raisedById: user.id,
        },
      });
      if (input.attachmentIds.length) {
        await tx.attachment.updateMany({ where: { id: { in: input.attachmentIds }, uploadedById: user.id, complaintId: null }, data: { complaintId: c.id } });
      }
      const qa = await tx.user.findMany({ where: { roles: { some: { role: "QA_COORDINATOR" } }, active: true }, select: { id: true } });
      await this.notify.notify(tx, qa.map((q) => q.id), "COMPLAINT_SUBMITTED", `${n} needs triage`, `${user.name} raised a ${input.priority.toLowerCase()} priority complaint.`, `/qa/triage`);
      return c;
    });
  }

  list(user: AuthUser, status?: string) {
    const where = isQA(user) || user.roles.includes("AUDITOR") ? {} : { raisedById: user.id };
    return this.db.complaint.findMany({
      where: { ...where, ...(status ? { status } : {}) },
      orderBy: { raisedAt: "desc" },
      include: { raisedBy: { select: { name: true } }, ncr: { select: { number: true, state: true } } },
    });
  }

  async get(user: AuthUser, number: string) {
    const c = await this.db.complaint.findUnique({
      where: { number },
      include: { raisedBy: { select: { name: true } }, triagedBy: { select: { name: true } }, attachments: true, ncr: { select: { number: true, state: true } } },
    });
    if (!c) throw new NotFoundException();
    if (!isQA(user) && !user.roles.includes("AUDITOR") && c.raisedById !== user.id) throw new ForbiddenException();
    return c;
  }

  async answerInfo(user: AuthUser, number: string, answer: string) {
    const c = await this.get(user, number);
    if (c.status !== "NEED_MORE_INFO") throw new ForbiddenException("no question is open");
    return this.db.asActor(user.id, async (tx) => {
      const u = await tx.complaint.update({ where: { id: c.id }, data: { status: "SUBMITTED", infoAnswer: answer } });
      const qa = await tx.user.findMany({ where: { roles: { some: { role: "QA_COORDINATOR" } } }, select: { id: true } });
      await this.notify.notify(tx, qa.map((q) => q.id), "COMPLAINT_ANSWERED", `${number} answered`, answer.slice(0, 200), `/qa/triage`);
      return u;
    });
  }

  /** Part 2A. ACCEPT creates the NCR and starts its clocks. */
  async triage(user: AuthUser, number: string, d: TriageDecision) {
    const c = await this.get(user, number);
    if (c.status !== "SUBMITTED") throw new ForbiddenException(`complaint is ${c.status.toLowerCase()}`);
    return this.db.asActor(user.id, async (tx) => {
      const base = { triagedById: user.id, triagedAt: new Date() };
      if (d.decision === "REJECT") {
        await tx.complaint.update({ where: { id: c.id }, data: { ...base, status: "REJECTED", rejectionReason: d.reason, rejectionText: d.reasonText, duplicateOfId: d.duplicateOfComplaintId } });
        await this.notify.notify(tx, [c.raisedById], "COMPLAINT_REJECTED", `${number} was not accepted`, d.reasonText, `/complaints/${number}`);
        return { status: "REJECTED" };
      }
      if (d.decision === "NEED_MORE_INFO") {
        await tx.complaint.update({ where: { id: c.id }, data: { ...base, status: "NEED_MORE_INFO", infoQuestion: d.question, infoAnswer: null } });
        await this.notify.notify(tx, [c.raisedById], "COMPLAINT_QUESTION", `QA has a question about ${number}`, d.question, `/complaints/${number}`);
        return { status: "NEED_MORE_INFO" };
      }
      // ACCEPT
      // Away? Use the routing backup for that process when one exists.
      let assigneeId = d.assigneeId;
      const chosen = await tx.user.findUnique({ where: { id: assigneeId }, select: { outOfOffice: true } });
      if (chosen?.outOfOffice) {
        const route = await tx.routingMap.findUnique({ where: { process: c.process }, include: { backupPic: { select: { id: true, outOfOffice: true, active: true } } } });
        if (route?.backupPic && route.backupPic.active && !route.backupPic.outOfOffice) assigneeId = route.backupPic.id;
      }
      const [{ n }] = await tx.$queryRaw<{ n: string }[]>`SELECT next_number('NCR') AS n`;
      const resolutionDays = await this.sla.daysFor(tx, d.priority, "RESOLUTION");
      const respondBy = await this.sla.dueAfter(tx, resolutionDays);
      const ncr = await tx.ncr.create({
        data: {
          number: n, complaintId: c.id, state: "ASSIGNED", priority: d.priority, departmentId: d.departmentId,
          assigneeId, respondBy, triageNotes: d.notes,
        },
      });
      await tx.transitionLog.create({ data: { ncrId: ncr.id, fromState: null, toState: "ASSIGNED", actorId: user.id, reason: d.priorityChangeReason } });
      await tx.complaint.update({ where: { id: c.id }, data: { ...base, status: "ACCEPTED" } });
      await this.sla.start(tx, ncr.id, "RESPONSE", d.priority);
      await this.sla.start(tx, ncr.id, "RESOLUTION", d.priority);
      const managers = await tx.user.findMany({ where: { departmentId: d.departmentId, roles: { some: { role: "DEPT_MANAGER" } } }, select: { id: true } });
      await this.notify.notify(tx, [assigneeId, ...(assigneeId !== d.assigneeId ? [d.assigneeId] : []), ...managers.map((m) => m.id)], "NCR_ASSIGNED", `${n} assigned to you`, `${d.priority} priority. Respond by ${respondBy.toDateString()}.`, `/ncr/${n}`);
      await this.notify.notify(tx, [c.raisedById], "COMPLAINT_ACCEPTED", `${number} accepted as ${n}`, `Assigned to a PIC. Respond by ${respondBy.toDateString()}.`, `/complaints/${number}`);
      return { status: "ACCEPTED", ncrNumber: n };
    });
  }
}
