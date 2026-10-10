import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/decorators";
import { PrismaService } from "./prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private db: PrismaService) {}
  @Public()
  @Get()
  async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { ok: true, time: new Date().toISOString() };
  }
}
