import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Roles } from "../common/decorators";

@Controller("users")
export class UsersController {
  constructor(private db: PrismaService) {}

  /** Assignable PICs, optionally filtered by department. QA only. */
  @Roles("QA_COORDINATOR", "QA_MANAGER")
  @Get("assignable")
  assignable(@Query("departmentId") departmentId?: string) {
    return this.db.user.findMany({
      where: { active: true, roles: { some: { role: { in: ["PIC", "DEPT_MANAGER"] } } }, ...(departmentId ? { departmentId } : {}) },
      select: { id: true, name: true, departmentId: true, outOfOffice: true },
      orderBy: { name: "asc" },
    });
  }

  @Get("departments")
  departments() {
    return this.db.department.findMany({ select: { id: true, code: true, name: true }, orderBy: { name: "asc" } });
  }
}
