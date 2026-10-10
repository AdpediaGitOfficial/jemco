import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Daily 08:30: remind QA 7 days before an effectiveness review is due, and
 * once more when it is overdue. Each reminder is sent once per NCR.
 */
@Injectable()
export class EffectivenessScheduler {
  private log = new Logger("effectiveness");
  constructor(private db: PrismaService, private notify: NotificationsService) {}

  @Cron("30 8 * * *")
  async run() { return this.sweep(); }

  async sweep() {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const soon = new Date(today.getTime() + 7 * 86400_000);
    const due = await this.db.ncr.findMany({ where: { state: "CLOSED", effectivenessResult: null, effectivenessDue: { lte: soon } }, select: { id: true, number: true, effectivenessDue: true } });
    if (!due.length) return 0;
    const qa = (await this.db.user.findMany({ where: { active: true, roles: { some: { role: { in: ["QA_COORDINATOR", "QA_MANAGER"] } } } }, select: { id: true } })).map((u) => u.id);
    let sent = 0;
    for (const n of due) {
      const overdue = n.effectivenessDue! < today;
      const event = overdue ? "EFFECTIVENESS_OVERDUE" : "EFFECTIVENESS_DUE";
      const already = await this.db.notification.findFirst({ where: { event, link: `/ncr/${n.number}` } });
      if (already) continue;
      const when = n.effectivenessDue!.toISOString().slice(0, 10);
      await this.notify.notify(this.db, qa, event,
        overdue ? `${n.number}: effectiveness review is overdue` : `${n.number}: effectiveness review due ${when}`,
        overdue ? "The corrective action closed 90 working days ago has not been reviewed for effectiveness. Review it and record the result." : "Check whether the corrective action has held, then record Effective, Not effective or Not applicable.",
        `/ncr/${n.number}`);
      sent++;
    }
    if (sent) this.log.log(`${sent} reminder(s)`);
    return sent;
  }
}
