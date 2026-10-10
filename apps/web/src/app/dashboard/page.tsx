"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useLabel, useLookups } from "@/lib/hooks";
import { AppShell } from "@/components/AppShell";
import { PageTitle, PriorityChip } from "@/components/ui";
import { HBars, StatTile, TwoLines } from "@/components/charts";

type Report = {
  since: string; bucket: "week" | "month";
  tiles: { open: number; overdue: number; newThisMonth: number; closedThisMonth: number; avgCycleDays: number | null; slaAttainmentPct: number | null; repeatIssues: number };
  openByState: { state: string; count: number }[];
  overdue: { number: string; priority: string; assignee: string | null; department: string; kind: string; dueAt: string; daysOver: number }[];
  newVsClosed: { period: string; opened: number; closed: number }[];
  cycleTimeByPriority: { priority: string; avgDays: number; count: number }[];
  slaByPriority: { priority: string; met: number; total: number }[];
  byProcess: { process: string; count: number }[];
  bySource: { source: string; count: number }[];
  rootCause: { category: string; count: number }[];
  costByDisposition: { disposition: string; cost: number; count: number }[];
  returnRateByDept: { department: string; returned: number; total: number }[];
};

function Card({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  const t = useTranslations("dashboard");
  return <section className="card"><h2 className="font-semibold mb-3">{title}</h2>{empty ? <div className="help py-6 text-center">{t("noData")}</div> : children}</section>;
}

export default function DashboardPage() {
  const t = useTranslations("dashboard"); const ts = useTranslations("status"); const tp = useTranslations("priority"); const tr = useTranslations("register");
  const [months, setMonths] = useState(12);
  const { data: r } = useQuery<Report>({ queryKey: ["report", months], queryFn: () => api(`/reports/management?months=${months}`) });
  const { data: lk } = useLookups(); const { label } = useLabel();
  const name = (list: string, code: string) => { const o = lk?.[list]?.find((x) => x.code === code); return o ? label(o) : code; };
  if (!r) return <AppShell><div /></AppShell>;
  const pct = (m: number, tot: number) => (tot ? Math.round((m / tot) * 100) : 0);
  return (
    <AppShell>
      <PageTitle right={
        <select className="input w-auto min-h-10 text-sm" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          {[3, 6, 12, 24].map((m) => <option key={m} value={m}>{t("months", { n: m })}</option>)}
        </select>}>{t("title")}</PageTitle>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatTile label={t("open")} value={r.tiles.open} />
        <StatTile label={t("overdue")} value={r.tiles.overdue} tone={r.tiles.overdue ? "bad" : "ok"} />
        <StatTile label={t("sla")} value={r.tiles.slaAttainmentPct} unit="%" tone={r.tiles.slaAttainmentPct == null ? undefined : r.tiles.slaAttainmentPct >= 90 ? "ok" : r.tiles.slaAttainmentPct >= 75 ? "warn" : "bad"} />
        <StatTile label={t("cycle")} value={r.tiles.avgCycleDays} unit={t("days")} />
        <StatTile label={t("newMonth")} value={r.tiles.newThisMonth} />
        <StatTile label={t("closedMonth")} value={r.tiles.closedThisMonth} />
        <StatTile label={t("repeat")} value={r.tiles.repeatIssues} tone={r.tiles.repeatIssues ? "warn" : undefined} />
        <div className="card py-4"><div className="text-sm text-grey-60">{t("openByState")}</div>
          <ul className="mt-1 text-sm space-y-0.5">{r.openByState.map((s) => <li key={s.state} className="flex justify-between"><span>{ts.has(s.state) ? ts(s.state) : s.state}</span><b>{s.count}</b></li>)}{!r.openByState.length && <li className="text-grey-60">0</li>}</ul></div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title={t(r.bucket === "month" ? "newVsClosedMonth" : "newVsClosedWeek")} empty={!r.newVsClosed.some((w) => w.opened || w.closed)}>
          <TwoLines data={r.newVsClosed} xKey="period" a="opened" b="closed" labels={[t("opened"), t("closed")]} />
        </Card>
        <Card title={t("overdueList")} empty={!r.overdue.length}>
          <ul className="divide-y divide-grey-20 text-sm">{r.overdue.slice(0, 8).map((o) => (
            <li key={o.number + o.kind} className="py-2 flex items-center gap-2">
              <Link href={`/ncr/${o.number}`} className="font-mono text-brand">{o.number}</Link><PriorityChip priority={o.priority} />
              <span className="flex-1 truncate text-grey-60">{o.department} · {o.assignee ?? "—"}</span>
              <span className="text-bad font-semibold whitespace-nowrap">{t("daysOver", { n: o.daysOver })}</span>
            </li>))}</ul>
        </Card>
        <Card title={t("byProcess")} empty={!r.byProcess.length}><HBars data={r.byProcess.map((x) => ({ ...x, process: name("process", x.process) }))} nameKey="process" valueKey="count" /></Card>
        <Card title={t("bySource")} empty={!r.bySource.length}><HBars data={r.bySource.map((x) => ({ ...x, source: name("source", x.source) }))} nameKey="source" valueKey="count" /></Card>
        <Card title={t("rootCause")} empty={!r.rootCause.length}><HBars data={r.rootCause.map((x) => ({ ...x, category: name("rootCause", x.category) }))} nameKey="category" valueKey="count" /></Card>
        <Card title={t("cost")} empty={!r.costByDisposition.length}><HBars data={r.costByDisposition.map((x) => ({ ...x, disposition: name("disposition", x.disposition) }))} nameKey="disposition" valueKey="cost" format={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} /></Card>
        <Card title={t("cycleByPriority")} empty={!r.cycleTimeByPriority.length}>
          <table className="w-full text-sm"><tbody>{r.cycleTimeByPriority.map((c) => <tr key={c.priority} className="border-b border-grey-20"><td className="py-2">{tp.has(c.priority) ? tp(c.priority) : c.priority}</td><td className="text-right font-semibold">{c.avgDays} {t("days")}</td><td className="text-right text-grey-60 w-16">n={c.count}</td></tr>)}</tbody></table>
          <table className="w-full text-sm mt-3"><tbody>{r.slaByPriority.map((c) => <tr key={c.priority} className="border-b border-grey-20"><td className="py-2">{t("sla")} · {tp.has(c.priority) ? tp(c.priority) : c.priority}</td><td className="text-right font-semibold">{pct(c.met, c.total)}%</td><td className="text-right text-grey-60 w-16">{c.met}/{c.total}</td></tr>)}</tbody></table>
        </Card>
        <Card title={t("returnRate")} empty={!r.returnRateByDept.length}>
          <table className="w-full text-sm"><tbody>{r.returnRateByDept.map((d) => <tr key={d.department} className="border-b border-grey-20"><td className="py-2">{d.department}</td><td className="text-right font-semibold">{pct(d.returned, d.total)}%</td><td className="text-right text-grey-60 w-16">{d.returned}/{d.total}</td></tr>)}</tbody></table>
        </Card>
      </div>
      <div className="mt-4 text-sm text-grey-60 flex gap-4"><span>{t("months", { n: months })} · {r.since} →</span><Link href="/register" className="text-brand font-semibold">{tr("title")} →</Link></div>
    </AppShell>
  );
}
