"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useEffect } from "react";
import { useMe, hasRole } from "@/lib/hooks";
import { api } from "@/lib/api";
import { setLocale } from "@/app/actions";

/** Header + role-aware nav. Redirects to /login when there is no session. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const path = usePathname();
  const { data: me, isError, isLoading } = useMe();

  useEffect(() => { if (isError) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [isError, router, path]);
  if (isLoading || !me) return <div className="p-8 text-grey-60">…</div>;

  const qa = hasRole(me, "QA_COORDINATOR", "QA_MANAGER");
  const links = [
    { href: "/todo", label: t("nav.todo") },
    { href: "/complaints/new", label: t("nav.new") },
    { href: "/complaints", label: t("nav.complaints") },
    ...(qa ? [{ href: "/qa/triage", label: t("nav.triage") }, { href: "/qa/verify", label: t("nav.verify") }] : []),
    ...(qa || hasRole(me, "PIC", "DEPT_MANAGER", "AUDITOR") ? [{ href: "/ncr", label: t("nav.ncrs") }] : []),
  ];

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="bg-white border-b border-grey-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/todo" className="flex items-center gap-2 shrink-0"><Image src="/logo.png" alt="JEMCO" width={110} height={34} priority /></Link>
          <nav className="hidden md:flex gap-1 ml-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${path.startsWith(l.href) ? "bg-surface text-ink" : "text-grey-60 hover:text-ink"}`}>{l.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="hidden sm:inline text-grey-60">{me.name}</span>
            <button className="btn-ghost text-sm min-h-10 px-2 whitespace-nowrap" aria-label={t("app.language")} onClick={async () => { await setLocale(locale === "en" ? "ms" : "en"); router.refresh(); }}>{locale === "en" ? "BM" : "EN"}</button>
            <button className="btn-ghost text-sm min-h-10 px-2 whitespace-nowrap" onClick={async () => { await api("/auth/logout", { method: "POST" }); router.replace("/login"); }}>{t("app.signOut")}</button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">{children}</main>
      <nav className="md:hidden sticky bottom-0 bg-white border-t border-grey-20 flex">
        {links.slice(0, 4).map((l) => (
          <Link key={l.href} href={l.href} className={`flex-1 text-center py-3 text-xs font-semibold whitespace-nowrap ${path.startsWith(l.href) ? "text-brand" : "text-grey-60"}`}>{l.label}</Link>
        ))}
      </nav>
    </div>
  );
}
