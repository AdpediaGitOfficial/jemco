import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ReopenSchema, SaveActionSchema, VerifySchema, type SaveAction, type VerifyInput } from "@jemco/shared";
import { NcrService } from "./ncr.service";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";

@Controller("ncr")
export class NcrController {
  constructor(private svc: NcrService) {}

  @Get() list(@CurrentUser() u: AuthUser, @Query("state") state?: string) { return this.svc.list(u, state); }
  @Get(":number") get(@CurrentUser() u: AuthUser, @Param("number") n: string) { return this.svc.get(u, n); }
  @Post(":number/start") start(@CurrentUser() u: AuthUser, @Param("number") n: string) { return this.svc.start(u, n); }
  @Post(":number/action") save(@CurrentUser() u: AuthUser, @Param("number") n: string, @Body(new ZodPipe(SaveActionSchema)) b: SaveAction) { return this.svc.saveAction(u, n, b); }
  @Post(":number/submit") submit(@CurrentUser() u: AuthUser, @Param("number") n: string) { return this.svc.submit(u, n); }

  @Roles("QA_COORDINATOR", "QA_MANAGER")
  @Post(":number/verify") verify(@CurrentUser() u: AuthUser, @Param("number") n: string, @Body(new ZodPipe(VerifySchema)) b: VerifyInput) { return this.svc.verify(u, n, b); }

  @Roles("QA_MANAGER")
  @Post(":number/reopen") reopen(@CurrentUser() u: AuthUser, @Param("number") n: string, @Body(new ZodPipe(ReopenSchema)) b: { reason: string }) { return this.svc.reopen(u, n, b.reason); }
}
