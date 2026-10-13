import { test, expect, type Page } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:4000/v1";
const PW = "jemco1234";
async function signIn(page: Page, email: string, password = PW) {
  await page.goto("/login");
  await page.getByLabel(/work email|e-mel kerja/i).fill(email);
  await page.getByLabel(/^password|kata laluan$/i).fill(password);
  await page.getByRole("button", { name: /^sign in$|^log masuk$/i }).click();
  await page.waitForURL("**/todo");
}
async function signOut(page: Page) { await page.evaluate((api) => fetch(`${api}/auth/logout`, { method: "POST", credentials: "include" }), API); }

const DESC = "Playwright: customer received 20 brackets with the powder coat peeling along the folded edge; goods held at site.";

test.describe.serial("one complaint, end to end, through the real screens", () => {
  let cmp = "", ncr = "";

  test.beforeAll(async ({ request }) => {
    // Normalise fixture state left by other runs: the Powder Coating PIC is present and not away.
    const mgr = await request.post(`${API}/auth/login`, { data: { email: "qa.manager@jemco.local", password: PW } });
    const cookie = mgr.headers()["set-cookie"]!.split(";")[0];
    const users = await (await request.get(`${API}/admin/users`, { headers: { cookie } })).json();
    const pic = (users as { id: string; email: string }[]).find((u) => u.email === "pc.pic@jemco.local")!;
    await request.patch(`${API}/admin/users/${pic.id}`, { headers: { cookie }, data: { outOfOffice: false, active: true } });
  });

  test("issuer: stepper gates each step, saves a draft, uploads a photo and gets a number", async ({ page }) => {
    await signIn(page, "sales@jemco.local");
    await expect(page.getByRole("heading", { name: /your to-do/i })).toBeVisible();
    await page.goto("/complaints/new");
    const next = page.getByRole("button", { name: /^next$/i });
    await expect(next).toBeDisabled();                                         // step 1 needs a type
    await page.getByRole("radio", { name: /corrective action/i }).click(); await next.click();
    await expect(next).toBeDisabled();                                         // step 2 needs process + source
    await page.getByRole("radio", { name: /powder coating/i }).click();
    await page.getByRole("radio", { name: /customer feedback/i }).click(); await next.click();
    await expect(next).toBeDisabled();                                         // step 3 needs customer, PO, qty
    await page.getByLabel(/customer name/i).fill("Syarikat Maju Sdn Bhd");
    await page.getByLabel(/po or do number/i).fill("DO-20451");
    await page.getByLabel(/quantity affected/i).fill("20");
    await page.getByLabel(/^unit$/i).selectOption("PCS");
    await page.reload();                                                       // draft survives a reload
    await expect(page.getByLabel(/po or do number/i)).toHaveValue("DO-20451");
    await next.click();
    await page.getByRole("radio", { name: /^high/i }).click(); await next.click();
    await page.getByPlaceholder(/for example/i).fill("too short");
    await expect(next).toBeDisabled();                                         // 50-char minimum
    await expect(page.getByText(/at least 50 characters/i)).toBeVisible();
    await page.getByPlaceholder(/for example/i).fill(DESC); await next.click();
    await page.locator('input[type=file]').nth(1).setInputFiles({ name: "edge.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") });
    await expect(page.getByText(/1 of 10 attached/i)).toBeVisible();
    await next.click();
    await expect(page.getByText(DESC)).toBeVisible();                          // review shows what was entered
    await page.getByRole("button", { name: /send to qa/i }).click();
    const heading = page.getByRole("heading", { name: /your number is/i });
    await expect(heading).toBeVisible();
    cmp = (await heading.textContent())!.match(/CMP-\d{4}-\d{4}/)![0];
    await page.goto("/complaints");
    await expect(page.getByText(cmp)).toBeVisible();
    await expect(page.getByText(/waiting for qa/i).first()).toBeVisible();
    await signOut(page);
  });

  test("QA: the complaint is on the to-do; triage accepts it and an NCR is created", async ({ page }) => {
    await signIn(page, "aishah@jemco.local");
    const row = page.locator("li", { hasText: cmp });
    await expect(row.getByRole("link", { name: /triage/i })).toBeVisible();
    await row.getByRole("link", { name: /triage/i }).click();
    await expect(page.getByText(DESC)).toBeVisible();
    await expect(page.getByLabel(/department/i)).toHaveValue(/./);           // routing defaulted the department
    await expect(page.getByLabel(/person in charge/i)).toHaveValue(/./);
    const picSelect = page.getByLabel(/person in charge/i);
    const picValue = await picSelect.locator("option", { hasText: /^Powder Coating PIC/ }).first().getAttribute("value");
    await picSelect.selectOption(picValue!);
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await page.waitForURL("**/qa/triage");
    await expect(page.locator("li", { hasText: cmp })).toHaveCount(0);       // gone from the queue
    await page.goto(`/complaints/${cmp}`);
    const handled = page.getByText(/handled as NCR-\d{4}-\d{4}/i);
    await expect(handled).toBeVisible();
    ncr = (await handled.textContent())!.match(/NCR-\d{4}-\d{4}/)![0];
    await signOut(page);
  });

  test("PIC: to-do shows Start; submit is refused with a plain-language list; then completes", async ({ page }) => {
    await signIn(page, "pc.pic@jemco.local");
    const row = page.locator("li", { hasText: ncr });
    await expect(row.getByRole("link", { name: /^start$/i })).toBeVisible();
    await row.getByRole("link", { name: /^start$/i }).click();
    await page.getByRole("button", { name: /send to qa for verification/i }).click();
    await expect(page.getByText(/before you can send: write the root cause, write the action plan, add at least one action item/i)).toBeVisible();
    await page.getByLabel(/why did it happen/i).fill("Why peeling? Poor adhesion on the fold. Why? Pre-treatment skipped. Why? Traveller does not list the step.");
    await page.getByLabel(/what will you do/i).fill("Traveller updated to rev 3; operators re-briefed.");
    await page.getByRole("button", { name: /add an action item/i }).click();
    await page.getByPlaceholder(/what will be done/i).fill("Update traveller to rev 3");
    await page.getByLabel(/^done$/i).check();
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/^saved$/i)).toBeVisible();
    await page.getByRole("button", { name: /send to qa for verification/i }).click();
    await page.waitForURL("**/todo");
    await expect(page.locator("li", { hasText: ncr })).toHaveCount(0);
    await signOut(page);
  });

  test("QA: returns it once, then closes it; PIC sees the return note; history is complete", async ({ page }) => {
    await signIn(page, "aishah@jemco.local");
    await page.goto(`/qa/verify/${ncr}`);
    await page.getByRole("button", { name: /not satisfactory/i }).click();
    await page.getByLabel(/what must the pic do differently/i).fill("Attach a photo of the rev 3 traveller.");
    await page.getByLabel(/qa justification/i).fill("Evidence missing.");
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await page.waitForURL("**/qa/verify");
    await signOut(page);

    await signIn(page, "pc.pic@jemco.local");
    const row = page.locator("li", { hasText: ncr });
    await expect(row.getByRole("link", { name: /fix and resubmit/i })).toBeVisible();
    await row.getByRole("link", { name: /fix and resubmit/i }).click();
    await expect(page.getByText(/attach a photo of the rev 3 traveller/i)).toBeVisible();
    await page.getByRole("button", { name: /send to qa for verification/i }).click();
    await page.waitForURL("**/todo");
    await signOut(page);

    await signIn(page, "aishah@jemco.local");
    await page.goto(`/qa/verify/${ncr}`);
    await page.getByRole("button", { name: /satisfactory: close/i }).click();
    await page.getByLabel(/rework \/ repair by production/i).check();
    await page.getByLabel(/cost of non-conformance/i).fill("450");
    await page.getByLabel(/qa justification/i).fill("Traveller rev 3 verified on the floor.");
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await page.waitForURL("**/qa/verify");
    await page.goto(`/ncr/${ncr}`);
    await expect(page.getByText(/^closed$/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /effectiveness review/i })).toBeVisible();
    const history = page.locator("ol li");
    await expect(history).toHaveCount(7);                                       // assigned, in progress, awaiting, returned, in progress, awaiting, closed
    await expect(page.getByRole("link", { name: /download form \(pdf\)/i })).toBeVisible();
    await signOut(page);
  });

  test("dashboard and register reflect the closed NCR; language switch changes the chrome", async ({ page }) => {
    await signIn(page, "aishah@jemco.local");
    await page.goto("/dashboard");
    await expect(page.getByText(/open ncrs/i)).toBeVisible();
    await expect(page.getByText(/ncrs by process/i)).toBeVisible();
    await page.goto(`/register?q=${ncr}`);
    await expect(page.getByRole("link", { name: ncr })).toBeVisible();
    await page.getByRole("button", { name: /bahasa malaysia/i }).click();
    await expect(page.getByRole("heading", { name: /daftar ncr/i })).toBeVisible();
    await page.getByRole("button", { name: /^english$/i }).click();
    await expect(page.getByRole("heading", { name: /ncr register/i })).toBeVisible();
    await signOut(page);
  });

  test("admin: a new person must change their password before anything else", async ({ page, request }) => {
    const mgr = await request.post(`${API}/auth/login`, { data: { email: "qa.manager@jemco.local", password: PW } });
    const cookie = mgr.headers()["set-cookie"]!.split(";")[0];
    const email = `e2e.${Date.now()}@jemco.local`;
    const created = await request.post(`${API}/admin/users`, { headers: { cookie }, data: { email, name: "E2E Person", roles: ["ISSUER"] } });
    const { temporaryPassword } = await created.json();
    await signIn(page, email, temporaryPassword).catch(() => {});
    await page.waitForURL("**/account");                                       // forced to the account page
    await expect(page.getByText(/please set a new password/i)).toBeVisible();
    await page.getByLabel(/current password/i).fill(temporaryPassword);
    await page.getByLabel(/new password/i).fill("a-much-longer-password-1");
    await page.getByRole("button", { name: /^save$/i }).click();
    await page.waitForURL("**/todo");
    await signOut(page);
  });

  test("wrong password shows a plain error; unknown routes need a session", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/work email/i).fill("sales@jemco.local");
    await page.getByLabel(/^password$/i).fill("nope");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText(/wrong email or password/i)).toBeVisible();
    await page.goto("/dashboard");
    await page.waitForURL("**/login**");
  });
});

test.describe("navigation and header", () => {
  const SHORT: Record<string, RegExp> = { "Your to-do": /^to-do$/i, "Report a problem": /^report$/i, "My reports": /^reports$/i, Triage: /^triage$/i };

  test("QA manager: every destination is reachable, the active page is marked, avatar and sign out work", async ({ page }, info) => {
    const phone = info.project.name === "phone";
    await signIn(page, "qa.manager@jemco.local");
    const nav = page.getByRole("navigation", { name: /main navigation/i });          // only one is visible at a time
    for (const name of ["Your to-do", "Report a problem", "My reports", "Triage"]) await expect(nav.getByRole("link", { name: phone ? SHORT[name]! : name })).toBeVisible();
    await expect(nav.getByRole("link", { name: phone ? /^to-do$/i : "Your to-do" })).toHaveAttribute("aria-current", "page");

    if (phone) {                                                                      // the rest sit under More on a phone
      await nav.getByRole("button", { name: /more/i }).click();
      const menu = page.getByRole("dialog", { name: /more/i });
      for (const name of ["Verify", "NCRs", "Dashboard", "Register", "Suppliers & customers", "Admin"]) await expect(menu.getByRole("link", { name })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await nav.getByRole("button", { name: /more/i }).click();
      await page.getByRole("dialog", { name: /more/i }).getByRole("link", { name: "Dashboard" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();                            // closes after navigating
    } else {                                                                          // the desktop sidebar lists everything, grouped
      for (const name of ["Verify", "NCRs", "Dashboard", "Register", "Suppliers & customers", "Admin"]) await expect(nav.getByRole("link", { name })).toBeVisible();
      await expect(nav.getByText(/^insights$/i)).toBeVisible();
      await nav.getByRole("link", { name: "Dashboard" }).click();
    }
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: /^dashboard$/i })).toBeVisible();

    await page.getByRole("link", { name: /signed in as qa manager/i }).click();      // avatar goes to the account page
    await page.waitForURL("**/account");
    const out = page.getByRole("button", { name: /^sign out$/i });
    await expect(out).toBeInViewport();                                               // used to be pushed off the desktop header
    await out.click();
    await page.waitForURL("**/login");
  });

  test("an issuer sees only the tabs they can use, and Report is not highlighted on My reports", async ({ page }, info) => {
    const phone = info.project.name === "phone";
    await signIn(page, "sales@jemco.local");
    const nav = page.getByRole("navigation", { name: /main navigation/i });
    await expect(nav.getByRole("button", { name: /more/i })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /triage/i })).toHaveCount(0);
    const reports = nav.getByRole("link", { name: phone ? SHORT["My reports"]! : "My reports" });
    await reports.click();
    await page.waitForURL("**/complaints");
    await expect(reports).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: phone ? SHORT["Report a problem"]! : "Report a problem" })).not.toHaveAttribute("aria-current", "page");
  });

  test("report a problem: progress bar is announced and Back on the first step returns to the to-do", async ({ page }) => {
    await signIn(page, "sales@jemco.local");
    await page.goto("/complaints/new");
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    await page.getByRole("button", { name: /^back$/i }).click();
    await page.waitForURL("**/todo");
  });
});
