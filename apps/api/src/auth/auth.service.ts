import { Injectable, UnauthorizedException } from "@nestjs/common";
import argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/decorators";

const SESSION_HOURS = 12;
const MAX_FAILURES = 10, LOCK_MINUTES = 15;
const await_hash = (p: string) => argon2.hash(p);

@Injectable()
export class AuthService {
  private failures = new Map<string, { count: number; until: number }>();
  constructor(private db: PrismaService) {}

  private checkLock(email: string) {
    const f = this.failures.get(email);
    if (f && f.count >= MAX_FAILURES && Date.now() < f.until) throw new UnauthorizedException(`too many attempts; try again in ${Math.ceil((f.until - Date.now()) / 60_000)} min`);
    if (f && Date.now() >= f.until) this.failures.delete(email);
  }
  private recordFailure(email: string) {
    const f = this.failures.get(email) ?? { count: 0, until: 0 };
    f.count++; f.until = Date.now() + LOCK_MINUTES * 60_000; this.failures.set(email, f);
  }

  async login(email: string, password: string): Promise<{ sessionId: string; user: AuthUser }> {
    const key = email.toLowerCase();
    this.checkLock(key);
    const u = await this.db.user.findUnique({ where: { email: key }, include: { roles: true } });
    if (!u || !u.active || !(await argon2.verify(u.passwordHash, password))) {
      this.recordFailure(key);
      throw new UnauthorizedException("wrong email or password");
    }
    this.failures.delete(key);
    const s = await this.db.session.create({
      data: { userId: u.id, expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000) },
    });
    return { sessionId: s.id, user: this.toAuthUser(u) };
  }

  /** Session for an already-verified user (SSO). */
  async sessionFor(userId: string): Promise<string> {
    const s = await this.db.session.create({ data: { userId, expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000) } });
    return s.id;
  }

  async logout(sessionId: string) {
    await this.db.session.deleteMany({ where: { id: sessionId } });
  }

  async userForSession(sessionId: string): Promise<AuthUser | null> {
    const s = await this.db.session.findUnique({ where: { id: sessionId }, include: { user: { include: { roles: true } } } });
    if (!s || s.expiresAt < new Date() || !s.user.active) return null;
    // slide the expiry on activity, at most once a minute
    if (s.expiresAt.getTime() - Date.now() < (SESSION_HOURS * 3600_000 - 60_000)) {
      await this.db.session.update({ where: { id: s.id }, data: { expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000) } });
    }
    return this.toAuthUser(s.user);
  }

  private toAuthUser(u: { id: string; email: string; name: string; locale: string; departmentId: string | null; emailEnabled: boolean; outOfOffice: boolean; mustChangePassword: boolean; roles: { role: string }[] }): AuthUser {
    return { id: u.id, email: u.email, name: u.name, locale: u.locale, departmentId: u.departmentId, emailEnabled: u.emailEnabled, outOfOffice: u.outOfOffice, mustChangePassword: u.mustChangePassword, roles: u.roles.map((r) => r.role) };
  }

  async changePassword(userId: string, current: string, next: string) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(u.passwordHash, current))) throw new UnauthorizedException({ message: "validation", fields: { current: "wrong" } });
    const passwordHash = await await_hash(next);
    await this.db.asActor(userId, (tx) => tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }));
  }

  async updatePrefs(userId: string, p: { locale?: string; emailEnabled?: boolean; outOfOffice?: boolean }) {
    return this.db.asActor(userId, (tx) => tx.user.update({ where: { id: userId }, data: p }));
  }
}
