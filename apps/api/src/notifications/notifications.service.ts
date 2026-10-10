import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * In-app notifications now; the `channel` column already allows EMAIL and
 * WHATSAPP so adapters can be added without a schema change.
 */
@Injectable()
export class NotificationsService {
  private log = new Logger("notifications");
  constructor(private db: PrismaService) {}

  async notify(tx: Prisma.TransactionClient | PrismaService, userIds: string[], event: string, subject: string, body: string, link?: string) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return;
    await tx.notification.createMany({ data: ids.flatMap((userId) => [{ userId, event, subject, body, link, channel: "IN_APP" }, { userId, event, subject, body, link, channel: "EMAIL" }]) });
    this.log.log(`${event} -> ${ids.length} user(s): ${subject}`);
  }

  forUser(userId: string) {
    return this.db.notification.findMany({ where: { userId, channel: "IN_APP" }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  async markRead(userId: string, id: string) {
    await this.db.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  }
}
