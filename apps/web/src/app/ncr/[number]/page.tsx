"use client";
import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useMe } from "@/lib/hooks";
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
  return (
    <AppShell>
      <PageTitle right={mine ? <Link href={`/ncr/${number}/action`} className="btn-primary">{t("todo.action.CONTINUE")}</Link> : undefined}>{t("ncr.title", { number })}</PageTitle>
      <div className="max-w-2xl"><NcrSummary n={n} /></div>
    </AppShell>
  );
}
