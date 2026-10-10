import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SsoService } from "./sso.service";
@Global()
@Module({ controllers: [AuthController], providers: [AuthService, SsoService], exports: [AuthService] })
export class AuthModule {}
