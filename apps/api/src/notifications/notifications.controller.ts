import { Controller, Get, Param, Post } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CurrentUser, type AuthUser } from "../common/decorators";

@Controller("notifications")
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.forUser(u.id); }
  @Post(":id/read") read(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.markRead(u.id, id); }
}
