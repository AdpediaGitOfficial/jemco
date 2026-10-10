import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { AnswerInfoSchema, CreateComplaintSchema, TriageDecisionSchema, type AnswerInfo, type CreateComplaint, type TriageDecision } from "@jemco/shared";
import { ComplaintsService } from "./complaints.service";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";

@Controller("complaints")
export class ComplaintsController {
  constructor(private svc: ComplaintsService) {}

  @Post()
  create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(CreateComplaintSchema)) body: CreateComplaint) { return this.svc.create(u, body); }

  @Get()
  list(@CurrentUser() u: AuthUser, @Query("status") status?: string) { return this.svc.list(u, status); }

  @Get(":number")
  get(@CurrentUser() u: AuthUser, @Param("number") n: string) { return this.svc.get(u, n); }

  @Post(":number/answer")
  answer(@CurrentUser() u: AuthUser, @Param("number") n: string, @Body(new ZodPipe(AnswerInfoSchema)) b: AnswerInfo) { return this.svc.answerInfo(u, n, b.answer); }

  @Roles("QA_COORDINATOR", "QA_MANAGER")
  @Post(":number/triage")
  triage(@CurrentUser() u: AuthUser, @Param("number") n: string, @Body(new ZodPipe(TriageDecisionSchema)) d: TriageDecision) { return this.svc.triage(u, n, d); }
}
