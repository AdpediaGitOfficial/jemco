import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { AuthGuard } from "./common/auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { UsersController } from "./users/users.controller";
import { LookupsController } from "./lookups/lookups.controller";
import { ComplaintsModule } from "./complaints/complaints.module";
import { NcrModule } from "./ncr/ncr.module";
import { TodoController } from "./todo/todo.controller";
import { HealthController } from "./health.controller";
import { NotificationsModule } from "./notifications/notifications.module";
import { WorkflowModule } from "./workflow/workflow.module";
import { AttachmentsModule } from "./attachments/attachments.module";
import { ReportsModule } from "./reports/reports.module";
import { MailModule } from "./mail/mail.module";
import { AdminModule } from "./admin/admin.module";
import { PdfModule } from "./pdf/pdf.module";

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, AuthModule, NotificationsModule, WorkflowModule, ComplaintsModule, NcrModule, AttachmentsModule, ReportsModule, MailModule, AdminModule, PdfModule],
  controllers: [HealthController, UsersController, LookupsController, TodoController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
