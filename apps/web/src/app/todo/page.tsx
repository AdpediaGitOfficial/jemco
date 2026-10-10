"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, type TodoItem } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageTitle, PriorityChip } from "@/components/ui";

export default function TodoPage() {
  const t = useTranslations("todo");
  const { data, isLoading } = useQuery<TodoItem[]>({ queryKey: ["todo"], queryFn: () => api("/todo"), refetchInterval: 60_000 });
  return (
    <AppShell>
      <PageTitle>{t("title")}</PageTitle>
      {!isLoading && !data?.length && <EmptyState>{t("empty")}</EmptyState>}
      <ul className="space-y-3">
        {data?.map((i) => {
          const over = i.dueAt && new Date(i.dueAt) < new Date();
          return (
            <li key={`${i.kind}-${i.number}`} className="card flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-grey-60"><span className="font-mono">{i.number}</span><PriorityChip priority={i.priority} /></div>
                <div className="font-semibold truncate">{i.title}</div>
                {i.dueAt && <div className={`text-sm ${over ? "text-bad font-semibold" : "text-grey-60"}`}>{t(over ? "overdue" : "due", { date: new Date(i.dueAt).toLocaleDateString() })}</div>}
              </div>
              <Link href={i.link} className="btn-primary sm:w-44">{t(`action.${i.action}`)}</Link>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
