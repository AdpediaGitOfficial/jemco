import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "./mail.service";
import { renderDigest, renderNotification } from "./templates";

const MAX_ATTEMPTS = 5;

/** Drains the EMAIL notification queue every minute; sends the Monday digest. */
@Injectable()
export class MailScheduler {
  private log = new Logger("mail");
  private draining = false;
  constructor(private db: PrismaService, private mail: MailService) {}
  private origin() { return process.env.WEB_ORIGIN ?? "http://localhost:3000"; }

  @Cron("* * * * *")
  async drain() {
    if (this.draining) return; this.draining = true;
    try {
      const pending = await this.db.notification.findMany({
        where: { channel: "EMAIL", sentAt: null, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: { createdAt: "asc" }, take: 50,
      });
      if (!pending.length) return;
      const users = new Map((await this.db.user.findMany({ where: { id: { in: [...new Set(pending.map((p) => p.userId))] } } })).map((u) => [u.id, u]));
      let sent = 0;
      for (const n of pending) {
        const u = users.get(n.userId);
        if (!u || !u.active || !u.emailEnabled) { await this.db.notification.update({ where: { id: n.id }, data: { sentAt: new Date(), lastError: "skipped: email off" } }); continue; }
        try {
          const { text, html } = renderNotification(u.locale, u.name, n.subject, n.body, n.link, this.origin());
          await this.mail.send({ to: u.email, subject: `[JEMCO NCR] ${n.subject}`, text, html });
          await this.db.notification.update({ where: { id: n.id }, data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null } });
          sent++;
        } catch (e) {
          await this.db.notification.update({ where: { id: n.id }, data: { attempts: { increment: 1 }, lastError: String(e).slice(0, 500) } });
        }
      }
      if (sent) this.log.log(`sent ${sent} email(s)`);
    } finally { this.draining = false; }
  }

  /** Monday 08:00 (server time): every PIC with open items, every manager for their department. */
  @Cron("0 8 * * 1")
  async digest() {
    const users = await this.db.user.findMany({ where: { active: true, emailEnabled: true }, include: { roles: true } });
    for (const u of users) {
      const roles = u.roles.map((r) => r.role);
      const mine = await this.db.ncr.findMany({ where: { assigneeId: u.id, state: { in: ["ASSIGNED", "IN_PROGRESS", "RETURNED"] } }, include: { clocks: { where: { stoppedAt: null } }, complaint: { select: { description: true } } } });
      const dept = roles.includes("DEPT_MANAGER") && u.departmentId
        ? await this.db.ncr.findMany({ where: { departmentId: u.departmentId, assigneeId: { not: u.id }, state: { in: ["ASSIGNED", "IN_PROGRESS", "RETURNED", "AWAITING_VERIFICATION"] } }, include: { clocks: { where: { stoppedAt: null } }, complaint: { select: { description: true } }, assignee: { select: { name: true } } } })
        : [];
      const items = [
        ...mine.map((n) => ({ number: n.number, title: n.complaint?.description.slice(0, 80) ?? n.number, dueAt: n.clocks[0]?.dueAt ?? n.respondBy, link: `/ncr/${n.number}/action` })),
        ...dept.map((n) => ({ number: n.number, title: `${n.assignee?.name ?? "—"}: ${n.complaint?.description.slice(0, 60) ?? ""}`, dueAt: n.clocks[0]?.dueAt ?? n.respondBy, link: `/ncr/${n.number}` })),
      ];
      if (!items.length) continue;
      const { subject, text, html } = renderDigest(u.locale, u.name, items, this.origin());
      try { await this.mail.send({ to: u.email, subject: `[JEMCO NCR] ${subject}`, text, html }); } catch (e) { this.log.error(`digest to ${u.email}: ${e}`); }
    }
  }
}
