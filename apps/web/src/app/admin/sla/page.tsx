"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { AdminShell } from "@/components/admin";
import { PriorityChip } from "@/components/ui";

type Policy = { priority: string; triageDays: number; responseDays: number; resolutionDays: number; verificationDays: number };
const ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"]; const COLS: (keyof Omit<Policy, "priority">)[] = ["triageDays", "responseDays", "resolutionDays", "verificationDays"];

export default function SlaAdmin() {
  const t = useTranslations("admin"); const qc = useQueryClient();
  const { data } = useQuery<Policy[]>({ queryKey: ["admin", "sla"], queryFn: () => api("/admin/sla") });
  const [status, setStatus] = useState("");
  const save = useMutation({ mutationFn: (p: Policy) => api(`/admin/sla/${p.priority}`, { method: "PUT", json: { triageDays: p.triageDays, responseDays: p.responseDays, resolutionDays: p.resolutionDays, verificationDays: p.verificationDays } }), onSuccess: () => { setStatus(t("saved")); setTimeout(() => setStatus(""), 1500); qc.invalidateQueries({ queryKey: ["admin", "sla"] }); } });
  const rows = [...(data ?? [])].sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority));
  const labels = { triageDays: t("triage"), responseDays: t("response"), resolutionDays: t("resolution"), verificationDays: t("verification") };
  return (
    <AdminShell section="sla" status={status}>
      <div className="card p-0 overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-surface text-left text-grey-60"><tr><th className="px-3 py-2">{t("priority")}</th>{COLS.map((c) => <th key={c} className="px-3 py-2">{labels[c]} <span className="font-normal">({t("daysUnit")})</span></th>)}</tr></thead>
        <tbody>{rows.map((p) => <tr key={p.priority} className="border-t border-grey-20"><td className="px-3 py-2"><PriorityChip priority={p.priority} /></td>
          {COLS.map((c) => <td key={c} className="px-3 py-2 w-40"><input type="number" min={0} className="input min-h-10 text-sm" defaultValue={p[c]} onBlur={(e) => { const v = Number(e.target.value); if (v !== p[c]) save.mutate({ ...p, [c]: v }); }} /></td>)}
        </tr>)}</tbody>
      </table></div>
    </AdminShell>
  );
}
