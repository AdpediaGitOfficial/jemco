"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { AdminShell } from "@/components/admin";
import { Field } from "@/components/ui";

type Holiday = { date: string; reason: string };
export default function CalendarAdmin() {
  const t = useTranslations("admin"); const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data } = useQuery<Holiday[]>({ queryKey: ["admin", "calendar", year], queryFn: () => api(`/admin/calendar?year=${year}`) });
  const [status, setStatus] = useState(""); const [draft, setDraft] = useState({ date: "", reason: "" });
  const done = () => { setStatus(t("saved")); setTimeout(() => setStatus(""), 1500); qc.invalidateQueries({ queryKey: ["admin", "calendar"] }); };
  const add = useMutation({ mutationFn: () => api("/admin/calendar", { method: "POST", json: draft }), onSuccess: () => { done(); setDraft({ date: "", reason: "" }); } });
  const remove = useMutation({ mutationFn: (date: string) => api(`/admin/calendar/${date}`, { method: "DELETE" }), onSuccess: done });
  return (
    <AdminShell section="calendar" status={status}>
      <div className="flex items-center gap-3 mb-4"><span className="label mb-0">{t("year")}</span><select className="input w-auto min-h-10" value={year} onChange={(e) => setYear(Number(e.target.value))}>{[year - 1, year, year + 1, year + 2].filter((y, i, a) => a.indexOf(y) === i).map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-0"><table className="w-full text-sm">
          <thead className="bg-surface text-left text-grey-60"><tr><th className="px-3 py-2">{t("date")}</th><th className="px-3 py-2">{t("reason")}</th><th /></tr></thead>
          <tbody>{data?.map((h) => <tr key={h.date} className="border-t border-grey-20"><td className="px-3 py-2 whitespace-nowrap">{h.date.slice(0, 10)}</td><td className="px-3 py-2">{h.reason}</td><td className="px-3 py-2 text-right"><button className="btn-ghost min-h-10 text-sm" onClick={() => remove.mutate(h.date.slice(0, 10))}>{t("remove")}</button></td></tr>)}</tbody>
        </table></div>
        <div className="card space-y-3 self-start">
          <div className="font-semibold">{t("add")}</div>
          <Field label={t("date")}><input type="date" className="input" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Field>
          <Field label={t("reason")}><input className="input" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></Field>
          <button className="btn-primary" disabled={!draft.date || !draft.reason || add.isPending} onClick={() => add.mutate()}>{t("add")}</button>
        </div>
      </div>
    </AdminShell>
  );
}
