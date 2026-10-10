import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import * as oidc from "openid-client";
import argon2 from "argon2";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

/**
 * OpenID Connect sign-in (Google Workspace, Microsoft Entra ID, or any OIDC provider).
 * Configure with OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI,
 * OIDC_LABEL ("Google"), OIDC_ALLOWED_DOMAINS ("jemco.com.my,jemco.my"),
 * OIDC_AUTO_PROVISION ("true": first sign-in from an allowed domain creates an Issuer account).
 */
@Injectable()
export class SsoService {
  private log = new Logger("sso");
  private config: oidc.Configuration | null = null;
  readonly enabled = !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID);
  readonly label = process.env.OIDC_LABEL ?? "Single sign-on";
  private domains = (process.env.OIDC_ALLOWED_DOMAINS ?? "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  private autoProvision = process.env.OIDC_AUTO_PROVISION === "true";

  constructor(private db: PrismaService) {
    if (this.enabled) this.log.log(`enabled: ${process.env.OIDC_ISSUER} (${this.label})`); else this.log.log("disabled (OIDC_ISSUER not set)");
  }

  private async cfg(): Promise<oidc.Configuration> {
    if (this.config) return this.config;
    const issuer = new URL(process.env.OIDC_ISSUER!);
    const options: oidc.DiscoveryRequestOptions = {};
    if (issuer.protocol === "http:") options.execute = [oidc.allowInsecureRequests]; // local mock IdP only
    this.config = await oidc.discovery(issuer, process.env.OIDC_CLIENT_ID!, process.env.OIDC_CLIENT_SECRET, undefined, options);
    return this.config;
  }

  /** Step 1: where to send the browser, plus the values to keep in a short-lived cookie. */
  async start(): Promise<{ url: string; state: string; nonce: string; verifier: string }> {
    const c = await this.cfg();
    const verifier = oidc.randomPKCECodeVerifier();
    const challenge = await oidc.calculatePKCECodeChallenge(verifier);
    const state = oidc.randomState(); const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(c, {
      redirect_uri: process.env.OIDC_REDIRECT_URI!, scope: "openid email profile",
      code_challenge: challenge, code_challenge_method: "S256", state, nonce,
    });
    return { url: url.href, state, nonce, verifier };
  }

  /** Step 2: exchange the code, verify the ID token, map or provision the user. Returns the user id. */
  async callback(currentUrl: string, expected: { state: string; nonce: string; verifier: string }): Promise<string> {
    const c = await this.cfg();
    const tokens = await oidc.authorizationCodeGrant(c, new URL(currentUrl), { pkceCodeVerifier: expected.verifier, expectedState: expected.state, expectedNonce: expected.nonce });
    const claims = tokens.claims();
    const email = String(claims?.email ?? "").toLowerCase();
    if (!email) throw new UnauthorizedException("the identity provider did not return an email");
    if (claims?.email_verified === false) throw new UnauthorizedException("email not verified by the identity provider");
    const domain = email.split("@")[1];
    if (this.domains.length && !this.domains.includes(domain)) throw new UnauthorizedException(`accounts from ${domain} are not allowed`);

    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      if (!existing.active) throw new UnauthorizedException("account is deactivated");
      return existing.id;
    }
    if (!this.autoProvision) throw new UnauthorizedException("no account for this email; ask the QA manager to add you");
    const name = String(claims?.name ?? email.split("@")[0]);
    const created = await this.db.user.create({ data: {
      email, name, passwordHash: await argon2.hash(randomBytes(32).toString("hex")), // unusable; SSO only
      locale: "en", mustChangePassword: false, roles: { create: [{ role: "ISSUER" }] },
    } });
    this.log.log(`provisioned ${email} as ISSUER via SSO`);
    return created.id;
  }
}
