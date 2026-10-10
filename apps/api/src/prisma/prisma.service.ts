import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Prisma client plus `asActor(userId, fn)`: runs `fn` in a transaction with
 * `app.actor_id` set, so the audit trigger records who made the change.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }

  asActor<T>(actorId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.actor_id', '${actorId.replace(/'/g, "")}', true)`);
      return fn(tx);
    });
  }
}
