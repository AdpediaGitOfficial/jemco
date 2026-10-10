"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useLabel, useLookups } from "@/lib/hooks";
import { AdminShell } from "@/components/admin";

type Route = { process: string; departmentId: string; primaryPicId: string | null; backupPicId: string | null; department: { name: string } };
type Dept = { id: string; name: string }; type Person = { id: string; name: string; departmentId: string | null; outOfOffice: boolean };

export default function RoutingAdmin() {
  const t = useTranslations("admin"); const qc = useQueryClient();
  const { data: routes } = useQuery<Route[]>({ queryKey: ["admin", "routing"], queryFn: () => api("/admin/routing") });
  const { data: depts } = useQuery<Dept[]>({ queryKey: ["departments"], queryFn: () => api("/users/departments") });
  const { data: people } = useQuery<Person[]>({ queryKey: ["assignable"], queryFn: () => api("/users/assignable") });
  const { data: lk } = useLookups(); const { label } = useLabel();
  const [status, setStatus] = useState("");
  const save = useMutation({ mutationFn: (r: Route) => api(`/admin/routing/${r.process}`, { method: "PUT", json: { departmentId: r.departmentId, primaryPicId: r.primaryPicId, backupPicId: r.backupPicId } }), onSuccess: () => { setStatus(t("saved")); setTimeout(() => setStatus(""), 1500); qc.invalidateQueries({ queryKey: ["admin", "routing"] }); } });
  const processes = lk?.process ?? [];
  const byProc = new Map((routes ?? []).map((r) => [r.process, r]));
  return (
    <AdminShell section="routing" status={status}>
      <div className="card p-0 overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-surface text-left text-grey-60"><tr><th className="px-3 py-2">{t("process")}</th><th className="px-3 py-2">{t("department")}</th><th className="px-3 py-2">{t("primary")}</th><th className="px-3 py-2">{t("backup")}</th></tr></thead>
        <tbody>{processes.map((p) => {
          const r = byProc.get(p.code) ?? { process: p.code, departmentId: depts?.[0]?.id ?? "", primaryPicId: null, backupPicId: null, department: { name: "" } };
          const cands = (people ?? []).filter((x) => x.departmentId === r.departmentId);
          const sel = (k: "primaryPicId" | "backupPicId") => (
            <select className="input min-h-10 text-sm" value={r[k] ?? ""} onChange={(e) => save.mutate({ ...r, [k]: e.target.value || null })}>
              <option value="">{t("none")}</option>{cands.map((c) => <option key={c.id} value={c.id}>{c.name}{c.outOfOffice ? ` (${t("away")})` : ""}</option>)}
            </select>);
          return (
            <tr key={p.code} className="border-t border-grey-20">
              <td className="px-3 py-2 whitespace-nowrap">{label(p)}</td>
              <td className="px-3 py-2 min-w-44"><select className="input min-h-10 text-sm" value={r.departmentId} onChange={(e) => save.mutate({ ...r, departmentId: e.target.value, primaryPicId: null, backupPicId: null })}>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
              <td className="px-3 py-2 min-w-44">{sel("primaryPicId")}</td><td className="px-3 py-2 min-w-44">{sel("backupPicId")}</td>
            </tr>);
        })}</tbody>
      </table></div>
    </AdminShell>
  );
}
