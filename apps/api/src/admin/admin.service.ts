import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import argon2 from "argon2";
import { randomBytes } from "crypto";
import { z } from "zod";
import type { CreateUserSchema, HolidaySchema, LookupOptionPatchSchema, LookupOptionSchema, PatchUserSchema, RoutingSchema, SlaPolicySchema } from "@jemco/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/decorators";

type Lookup = z.infer<typeof LookupOptionSchema>; type LookupPatch = z.infer<typeof LookupOptionPatchSchema>;
type Routing = z.infer<typeof RoutingSchema>; type Sla = z.infer<typeof SlaPolicySchema>; type Holiday = z.infer<typeof HolidaySchema>;
type CreateUser = z.infer<typeof CreateUserSchema>; type PatchUser = z.infer<typeof PatchUserSchema>;

const LISTS = ["type", "source", "process", "priority", "disposition", "rootCause", "unit"];
/** Codes the workflow depends on; they can be relabelled, never deactivated. */
const PROTECTED = new Set(["type:CORRECTIVE", "type:PREVENTIVE", "type:OFI", "source:CUSTOMER", "source:SUPPLIER", "source:OTHER", "process:OTHER", "priority:LOW", "priority:MEDIUM", "priority:HIGH", "priority:URGENT"]);

@Injectable()
export class AdminService {
  constructor(private db: PrismaService) {}

  // ---- lookups ----
  lookups() { return this.db.lookupOption.findMany({ orderBy: [{ list: "asc" }, { sortOrder: "asc" }] }); }
  async addLookup(actor: AuthUser, list: string, o: Lookup) {
    if (!LISTS.includes(list)) throw new BadRequestException({ message: "validation", fields: { list: "unknown" } });
    if (await this.db.lookupOption.findUnique({ where: { list_code: { list, code: o.code } } })) throw new BadRequestException({ message: "validation", fields: { code: "exists" } });
    const max = await this.db.lookupOption.aggregate({ where: { list }, _max: { sortOrder: true } });
    return this.db.asActor(actor.id, (tx) => tx.lookupOption.create({ data: { list, ...o, sortOrder: o.sortOrder ?? (max._max.sortOrder ?? 0) + 1 } }));
  }
  async patchLookup(actor: AuthUser, list: string, code: string, p: LookupPatch) {
    if (!(await this.db.lookupOption.findUnique({ where: { list_code: { list, code } } }))) throw new NotFoundException();
    if (p.active === false && PROTECTED.has(`${list}:${code}`)) throw new BadRequestException({ message: "validation", fields: { active: "protected" } });
    return this.db.asActor(actor.id, (tx) => tx.lookupOption.update({ where: { list_code: { list, code } }, data: p }));
  }

  // ---- routing ----
  routing() { return this.db.routingMap.findMany({ include: { department: true, primaryPic: { select: { id: true, name: true } }, backupPic: { select: { id: true, name: true } } }, orderBy: { process: "asc" } }); }
  setRouting(actor: AuthUser, process: string, r: Routing) {
    return this.db.asActor(actor.id, (tx) => tx.routingMap.upsert({ where: { process }, update: r, create: { process, ...r } }));
  }

  // ---- SLA ----
  sla() { return this.db.slaPolicy.findMany(); }
  setSla(actor: AuthUser, priority: string, p: Sla) {
    return this.db.asActor(actor.id, (tx) => tx.slaPolicy.update({ where: { priority }, data: p }));
  }

  // ---- calendar ----
  calendar(year: number) {
    return this.db.workingCalendar.findMany({ where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } }, orderBy: { date: "asc" } });
  }
  addHoliday(actor: AuthUser, h: Holiday) {
    return this.db.asActor(actor.id, (tx) => tx.workingCalendar.upsert({ where: { date: new Date(h.date) }, update: { reason: h.reason }, create: { date: new Date(h.date), reason: h.reason } }));
  }
  removeHoliday(actor: AuthUser, date: string) {
    return this.db.asActor(actor.id, (tx) => tx.workingCalendar.deleteMany({ where: { date: new Date(date) } }));
  }

  // ---- users ----
  users() {
    return this.db.user.findMany({ select: { id: true, email: true, name: true, locale: true, active: true, outOfOffice: true, emailEnabled: true, mustChangePassword: true, departmentId: true, department: { select: { name: true } }, roles: { select: { role: true } }, createdAt: true }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  }
  private tempPassword() { return randomBytes(9).toString("base64url"); }
  async createUser(actor: AuthUser, u: CreateUser) {
    if (await this.db.user.findUnique({ where: { email: u.email } })) throw new BadRequestException({ message: "validation", fields: { email: "exists" } });
    const temp = this.tempPassword();
    const created = await this.db.asActor(actor.id, async (tx) => {
      const row = await tx.user.create({ data: { email: u.email, name: u.name, departmentId: u.departmentId ?? null, locale: u.locale, passwordHash: await argon2.hash(temp), mustChangePassword: true } });
      await tx.userRole.createMany({ data: u.roles.map((role) => ({ userId: row.id, role })) });
      return row;
    });
    return { id: created.id, email: created.email, temporaryPassword: temp };
  }
  async patchUser(actor: AuthUser, id: string, p: PatchUser) {
    const u = await this.db.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException();
    if (id === actor.id && (p.active === false || (p.roles && !p.roles.includes("QA_MANAGER")))) throw new BadRequestException({ message: "validation", fields: { roles: "self" } });
    const { roles, ...rest } = p;
    return this.db.asActor(actor.id, async (tx) => {
      const row = await tx.user.update({ where: { id }, data: rest });
      if (roles) {
        const current = (await tx.userRole.findMany({ where: { userId: id } })).map((r) => r.role);
        await tx.userRole.deleteMany({ where: { userId: id, role: { notIn: roles } } });
        await tx.userRole.createMany({ data: roles.filter((r) => !current.includes(r)).map((role) => ({ userId: id, role })) });
      }
      if (p.active === false) await tx.session.deleteMany({ where: { userId: id } });
      return row;
    });
  }
  async resetPassword(actor: AuthUser, id: string) {
    const temp = this.tempPassword();
    await this.db.asActor(actor.id, async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash: await argon2.hash(temp), mustChangePassword: true } });
      await tx.session.deleteMany({ where: { userId: id } });
    });
    return { temporaryPassword: temp };
  }

  /** Who changed what, for the admin audit view. */
  async changeLog(limit = 200) {
    const rows = await this.db.changeLog.findMany({ where: { tableName: { in: ["users", "user_roles", "routing_map", "sla_policies", "lookup_options", "working_calendar"] } }, orderBy: { at: "desc" }, take: limit, include: { actor: { select: { name: true } } } });
    // id is a BigInt in Postgres; JSON cannot carry it
    return rows.map((r) => ({ ...r, id: r.id.toString() }));
  }
}
