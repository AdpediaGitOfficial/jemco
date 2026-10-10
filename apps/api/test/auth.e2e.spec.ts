import { describe, expect, it } from "vitest";
import { api, db, login, userId } from "./helpers";

describe("auth", () => {
  it("health is public; everything else needs a session", async () => {
    expect((await api(null, "/health")).status).toBe(200);
    expect((await api(null, "/auth/me")).status).toBe(401);
    expect((await api(null, "/complaints")).status).toBe(401);
    expect((await api(null, "/admin/users")).status).toBe(401);
  });
  it("rejects wrong password, unknown email and malformed body", async () => {
    expect((await api(null, "/auth/login", { method: "POST", json: { email: "sales@jemco.local", password: "nope" } })).status).toBe(401);
    expect((await api(null, "/auth/login", { method: "POST", json: { email: "nobody@jemco.local", password: "jemco1234" } })).status).toBe(401);
    expect((await api(null, "/auth/login", { method: "POST", json: { email: "not-an-email", password: "" } })).status).toBe(400);
  });
  it("email is case-insensitive at login", async () => {
    const s = await login("SALES@Jemco.Local");
    expect(s.user.name).toBe("Sales Rep");
  });
  it("logout invalidates the session", async () => {
    const s = await login("sales@jemco.local");
    expect((await api(s, "/auth/me")).status).toBe(200);
    expect((await api(s, "/auth/logout", { method: "POST" })).status).toBe(204);
    expect((await api(s, "/auth/me")).status).toBe(401);
  });
  it("an expired session is refused", async () => {
    const s = await login("sales@jemco.local");
    await db.session.updateMany({ where: { userId: await userId("sales@jemco.local") }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await api(s, "/auth/me")).status).toBe(401);
  });
  it("a forged session id is refused", async () => {
    expect((await api({ cookie: "jemco_session=00000000-0000-0000-0000-000000000000", user: {} as any }, "/auth/me")).status).toBe(401);
    expect((await api({ cookie: "jemco_session=not-a-uuid", user: {} as any }, "/auth/me")).status).toBe(401);
  });
  it("change password: needs the current one, 12+ chars, then works and clears mustChangePassword", async () => {
    const s = await login("log.pic@jemco.local");
    expect((await api(s, "/auth/change-password", { method: "POST", json: { current: "wrong", next: "a-much-longer-password" } })).status).toBe(401);
    expect((await api(s, "/auth/change-password", { method: "POST", json: { current: "jemco1234", next: "short" } })).status).toBe(400);
    expect((await api(s, "/auth/change-password", { method: "POST", json: { current: "jemco1234", next: "a-much-longer-password" } })).status).toBe(204);
    expect((await api(null, "/auth/login", { method: "POST", json: { email: "log.pic@jemco.local", password: "jemco1234" } })).status).toBe(401);
    const s2 = await login("log.pic@jemco.local", "a-much-longer-password");
    expect((await api(s2, "/auth/change-password", { method: "POST", json: { current: "a-much-longer-password", next: "jemco1234-restored" } })).status).toBe(204);
    await login("log.pic@jemco.local", "jemco1234-restored");
  });
  it("preferences: locale, email, away", async () => {
    const s = await login("wh.pic@jemco.local");
    const r = await api(s, "/auth/me", { method: "PATCH", json: { locale: "ms", emailEnabled: false, outOfOffice: true } });
    expect(r.status).toBe(200);
    const me = await api(s, "/auth/me");
    expect([me.body.locale, me.body.emailEnabled, me.body.outOfOffice]).toEqual(["ms", false, true]);
    expect((await api(s, "/auth/me", { method: "PATCH", json: { locale: "fr" } })).status).toBe(400);
    await api(s, "/auth/me", { method: "PATCH", json: { locale: "en", emailEnabled: true, outOfOffice: false } });
  });
  it("locks an account for 15 minutes after 10 failed attempts, other accounts unaffected", async () => {
    for (let i = 0; i < 10; i++) await api(null, "/auth/login", { method: "POST", json: { email: "pur.pic@jemco.local", password: "wrong" } });
    const locked = await api(null, "/auth/login", { method: "POST", json: { email: "pur.pic@jemco.local", password: "jemco1234" } });
    expect(locked.status).toBe(401); expect(locked.body.message).toMatch(/too many attempts/);
    expect((await api(null, "/auth/login", { method: "POST", json: { email: "sales@jemco.local", password: "jemco1234" } })).status).toBe(200);
  });
  it("a deactivated user cannot log in and loses existing sessions", async () => {
    const s = await login("prod.manager@jemco.local");
    const mgr = await login("qa.manager@jemco.local");
    const id = await userId("prod.manager@jemco.local");
    expect((await api(mgr, `/admin/users/${id}`, { method: "PATCH", json: { active: false } })).status).toBe(200);
    expect((await api(s, "/auth/me")).status).toBe(401);
    expect((await api(null, "/auth/login", { method: "POST", json: { email: "prod.manager@jemco.local", password: "jemco1234" } })).status).toBe(401);
    await api(mgr, `/admin/users/${id}`, { method: "PATCH", json: { active: true } });
  });
});
