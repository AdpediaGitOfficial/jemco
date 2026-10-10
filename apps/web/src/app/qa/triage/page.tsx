"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageTitle, PriorityChip } from "@/components/ui";

type Row = { number: string; description: string; priority: string; raisedAt: string; raisedBy: { name: string } };
export default function TriageQueue() {
  const t = useTranslations("triage");
  const { data } = useQuery<Row[]>({ queryKey: ["complaints", "SUBMITTED"], queryFn: () => api("/complaints?status=SUBMITTED") });
  return (
    <AppShell>
      <PageTitle>{t("queue")}</PageTitle>
      {data && !data.length && <EmptyState>{t("empty")}</EmptyState>}
      <ul className="space-y-3">{data?.map((c) => (
        <li key={c.number}><Link href={`/qa/triage/${c.number}`} className="card flex items-center gap-3 hover:border-grey-60">
          <div className="flex-1 min-w-0"><div className="flex gap-2 items-center text-sm text-grey-60"><span className="font-mono">{c.number}</span><PriorityChip priority={c.priority} /><span>{c.raisedBy.name}</span><span>{new Date(c.raisedAt).toLocaleDateString()}</span></div><div className="truncate">{c.description}</div></div>
          <span className="btn-secondary">{t("title")}</span>
        </Link></li>
      ))}</ul>
    </AppShell>
  );
}
