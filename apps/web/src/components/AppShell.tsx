"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useMe, hasRole } from "@/lib/hooks";
import { api } from "@/lib/api";
import { setLocale } from "@/app/actions";
import { Icon, type IconName } from "@/components/icons";

type NavLink = { href: string; label: string; short: string; icon: IconName };
type Group = { key: string; label: string; links: NavLink[] };

/** /complaints is "Reports"; /complaints/new is "Report", so a plain prefix match would light up both. */
const isActive = (path: string, href: string) =>
  href === "/complaints" ? path === href || (path.startsWith("/complaints/") && !path.startsWith("/complaints/new"))
    : path === href || path.startsWith(`${href}/`);

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/**
 * Light Glass shell.
 * Desktop (760px and up): glass sidebar with every destination, grouped, plus a top bar with breadcrumb, language, avatar and sign out.
 * Phone: top bar with the logo, and a floating glass tab bar with the four everyday destinations; the rest sit under "More".
 * Redirects to /login when there is no session.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const path = usePathname();
  const { data: me, isError, isLoading } = useMe();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => { if (isError) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [isError, router, path]);
  useEffect(() => { if (me?.mustChangePassword && path !== "/account") router.replace("/account"); }, [me, path, router]);
  useEffect(() => { setMoreOpen(false); }, [path]);
  useEffect(() => {
    if (!moreOpen) return;
    sheet.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);
  if (isLoading || !me) return <div className="p-8 text-grey-60">…</div>;

  const qa = hasRole(me, "QA_COORDINATOR", "QA_MANAGER");
  const l = (href: string, label: string, short: string, icon: IconName): NavLink => ({ href, label, short, icon });
  const primary: NavLink[] = [
    l("/todo", t("nav.todo"), t("nav.todoShort"), "todo"),
    l("/complaints/new", t("nav.new"), t("nav.newShort"), "report"),
    l("/complaints", t("nav.complaints"), t("nav.complaintsShort"), "reports"),
    ...(qa ? [l("/qa/triage", t("nav.triage"), t("nav.triage"), "triage")] : []),
  ];
  const work: NavLink[] = [
    ...(qa ? [l("/qa/verify", t("nav.verify"), t("nav.verify"), "check")] : []),
    ...(qa || hasRole(me, "PIC", "DEPT_MANAGER", "AUDITOR") ? [l("/ncr", t("nav.ncrs"), t("nav.ncrs"), "preventive")] : []),
  ];
  const insights: NavLink[] = qa || hasRole(me, "DEPT_MANAGER", "AUDITOR")
    ? [l("/dashboard", t("nav.dashboard"), t("nav.dashboard"), "chart"), l("/register", t("nav.register"), t("nav.register"), "table"), l("/reports/partners", t("nav.partners"), t("nav.partners"), "partners")] : [];
  const admin: NavLink[] = hasRole(me, "QA_MANAGER") ? [l("/admin", t("nav.admin"), t("nav.admin"), "settings")] : [];

  const groups: Group[] = [
    { key: "work", label: t("nav.groupWork"), links: [...primary, ...work] },
    { key: "insights", label: t("nav.groupInsights"), links: insights },
    { key: "admin", label: t("nav.groupAdmin"), links: admin },
  ].filter((g) => g.links.length);
  const more: Group[] = [
    { key: "work", label: t("nav.groupWork"), links: work }, { key: "insights", label: t("nav.groupInsights"), links: insights }, { key: "admin", label: t("nav.groupAdmin"), links: admin },
  ].filter((g) => g.links.length);
  const moreCount = more.reduce((n, g) => n + g.links.length, 0);
  const moreActive = more.some((g) => g.links.some((x) => isActive(path, x.href)));
  const tabs = primary.length + (moreCount ? 1 : 0);
  const current = groups.flatMap((g) => g.links).find((x) => isActive(path, x.href))?.label ?? (path.startsWith("/account") ? t("nav.account") : "");

  const toggleLang = async () => { const next = locale === "en" ? "ms" : "en"; await setLocale(next); api("/auth/me", { method: "PATCH", json: { locale: next } }).catch(() => {}); router.refresh(); };
  const signOut = async () => { await api("/auth/logout", { method: "POST" }); router.replace("/login"); };

  const actions = (
    <div className="flex items-center gap-2.5">
      <button type="button" aria-label={t("app.language")} onClick={toggleLang}
        className="grid h-[38px] min-w-[38px] place-items-center rounded-xl border border-grey-20 bg-white/70 px-2 text-xs font-bold text-charcoal hover:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/30">{locale === "en" ? "BM" : "EN"}</button>
      <Link href="/account" aria-label={t("app.signedInAs", { name: me.name })} title={me.name} aria-current={path === "/account" ? "page" : undefined}
        className={`grid size-9 place-items-center rounded-full text-xs font-extrabold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/30 ${path === "/account" ? "bg-brand text-white" : "bg-[#fce6e6] text-brand-700"}`}>{initials(me.name)}</Link>
      <button type="button" onClick={signOut} className="btn-secondary min-h-[38px] px-3 text-xs">{t("app.signOut")}</button>
    </div>
  );

  const sideLink = (x: NavLink) => {
    const on = isActive(path, x.href);
    return (
      <Link key={x.href} href={x.href} aria-current={on ? "page" : undefined}
        className={`my-[3px] flex items-center gap-3 rounded-xl px-3 py-[11px] text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/30 ${on ? "bg-gradient-to-r from-brand/10 to-brand/[.035] text-brand-dark shadow-[inset_3px_0_0_var(--color-brand)]" : "text-grey-60 hover:bg-white/80"}`}>
        <Icon name={x.icon} className="size-[17px] shrink-0" />{x.label}
      </Link>
    );
  };
  const tabClass = (on: boolean) => `flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-[3px] py-2.5 text-[11px] font-semibold leading-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/30 ${on ? "bg-brand-50 text-brand-dark" : "text-grey-60"}`;

  return (
    <div className="min-h-dvh nav:grid nav:grid-cols-[248px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-[#dee1e7]/80 bg-white/70 px-4 py-[26px] backdrop-blur-[18px] nav:flex">
        <Link href="/todo" aria-label="JEMCO" className="mb-7 block px-2.5"><Image src="/jemco-logo.webp" alt="JEMCO" width={120} height={37} priority /></Link>
        <nav aria-label={t("nav.main")}>
          {groups.map((g) => (
            <div key={g.key}>
              <div className="px-3 pb-2 pt-3 text-[10px] font-extrabold uppercase tracking-[1.25px] text-muted">{g.label}</div>
              {g.links.map(sideLink)}
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        {/* Phone top bar */}
        <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-white/90 bg-white/75 px-4 backdrop-blur-[18px] nav:hidden">
          <Link href="/todo" aria-label="JEMCO"><Image src="/jemco-logo.webp" alt="JEMCO" width={92} height={29} priority /></Link>
          {actions}
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-5 nav:px-[clamp(20px,4vw,54px)] nav:pb-[70px] nav:pt-7">
          {/* Desktop top bar */}
          <div className="mb-[34px] hidden items-center justify-between gap-4 nav:flex">
            <div className="text-xs text-grey-60">JEMCO{current && <> / <strong className="text-ink">{current}</strong></>}</div>
            {actions}
          </div>
          {children}
        </main>
      </div>

      {/* Phone tab bar */}
      <nav aria-label={t("nav.main")} className="glass fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-20 rounded-[18px] p-2 nav:hidden">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tabs}, minmax(0, 1fr))` }}>
          {primary.map((x) => {
            const on = isActive(path, x.href);
            return <Link key={x.href} href={x.href} aria-current={on ? "page" : undefined} className={tabClass(on)}><Icon name={x.icon} className="size-[21px]" /><span className="max-w-full truncate">{x.short}</span></Link>;
          })}
          {moreCount > 0 && (
            <button type="button" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} className={tabClass(moreActive || moreOpen)}>
              <Icon name="more" className="size-[21px]" /><span>{t("nav.more")}</span>
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-30 nav:hidden" role="dialog" aria-modal="true" aria-label={t("nav.more")}>
          <button type="button" className="absolute inset-0 bg-ink/30" aria-label={t("nav.close")} onClick={() => setMoreOpen(false)} tabIndex={-1} />
          <div ref={sheet} tabIndex={-1} className="glass absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-white/[.97] p-3 pb-[calc(16px+env(safe-area-inset-bottom))] outline-none">
            {more.map((g) => (
              <div key={g.key}>
                <div className="px-3 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-[1.25px] text-muted">{g.label}</div>
                <ul>
                  {g.links.map((x) => (
                    <li key={x.href}>
                      <Link href={x.href} aria-current={isActive(path, x.href) ? "page" : undefined}
                        className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-white ${isActive(path, x.href) ? "bg-brand-50 text-brand-dark" : "text-ink"}`}>
                        <Icon name={x.icon} className="size-[18px]" /><span className="flex-1">{x.label}</span><Icon name="chevron" className="size-4 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
