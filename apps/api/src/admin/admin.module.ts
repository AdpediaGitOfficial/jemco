import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { NcrModule } from "../ncr/ncr.module";
@Module({ imports: [NcrModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
