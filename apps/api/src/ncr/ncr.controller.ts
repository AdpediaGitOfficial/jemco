import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { PdfService } from "../pdf/pdf.service";
import { EffectivenessSchema, ReopenSchema, SaveActionSchema, VerifySchema, type EffectivenessInput, type SaveAction, type VerifyInput } from "@jemco/shared";
import { NcrService } from "./ncr.service";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";

@Controller("ncr")
export class NcrController {
  constructor(private svc: NcrService, private pdf: PdfService) {}

  @Get() list(@CurrentUser() u: AuthUser, @Query("state") state?: string) { return this.svc.list(u, state); }
  @Get(":number") get(@CurrentUser() u: AuthUser, @Param("number") n: string) { return this.svc.get(u, n); }

  /** The record as form F/QP/004-01. Part 3 appears for QA and auditors only. */
  @Get(":number/pdf")
  async pdfOf(@CurrentUser() u: AuthUser, @Param("number") n: string, @Res() res: Response) {
    await this.svc.get(u, n); // access check
    const full = u.roles.some((r) => ["QA_COORDINATOR", "QA_MANAGER", "AUDITOR"].includes(r));
    const { buffer } = await this.pdf.forNcr(n, full);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${n}.pdf"`);
    res.send(buffer);
  }

  @Roles("QA_COORDINATOR", "QA_MANAGER")
  @Post(":number/effectiveness") effectiveness(@CurrentUser() u: AuthUser, @Param("number") n: string, @Body(new ZodPipe(EffectivenessSchema)) b: EffectivenessInput) { return this.svc.effectiveness(u, n, b); }
  @Post(":number/start") start(@CurrentUser() u: AuthUser, @Param("number") n: string) { return this.svc.start(u, n); }
  @Post(":number/action") save(@CurrentUser() u: AuthUser, @Param("number") n: string, @Body(new ZodPipe(SaveActionSchema)) b: SaveAction) { return this.svc.saveAction(u, n, b); }
  @Post(":number/submit") submit(@CurrentUser() u: AuthUser, @Param("number") n: string) { return this.svc.submit(u, n); }

  @Roles("QA_COORDINATOR", "QA_MANAGER")
  @Post(":number/verify") verify(@CurrentUser() u: AuthUser, @Param("number") n: string, @Body(new ZodPipe(VerifySchema)) b: VerifyInput) { return this.svc.verify(u, n, b); }

  @Roles("QA_MANAGER")
  @Post(":number/reopen") reopen(@CurrentUser() u: AuthUser, @Param("number") n: string, @Body(new ZodPipe(ReopenSchema)) b: { reason: string }) { return this.svc.reopen(u, n, b.reason); }
}
