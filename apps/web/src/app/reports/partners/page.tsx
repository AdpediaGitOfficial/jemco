"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { EmptyState, PageTitle } from "@/components/ui";
import { HBars } from "@/components/charts";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";
type Row = { name: string; ncrs: number; open: number; quantity: number; cost: number; returned: number; credit: number; repaired: number; rework: number; avgDays: number | null; lastAt: string; urgentHigh: number };
type Report = { since: string; kind: "supplier" | "customer"; rows: Row[] };

function Partners() {
  const t = useTranslations("partners");
  const params = useSearchParams();
  const [kind, setKind] = useState<"supplier" | "customer">(params.get("kind") === "customer" ? "customer" : "supplier");
  const [months, setMonths] = useState(12);
  const { data: r } = useQuery<Report>({ queryKey: ["partners", kind, months], queryFn: () => api(`/reports/partners/${kind}?months=${months}`) });
  const cols: (keyof Row)[] = kind === "supplier" ? ["ncrs", "open", "quantity", "cost", "returned", "credit", "repaired", "avgDays", "urgentHigh", "lastAt"] : ["ncrs", "open", "quantity", "cost", "rework", "avgDays", "urgentHigh", "lastAt"];
  const fmt = (k: keyof Row, v: Row[keyof Row]) => v == null ? "—" : k === "cost" ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) : String(v);
  return (
    <AppShell>
      <PageTitle right={<div className="flex gap-2 items-center">
        <select className="input w-auto min-h-10 text-sm" value={months} onChange={(e) => setMonths(Number(e.target.value))}>{[3, 6, 12, 24].map((m) => <option key={m} value={m}>{t("months", { n: m })}</option>)}</select>
        <a href={`${BASE}/reports/partners/${kind}/csv?months=${months}`} className="btn-secondary">{t("export")}</a>
      </div>}>{t("title")}</PageTitle>
      <div className="flex gap-1 mb-4">{(["supplier", "customer"] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${k === kind ? "bg-charcoal text-white" : "bg-white border border-grey-20 text-grey-60"}`}>{t(k)}</button>)}</div>
      {r && !r.rows.length && <EmptyState>{t("empty", { kind: t(kind).toLowerCase() })}</EmptyState>}
      {r && r.rows.length > 0 && <>
        <section className="card mb-4"><h2 className="font-semibold mb-3">{t("chart", { kind: t(kind).toLowerCase() })}</h2><HBars data={r.rows.slice(0, 10).map((x) => ({ name: x.name, cost: x.cost }))} nameKey="name" valueKey="cost" format={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} /></section>
        <div className="card p-0 overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-surface text-left text-grey-60"><tr><th className="px-3 py-2">{t("name")}</th>{cols.map((c) => <th key={c} className="px-3 py-2 text-right whitespace-nowrap">{t(c)}</th>)}<th /></tr></thead>
          <tbody>{r.rows.map((x) => <tr key={x.name} className="border-t border-grey-20">
            <td className="px-3 py-2 font-semibold whitespace-nowrap">{x.name}</td>
            {cols.map((c) => <td key={c} className={`px-3 py-2 text-right ${c === "open" && x.open ? "text-warn font-semibold" : ""}`}>{fmt(c, x[c])}</td>)}
            <td className="px-3 py-2"><Link href={`/register?q=${encodeURIComponent(x.name)}`} className="text-brand font-semibold whitespace-nowrap">{t("viewNcrs")} →</Link></td>
          </tr>)}</tbody>
        </table></div>
      </>}
    </AppShell>
  );
}
export default function PartnersPage() { return <Suspense><Partners /></Suspense>; }
