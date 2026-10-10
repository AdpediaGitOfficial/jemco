import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { LoginSchema, type LoginInput } from "@jemco/shared";
import { AuthService } from "./auth.service";
import { CurrentUser, Public, type AuthUser } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";

const COOKIE = "jemco_session";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(@Body(new ZodPipe(LoginSchema)) body: LoginInput, @Res({ passthrough: true }) res: Response) {
    const { sessionId, user } = await this.auth.login(body.email, body.password);
    res.cookie(COOKIE, sessionId, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
      maxAge: 12 * 3600_000,
    });
    return user;
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sid = req.cookies?.[COOKIE];
    if (sid) await this.auth.logout(sid);
    res.clearCookie(COOKIE, { path: "/" });
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) { return user; }
}
