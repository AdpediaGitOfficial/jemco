import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ChangePasswordSchema, LoginSchema, MyPrefsSchema, type LoginInput } from "@jemco/shared";
import type { z } from "zod";
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

  @Post("change-password")
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ChangePasswordSchema)) b: z.infer<typeof ChangePasswordSchema>) {
    await this.auth.changePassword(user.id, b.current, b.next);
  }

  @Patch("me")
  async prefs(@CurrentUser() user: AuthUser, @Body(new ZodPipe(MyPrefsSchema)) b: z.infer<typeof MyPrefsSchema>) {
    await this.auth.updatePrefs(user.id, b);
    return { ...user, ...b };
  }
}
