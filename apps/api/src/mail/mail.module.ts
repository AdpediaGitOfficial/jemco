import { Global, Module } from "@nestjs/common";
import { MailService } from "./mail.service";
import { MailScheduler } from "./mail.scheduler";
@Global()
@Module({ providers: [MailService, MailScheduler], exports: [MailService, MailScheduler] })
export class MailModule {}
