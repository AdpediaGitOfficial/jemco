"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageTitle, PriorityChip, StatusChip } from "@/components/ui";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";
type Row = Record<string, string | number | null>;

/** Every NCR, filterable by any text, exportable as CSV. QA, management, auditors. */
function Register() {
  const t = useTranslations("register");
  const params = useSearchParams();
  const { data } = useQuery<Row[]>({ queryKey: ["register"], queryFn: () => api("/reports/register") });
  const [q, setQ] = useState(params.get("q") ?? "");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((r) => !needle || Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(needle)));
  }, [data, q]);
  return (
    <AppShell>
      <PageTitle right={<a href={`${BASE}/reports/register.csv`} className="btn-secondary">{t("export")}</a>}>{t("title")}</PageTitle>
      <div className="flex gap-3 items-center mb-4">
        <input className="input max-w-md" placeholder={t("filter")} value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-grey-60 whitespace-nowrap">{t("count", { n: rows.length })}</span>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-grey-60"><tr>
            {["number", "state", "priority", "department", "assignee", "process", "customer_name", "supplier_name", "raised", "verified", "verification_result", "cost_of_nc"].map((c) => <th key={c} className="px-3 py-2 font-semibold whitespace-nowrap">{c.replace(/_/g, " ")}</th>)}
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={String(r.number)} className="border-t border-grey-20">
              <td className="px-3 py-2 font-mono"><Link href={`/ncr/${r.number}`} className="text-brand">{r.number}</Link></td>
              <td className="px-3 py-2"><StatusChip status={String(r.state)} /></td>
              <td className="px-3 py-2"><PriorityChip priority={String(r.priority)} /></td>
              {["department", "assignee", "process", "customer_name", "supplier_name"].map((c) => <td key={c} className="px-3 py-2 whitespace-nowrap">{r[c] ?? ""}</td>)}
              {["raised", "verified"].map((c) => <td key={c} className="px-3 py-2 whitespace-nowrap">{r[c] ? String(r[c]).slice(0, 10) : ""}</td>)}
              <td className="px-3 py-2">{r.verification_result ?? ""}</td>
              <td className="px-3 py-2 text-right">{r.cost_of_nc ?? ""}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </AppShell>
  );
}
export default function RegisterPage() { return <Suspense><Register /></Suspense>; }
