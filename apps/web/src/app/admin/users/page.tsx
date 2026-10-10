"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import { AdminShell } from "@/components/admin";
import { Field } from "@/components/ui";

type U = { id: string; email: string; name: string; locale: string; active: boolean; outOfOffice: boolean; emailEnabled: boolean; departmentId: string | null; department: { name: string } | null; roles: { role: string }[] };
type Dept = { id: string; name: string };
const ROLES = ["ISSUER", "PIC", "DEPT_MANAGER", "QA_COORDINATOR", "QA_MANAGER", "AUDITOR"];

export default function UsersAdmin() {
  const t = useTranslations("admin"); const qc = useQueryClient();
  const { data } = useQuery<U[]>({ queryKey: ["admin", "users"], queryFn: () => api("/admin/users") });
  const { data: depts } = useQuery<Dept[]>({ queryKey: ["departments"], queryFn: () => api("/users/departments") });
  const [status, setStatus] = useState(""); const [err, setErr] = useState(""); const [temp, setTemp] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", departmentId: "", roles: ["ISSUER"] as string[], locale: "en" });
  const done = () => { setStatus(t("saved")); setErr(""); setTimeout(() => setStatus(""), 1500); qc.invalidateQueries({ queryKey: ["admin", "users"] }); qc.invalidateQueries({ queryKey: ["assignable"] }); };
  const onErr = (e: unknown) => setErr(e instanceof ApiError ? (e.fields.roles === "self" ? t("self") : Object.entries(e.fields).map(([k, v]) => `${k}: ${v}`).join(", ") || e.message) : String(e));
  const patch = useMutation({ mutationFn: ({ id, body }: { id: string; body: Partial<Omit<U, "roles">> & { roles?: string[] } }) => api(`/admin/users/${id}`, { method: "PATCH", json: body }), onSuccess: done, onError: onErr });
  const create = useMutation({ mutationFn: () => api<{ temporaryPassword: string }>("/admin/users", { method: "POST", json: { ...draft, departmentId: draft.departmentId || null } }), onSuccess: (r) => { done(); setTemp(t("tempPassword", { name: draft.name, password: r.temporaryPassword })); setDraft({ name: "", email: "", departmentId: "", roles: ["ISSUER"], locale: "en" }); }, onError: onErr });
  const reset = useMutation({ mutationFn: (u: U) => api<{ temporaryPassword: string }>(`/admin/users/${u.id}/reset-password`, { method: "POST" }).then((r) => ({ u, r })), onSuccess: ({ u, r }) => { done(); setTemp(t("tempPassword", { name: u.name, password: r.temporaryPassword })); } });
  const toggleRole = (u: U, role: string) => { const has = u.roles.some((r) => r.role === role); const roles = has ? u.roles.map((r) => r.role).filter((r) => r !== role) : [...u.roles.map((r) => r.role), role]; if (roles.length) patch.mutate({ id: u.id, body: { roles } }); };
  return (
    <AdminShell section="users" status={status}>
      {temp && <div className="card mb-4 border-warn/50 bg-warn/5 text-sm flex justify-between gap-3"><span className="font-mono break-all">{temp}</span><button className="btn-ghost min-h-8 text-sm" onClick={() => setTemp("")}>×</button></div>}
      {err && <div className="error mb-3">{err}</div>}
      <div className="card p-0 overflow-x-auto mb-4"><table className="w-full text-sm">
        <thead className="bg-surface text-left text-grey-60"><tr><th className="px-3 py-2">{t("name")}</th><th className="px-3 py-2">{t("department")}</th><th className="px-3 py-2">{t("roles")}</th><th className="px-3 py-2">{t("status")}</th><th className="px-3 py-2">{t("actions")}</th></tr></thead>
        <tbody>{data?.map((u) => (
          <tr key={u.id} className={`border-t border-grey-20 align-top ${u.active ? "" : "opacity-50"}`}>
            <td className="px-3 py-2"><div className="font-semibold">{u.name}</div><div className="text-grey-60">{u.email}</div></td>
            <td className="px-3 py-2 min-w-40"><select className="input min-h-10 text-sm" value={u.departmentId ?? ""} onChange={(e) => patch.mutate({ id: u.id, body: { departmentId: e.target.value || null } })}><option value="">{t("none")}</option>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
            <td className="px-3 py-2"><div className="flex flex-wrap gap-1 max-w-72">{ROLES.map((r) => { const on = u.roles.some((x) => x.role === r); return <button key={r} onClick={() => toggleRole(u, r)} className={`px-2 py-1 rounded-full text-xs font-semibold ${on ? "bg-charcoal text-white" : "bg-white border border-grey-20 text-grey-60"}`}>{t(`role.${r}`)}</button>; })}</div></td>
            <td className="px-3 py-2 whitespace-nowrap"><div className="flex flex-col gap-1">
              <button className={`text-left text-xs font-semibold ${u.outOfOffice ? "text-warn" : "text-grey-60"}`} onClick={() => patch.mutate({ id: u.id, body: { outOfOffice: !u.outOfOffice } })}>{u.outOfOffice ? "● " : "○ "}{t("away")}</button>
              <button className={`text-left text-xs font-semibold ${u.emailEnabled ? "text-ok" : "text-grey-60"}`} onClick={() => patch.mutate({ id: u.id, body: { emailEnabled: !u.emailEnabled } })}>{u.emailEnabled ? t("emailOn") : t("emailOff")}</button>
            </div></td>
            <td className="px-3 py-2 whitespace-nowrap"><div className="flex flex-col gap-1">
              <button className="btn-secondary min-h-9 text-xs px-3" onClick={() => reset.mutate(u)}>{t("resetPassword")}</button>
              <button className="btn-ghost min-h-9 text-xs px-3" onClick={() => patch.mutate({ id: u.id, body: { active: !u.active } })}>{u.active ? t("deactivate") : t("activate")}</button>
            </div></td>
          </tr>))}</tbody>
      </table></div>
      <div className="card space-y-3">
        <div className="font-semibold">{t("newUser")}</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={t("name")}><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label={t("email")}><input className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
          <Field label={t("department")}><select className="input" value={draft.departmentId} onChange={(e) => setDraft({ ...draft, departmentId: e.target.value })}><option value="">{t("none")}</option>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        </div>
        <div className="flex flex-wrap gap-1">{ROLES.map((r) => { const on = draft.roles.includes(r); return <button key={r} onClick={() => setDraft({ ...draft, roles: on ? draft.roles.filter((x) => x !== r) : [...draft.roles, r] })} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${on ? "bg-charcoal text-white" : "bg-white border border-grey-20 text-grey-60"}`}>{t(`role.${r}`)}</button>; })}</div>
        <button className="btn-primary" disabled={!draft.name || !draft.email || !draft.roles.length || create.isPending} onClick={() => create.mutate()}>{t("add")}</button>
      </div>
    </AdminShell>
  );
}
