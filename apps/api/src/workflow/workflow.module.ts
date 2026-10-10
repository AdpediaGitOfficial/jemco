import { Global, Module } from "@nestjs/common";
import { WorkflowService } from "./workflow.service";
import { SlaService } from "./sla.service";
import { SlaScheduler } from "./sla.scheduler";
@Global()
@Module({ providers: [WorkflowService, SlaService, SlaScheduler], exports: [WorkflowService, SlaService, SlaScheduler] })
export class WorkflowModule {}
