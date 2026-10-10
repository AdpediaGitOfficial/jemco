"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";
import { PageTitle } from "./ui";

export const ADMIN_SECTIONS = ["lookups", "routing", "sla", "calendar", "users", "changes"] as const;

/** Shared frame for admin pages: title, section tabs, a status line. */
export function AdminShell({ section, children, status }: { section: typeof ADMIN_SECTIONS[number]; children: React.ReactNode; status?: string }) {
  const t = useTranslations("admin");
  const path = usePathname();
  return (
    <AppShell>
      <PageTitle right={status ? <span className="text-ok text-sm mt-2">{status}</span> : undefined}>{t("title")} · {t(section)}</PageTitle>
      <nav className="flex gap-1 flex-wrap mb-5">
        {ADMIN_SECTIONS.map((s) => <Link key={s} href={`/admin/${s}`} className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${path.endsWith(s) ? "bg-white border border-grey-20 text-ink" : "text-grey-60 hover:text-ink"}`}>{t(s)}</Link>)}
      </nav>
      <p className="help mb-4">{t(`${section}Help`)}</p>
      {children}
    </AppShell>
  );
}

export function useSaved() {
  // tiny "Saved" flash
  const t = useTranslations("admin");
  return { label: t("saved") };
}
