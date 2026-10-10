import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** All dropdown/choice-card options in one call; the web caches it. */
@Controller("lookups")
export class LookupsController {
  constructor(private db: PrismaService) {}
  @Get()
  async all() {
    const rows = await this.db.lookupOption.findMany({ where: { active: true }, orderBy: [{ list: "asc" }, { sortOrder: "asc" }] });
    const out: Record<string, typeof rows> = {};
    for (const r of rows) (out[r.list] ??= []).push(r);
    return out;
  }
}
