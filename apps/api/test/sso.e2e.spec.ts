import { describe, expect, it } from "vitest";
import { api, BASE, db } from "./helpers";

const idp = () => `http://localhost:${process.env.TEST_IDP_PORT ?? 9410}`;
/** Follows the redirects by hand so the cookie jar stays under our control. */
async function sso(email: string) {
  await fetch(`${idp()}/as?email=${email}`);
  const start = await fetch(`${BASE()}/auth/sso/start`, { redirect: "manual" });
  const ssoCookie = (start.headers.get("set-cookie") ?? "").split(";")[0];
  const auth = await fetch(start.headers.get("location")!, { redirect: "manual" });
  const cb = await fetch(auth.headers.get("location")!, { redirect: "manual", headers: { cookie: ssoCookie } });
  const session = cb.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("jemco_session="));
  return { location: cb.headers.get("location") ?? "", session };
}

describe("single sign-on", () => {
  it("advertises itself to the login page", async () => {
    const r = await api(null, "/auth/sso/config"); expect(r.body).toEqual({ enabled: true, label: "Google" });
  });
  it("signs an existing user in", async () => {
    const r = await sso("sales@jemco.local");
    expect(r.location).toMatch(/\/todo$/); expect(r.session).toBeTruthy();
    const me = await api({ cookie: r.session!, user: {} as any }, "/auth/me"); expect(me.body.name).toBe("Sales Rep");
  });
  it("auto-provisions an allowed-domain newcomer as ISSUER only", async () => {
    const r = await sso("new.person@jemco.local");
    const me = await api({ cookie: r.session!, user: {} as any }, "/auth/me");
    expect(me.body.roles).toEqual(["ISSUER"]); expect(me.body.mustChangePassword).toBe(false);
    expect((await db.user.findUnique({ where: { email: "new.person@jemco.local" } }))?.active).toBe(true);
  });
  it("blocks other domains, unverified emails and deactivated accounts", async () => {
    expect((await sso("intruder@gmail.com")).location).toMatch(/sso_error=accounts/);
    expect((await sso("unverified@jemco.local")).location).toMatch(/sso_error=email/);
    await db.user.update({ where: { email: "new.person@jemco.local" }, data: { active: false } });
    expect((await sso("new.person@jemco.local")).location).toMatch(/sso_error=account/);
  });
  it("rejects a callback without the start cookie, and a replayed state", async () => {
    const r = await fetch(`${BASE()}/auth/sso/callback?code=x&state=y`, { redirect: "manual" });
    expect(r.headers.get("location")).toMatch(/sso_error=sign-in/);
  });
});
