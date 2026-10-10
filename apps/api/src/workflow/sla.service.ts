import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient;
type Kind = "TRIAGE" | "RESPONSE" | "RESOLUTION" | "VERIFICATION";

/** SLA clocks are rows, computed with the database's working-day function so alerts and reports agree. */
@Injectable()
export class SlaService {
  constructor(private db: PrismaService) {}

  async daysFor(tx: Tx, priority: string, kind: Kind): Promise<number> {
    const p = await tx.slaPolicy.findUniqueOrThrow({ where: { priority } });
    return { TRIAGE: p.triageDays, RESPONSE: p.responseDays, RESOLUTION: p.resolutionDays, VERIFICATION: p.verificationDays }[kind];
  }

  async dueAfter(tx: Tx, workingDays: number, from = new Date()): Promise<Date> {
    const [{ due }] = await tx.$queryRaw<{ due: Date }[]>`SELECT add_working_days(${from}::date, ${workingDays}::int) AS due`;
    // due at end of that working day
    const d = new Date(due); d.setUTCHours(23, 59, 59, 0);
    return d;
  }

  async start(tx: Tx, ncrId: string, kind: Kind, priority: string, daysOverride?: number) {
    const days = daysOverride ?? (await this.daysFor(tx, priority, kind));
    const dueAt = await this.dueAfter(tx, days);
    return tx.slaClock.create({ data: { ncrId, kind, startedAt: new Date(), dueAt } });
  }

  async stop(tx: Tx, ncrId: string, kind: Kind) {
    await tx.slaClock.updateMany({ where: { ncrId, kind, stoppedAt: null }, data: { stoppedAt: new Date() } });
  }

  /** Called by the scheduler: mark breaches and emit 50% / 80% alerts. Returns clocks that changed. */
  async sweep() {
    const now = new Date();
    const open = await this.db.slaClock.findMany({ where: { stoppedAt: null }, include: { ncr: { select: { number: true, assigneeId: true, priority: true } } } });
    const changed: Array<{ clock: typeof open[number]; level: "50" | "80" | "BREACH" }> = [];
    for (const c of open) {
      const total = c.dueAt.getTime() - c.startedAt.getTime();
      const elapsed = now.getTime() - c.startedAt.getTime();
      const pct = total > 0 ? elapsed / total : 1;
      if (pct >= 1 && !c.breachedAt) {
        await this.db.slaClock.update({ where: { id: c.id }, data: { breachedAt: now } });
        changed.push({ clock: c, level: "BREACH" });
      } else if (pct >= 0.8 && !c.alert80At) {
        await this.db.slaClock.update({ where: { id: c.id }, data: { alert80At: now } });
        changed.push({ clock: c, level: "80" });
      } else if (pct >= 0.5 && !c.alert50At) {
        await this.db.slaClock.update({ where: { id: c.id }, data: { alert50At: now } });
        changed.push({ clock: c, level: "50" });
      }
    }
    return changed;
  }
}
