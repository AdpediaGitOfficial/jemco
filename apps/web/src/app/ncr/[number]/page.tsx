"use client";
import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { hasRole, useMe } from "@/lib/hooks";
import { EffectivenessCard } from "@/components/Effectiveness";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/ui";
import { NcrSummary, type NcrDetail } from "@/components/NcrSummary";

export default function NcrPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const t = useTranslations();
  const { data: me } = useMe();
  const { data: n } = useQuery<NcrDetail>({ queryKey: ["ncr", number], queryFn: () => api(`/ncr/${number}`) });
  if (!n) return <AppShell><div /></AppShell>;
  const mine = me?.id === n.assignee?.id && ["ASSIGNED", "IN_PROGRESS", "RETURNED"].includes(n.state);
  const qa = hasRole(me, "QA_COORDINATOR", "QA_MANAGER");
  const pdfUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1"}/ncr/${number}/pdf`;
  return (
    <AppShell>
      <PageTitle right={<div className="flex gap-2">
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-secondary">{t("ncr.pdf")}</a>
        {mine && <Link href={`/ncr/${number}/action`} className="btn-primary">{t("todo.action.CONTINUE")}</Link>}
      </div>}>{t("ncr.title", { number })}</PageTitle>
      <div className="max-w-2xl space-y-4"><EffectivenessCard n={n} canReview={qa} /><NcrSummary n={n} /></div>
    </AppShell>
  );
}
