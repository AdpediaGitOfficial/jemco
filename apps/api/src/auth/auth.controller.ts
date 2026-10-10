import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ChangePasswordSchema, LoginSchema, MyPrefsSchema, type LoginInput } from "@jemco/shared";
import type { z } from "zod";
import { AuthService } from "./auth.service";
import { SsoService } from "./sso.service";
import { CurrentUser, Public, type AuthUser } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";

const COOKIE = "jemco_session";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService, private sso: SsoService) {}

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

  /** Login page asks whether to show the SSO button. */
  @Public()
  @Get("sso/config")
  ssoConfig() { return { enabled: this.sso.enabled, label: this.sso.label }; }

  @Public()
  @Get("sso/start")
  async ssoStart(@Res() res: Response) {
    if (!this.sso.enabled) return res.status(404).send("SSO not configured");
    const { url, state, nonce, verifier } = await this.sso.start();
    res.cookie("jemco_sso", JSON.stringify({ state, nonce, verifier }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/v1/auth/sso", maxAge: 10 * 60_000 });
    res.redirect(url);
  }

  @Public()
  @Get("sso/callback")
  async ssoCallback(@Req() req: Request, @Res() res: Response) {
    const web = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    try {
      const expected = JSON.parse(req.cookies?.["jemco_sso"] ?? "{}");
      if (!expected.state) throw new Error("sign-in session expired, try again");
      const currentUrl = `${process.env.OIDC_REDIRECT_URI!.split("/v1/")[0]}${req.originalUrl}`;
      const userId = await this.sso.callback(currentUrl, expected);
      const sessionId = await this.auth.sessionFor(userId);
      res.clearCookie("jemco_sso", { path: "/v1/auth/sso" });
      res.cookie(COOKIE, sessionId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 12 * 3600_000 });
      res.redirect(`${web}/todo`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "sign-in failed";
      res.redirect(`${web}/login?sso_error=${encodeURIComponent(msg)}`);
    }
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
