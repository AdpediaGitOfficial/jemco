"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageTitle, PriorityChip } from "@/components/ui";

type Row = { number: string; priority: string; assignee: { name: string } | null; department: { name: string }; complaint: { customerName: string | null; supplierName: string | null; process: string } | null; clocks: { dueAt: string }[] };
export default function VerifyQueue() {
  const t = useTranslations("verify");
  const { data } = useQuery<Row[]>({ queryKey: ["ncr", "AWAITING_VERIFICATION"], queryFn: () => api("/ncr?state=AWAITING_VERIFICATION") });
  return (
    <AppShell>
      <PageTitle>{t("queue")}</PageTitle>
      {data && !data.length && <EmptyState>{t("empty")}</EmptyState>}
      <ul className="space-y-3">{data?.map((n) => (
        <li key={n.number}><Link href={`/qa/verify/${n.number}`} className="card flex items-center gap-3 hover:border-grey-60">
          <div className="flex-1"><div className="flex gap-2 items-center text-sm text-grey-60"><span className="font-mono">{n.number}</span><PriorityChip priority={n.priority} /></div><div>{n.department.name} · {n.assignee?.name}</div></div>
          <span className="btn-secondary">{t("submit")}</span>
        </Link></li>
      ))}</ul>
    </AppShell>
  );
}
