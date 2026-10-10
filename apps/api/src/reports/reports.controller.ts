import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ReportsService } from "./reports.service";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";

const VIEWERS = ["QA_COORDINATOR", "QA_MANAGER", "AUDITOR", "DEPT_MANAGER"];

@Controller("reports")
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @Roles(...VIEWERS)
  @Get("management")
  management(@CurrentUser() u: AuthUser, @Query("months") months?: string) {
    const m = Math.min(36, Math.max(1, Number(months) || 12));
    return this.svc.management(u, m);
  }

  @Roles(...VIEWERS)
  @Get("partners/:kind")
  partners(@CurrentUser() u: AuthUser, @Param("kind") kind: string, @Query("months") months?: string) {
    const m = Math.min(36, Math.max(1, Number(months) || 12));
    return this.svc.partners(u, kind === "customer" ? "customer" : "supplier", m);
  }

  @Roles(...VIEWERS)
  @Get("partners/:kind/csv")
  async partnersCsv(@CurrentUser() u: AuthUser, @Param("kind") kind: string, @Query("months") months: string | undefined, @Res() res: Response) {
    const k = kind === "customer" ? "customer" : "supplier";
    const { rows } = await this.svc.partners(u, k, Math.min(36, Math.max(1, Number(months) || 12)));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${k}-scorecard-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send("\uFEFF" + this.svc.toCsv(rows as unknown as Record<string, unknown>[]));
  }

  @Roles(...VIEWERS)
  @Get("register")
  register(@CurrentUser() u: AuthUser) { return this.svc.register(u); }

  @Roles(...VIEWERS)
  @Get("register.csv")
  async csv(@CurrentUser() u: AuthUser, @Res() res: Response) {
    const rows = await this.svc.register(u);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="ncr-register-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send("﻿" + this.svc.toCsv(rows));
  }
}
