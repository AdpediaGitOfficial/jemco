import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser, type AuthUser } from "../common/decorators";

export interface TodoItem {
  kind: "COMPLAINT" | "NCR";
  number: string;
  title: string;
  action: "ANSWER" | "TRIAGE" | "START" | "CONTINUE" | "REWORK" | "VERIFY" | "WATCH";
  priority: string;
  dueAt: string | null;
  link: string;
}

/** The landing page: everything the signed-in person must act on, most urgent first. */
@Controller("todo")
export class TodoController {
  constructor(private db: PrismaService) {}

  @Get()
  async list(@CurrentUser() u: AuthUser): Promise<TodoItem[]> {
    const items: TodoItem[] = [];
    const qa = u.roles.includes("QA_COORDINATOR") || u.roles.includes("QA_MANAGER");

    // Issuer: questions from QA
    const asks = await this.db.complaint.findMany({ where: { raisedById: u.id, status: "NEED_MORE_INFO" }, select: { number: true, infoQuestion: true, priority: true } });
    for (const c of asks) items.push({ kind: "COMPLAINT", number: c.number, title: c.infoQuestion ?? "QA has a question", action: "ANSWER", priority: c.priority, dueAt: null, link: `/complaints/${c.number}` });

    if (qa) {
      const queue = await this.db.complaint.findMany({ where: { status: "SUBMITTED" }, select: { number: true, description: true, priority: true, raisedAt: true }, orderBy: { raisedAt: "asc" } });
      for (const c of queue) items.push({ kind: "COMPLAINT", number: c.number, title: c.description.slice(0, 90), action: "TRIAGE", priority: c.priority, dueAt: null, link: `/qa/triage/${c.number}` });
      const verify = await this.db.ncr.findMany({ where: { state: "AWAITING_VERIFICATION" }, include: { clocks: { where: { stoppedAt: null } }, complaint: { select: { description: true } } } });
      for (const n of verify) items.push({ kind: "NCR", number: n.number, title: n.complaint?.description.slice(0, 90) ?? n.number, action: "VERIFY", priority: n.priority, dueAt: n.clocks[0]?.dueAt.toISOString() ?? null, link: `/qa/verify/${n.number}` });
    }

    const mine = await this.db.ncr.findMany({ where: { assigneeId: u.id, state: { in: ["ASSIGNED", "IN_PROGRESS", "RETURNED"] } }, include: { clocks: { where: { stoppedAt: null } }, complaint: { select: { description: true } } } });
    for (const n of mine) {
      const action = n.state === "ASSIGNED" ? "START" : n.state === "RETURNED" ? "REWORK" : "CONTINUE";
      const due = n.clocks.find((c) => c.kind === "RESOLUTION")?.dueAt ?? n.respondBy;
      items.push({ kind: "NCR", number: n.number, title: n.complaint?.description.slice(0, 90) ?? n.number, action, priority: n.priority, dueAt: due?.toISOString() ?? null, link: `/ncr/${n.number}/action` });
    }

    if (u.roles.includes("DEPT_MANAGER") && u.departmentId) {
      const dept = await this.db.ncr.findMany({ where: { departmentId: u.departmentId, assigneeId: { not: u.id }, state: { in: ["ASSIGNED", "IN_PROGRESS", "RETURNED"] } }, include: { clocks: { where: { stoppedAt: null, breachedAt: { not: null } } }, assignee: { select: { name: true } } } });
      for (const n of dept) if (n.clocks.length) items.push({ kind: "NCR", number: n.number, title: `Overdue with ${n.assignee?.name ?? "unassigned"}`, action: "WATCH", priority: n.priority, dueAt: n.clocks[0].dueAt.toISOString(), link: `/ncr/${n.number}` });
    }

    const rank = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as Record<string, number>;
    return items.sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9") || rank[a.priority] - rank[b.priority]);
  }
}
