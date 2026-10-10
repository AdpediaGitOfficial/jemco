"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageTitle, PriorityChip, StatusChip } from "@/components/ui";

type Row = { number: string; description: string; status: string; priority: string; raisedAt: string; ncr: { number: string } | null };
export default function ComplaintsPage() {
  const t = useTranslations();
  const { data } = useQuery<Row[]>({ queryKey: ["complaints"], queryFn: () => api("/complaints") });
  return (
    <AppShell>
      <PageTitle right={<Link href="/complaints/new" className="btn-primary">{t("nav.new")}</Link>}>{t("nav.complaints")}</PageTitle>
      {data && !data.length && <EmptyState>—</EmptyState>}
      <ul className="space-y-3">
        {data?.map((c) => (
          <li key={c.number}><Link href={`/complaints/${c.number}`} className="card flex items-center gap-3 hover:border-grey-60">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-grey-60"><span className="font-mono">{c.number}</span><PriorityChip priority={c.priority} /><span>{new Date(c.raisedAt).toLocaleDateString()}</span></div>
              <div className="truncate">{c.description}</div>
            </div>
            <StatusChip status={c.status} />
          </Link></li>
        ))}
      </ul>
    </AppShell>
  );
}
