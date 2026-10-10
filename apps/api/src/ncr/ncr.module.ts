import { Module } from "@nestjs/common";
import { NcrController } from "./ncr.controller";
import { NcrService } from "./ncr.service";
import { EffectivenessScheduler } from "./effectiveness.scheduler";
@Module({ controllers: [NcrController], providers: [NcrService, EffectivenessScheduler], exports: [EffectivenessScheduler] })
export class NcrModule {}
