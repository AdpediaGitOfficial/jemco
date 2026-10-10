import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { CreateUserSchema, HolidaySchema, LookupOptionPatchSchema, LookupOptionSchema, PatchUserSchema, RoutingSchema, SlaPolicySchema } from "@jemco/shared";
import { AdminService } from "./admin.service";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";

@Roles("QA_MANAGER")
@Controller("admin")
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get("lookups") lookups() { return this.svc.lookups(); }
  @Post("lookups/:list") addLookup(@CurrentUser() u: AuthUser, @Param("list") list: string, @Body(new ZodPipe(LookupOptionSchema)) b: z.infer<typeof LookupOptionSchema>) { return this.svc.addLookup(u, list, b); }
  @Patch("lookups/:list/:code") patchLookup(@CurrentUser() u: AuthUser, @Param("list") list: string, @Param("code") code: string, @Body(new ZodPipe(LookupOptionPatchSchema)) b: z.infer<typeof LookupOptionPatchSchema>) { return this.svc.patchLookup(u, list, code, b); }

  @Get("routing") routing() { return this.svc.routing(); }
  @Put("routing/:process") setRouting(@CurrentUser() u: AuthUser, @Param("process") p: string, @Body(new ZodPipe(RoutingSchema)) b: z.infer<typeof RoutingSchema>) { return this.svc.setRouting(u, p, b); }

  @Get("sla") sla() { return this.svc.sla(); }
  @Put("sla/:priority") setSla(@CurrentUser() u: AuthUser, @Param("priority") p: string, @Body(new ZodPipe(SlaPolicySchema)) b: z.infer<typeof SlaPolicySchema>) { return this.svc.setSla(u, p, b); }

  @Get("calendar") calendar(@Query("year") year?: string) { return this.svc.calendar(Number(year) || new Date().getFullYear()); }
  @Post("calendar") addHoliday(@CurrentUser() u: AuthUser, @Body(new ZodPipe(HolidaySchema)) b: z.infer<typeof HolidaySchema>) { return this.svc.addHoliday(u, b); }
  @Delete("calendar/:date") @HttpCode(204) removeHoliday(@CurrentUser() u: AuthUser, @Param("date") d: string) { return this.svc.removeHoliday(u, d); }

  @Get("users") users() { return this.svc.users(); }
  @Post("users") createUser(@CurrentUser() u: AuthUser, @Body(new ZodPipe(CreateUserSchema)) b: z.infer<typeof CreateUserSchema>) { return this.svc.createUser(u, b); }
  @Patch("users/:id") patchUser(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body(new ZodPipe(PatchUserSchema)) b: z.infer<typeof PatchUserSchema>) { return this.svc.patchUser(u, id, b); }
  @Post("users/:id/reset-password") reset(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.resetPassword(u, id); }

  @Get("changes") changes() { return this.svc.changeLog(); }
}
