import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SlaService } from "./sla.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

/** Every 15 minutes: breaches and 50/80% reminders to the clock owner; breaches also to QA. */
@Injectable()
export class SlaScheduler {
  private log = new Logger("sla");
  constructor(private sla: SlaService, private notify: NotificationsService, private db: PrismaService) {}

  @Cron("*/15 * * * *")
  async run() {
    const changed = await this.sla.sweep();
    if (!changed.length) return;
    const qa = await this.db.user.findMany({ where: { roles: { some: { role: "QA_COORDINATOR" } } }, select: { id: true } });
    for (const { clock, level } of changed) {
      const owner = clock.kind === "VERIFICATION" ? qa.map((q) => q.id) : [clock.ncr.assigneeId ?? ""];
      const subject = level === "BREACH" ? `${clock.ncr.number} is overdue` : `${clock.ncr.number} is ${level}% through its ${clock.kind.toLowerCase()} time`;
      const extra = level === "BREACH" ? qa.map((q) => q.id) : [];
      await this.notify.notify(this.db, [...owner, ...extra], `SLA_${level}`, subject, `Due ${clock.dueAt.toDateString()}.`, `/ncr/${clock.ncr.number}`);
    }
    this.log.log(`sweep: ${changed.length} alert(s)`);
  }
}
