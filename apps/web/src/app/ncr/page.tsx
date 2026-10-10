"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageTitle, PriorityChip, StatusChip } from "@/components/ui";

type Row = { number: string; state: string; priority: string; respondBy: string | null; assignee: { name: string } | null; department: { name: string }; complaint: { customerName: string | null; supplierName: string | null } | null };
export default function NcrList() {
  const t = useTranslations("nav");
  const { data } = useQuery<Row[]>({ queryKey: ["ncr", "all"], queryFn: () => api("/ncr") });
  return (
    <AppShell>
      <PageTitle>{t("ncrs")}</PageTitle>
      {data && !data.length && <EmptyState>—</EmptyState>}
      <ul className="space-y-3">{data?.map((n) => (
        <li key={n.number}><Link href={`/ncr/${n.number}`} className="card flex items-center gap-3 hover:border-grey-60">
          <div className="flex-1"><div className="flex gap-2 items-center text-sm text-grey-60"><span className="font-mono">{n.number}</span><PriorityChip priority={n.priority} /></div><div>{n.department.name} · {n.assignee?.name} · {n.complaint?.customerName ?? n.complaint?.supplierName ?? ""}</div></div>
          <StatusChip status={n.state} />
        </Link></li>
      ))}</ul>
    </AppShell>
  );
}
