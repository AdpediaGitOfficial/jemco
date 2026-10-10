"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError, type Lookup } from "@/lib/api";
import { AdminShell } from "@/components/admin";
import { Field } from "@/components/ui";

type Row = Lookup & { sortOrder: number; active: boolean };
const LISTS = ["type", "source", "process", "priority", "disposition", "rootCause", "unit"];

export default function LookupsAdmin() {
  const t = useTranslations("admin"); const qc = useQueryClient();
  const { data } = useQuery<Row[]>({ queryKey: ["admin", "lookups"], queryFn: () => api("/admin/lookups") });
  const [list, setList] = useState("process");
  const [status, setStatus] = useState(""); const [err, setErr] = useState("");
  const [draft, setDraft] = useState({ code: "", labelEn: "", labelMs: "", helpEn: "", helpMs: "" });
  const flash = () => { setStatus(t("saved")); setErr(""); setTimeout(() => setStatus(""), 1500); qc.invalidateQueries({ queryKey: ["admin", "lookups"] }); qc.invalidateQueries({ queryKey: ["lookups"] }); };
  const onErr = (e: unknown) => setErr(e instanceof ApiError ? (e.fields.active === "protected" ? t("protected") : Object.entries(e.fields).map(([k, v]) => `${k}: ${v}`).join(", ") || e.message) : String(e));
  const patch = useMutation({ mutationFn: ({ code, body }: { code: string; body: Partial<Row> }) => api(`/admin/lookups/${list}/${code}`, { method: "PATCH", json: body }), onSuccess: flash, onError: onErr });
  const add = useMutation({ mutationFn: () => api(`/admin/lookups/${list}`, { method: "POST", json: { ...draft, helpEn: draft.helpEn || null, helpMs: draft.helpMs || null } }), onSuccess: () => { flash(); setDraft({ code: "", labelEn: "", labelMs: "", helpEn: "", helpMs: "" }); }, onError: onErr });
  const rows = (data ?? []).filter((r) => r.list === list);
  return (
    <AdminShell section="lookups" status={status}>
      <div className="flex gap-1 flex-wrap mb-4">{LISTS.map((l) => <button key={l} onClick={() => setList(l)} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${l === list ? "bg-charcoal text-white" : "bg-white border border-grey-20 text-grey-60"}`}>{l}</button>)}</div>
      <div className="card p-0 overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-grey-60"><tr><th className="px-3 py-2">{t("code")}</th><th className="px-3 py-2">{t("labelEn")}</th><th className="px-3 py-2">{t("labelMs")}</th><th className="px-3 py-2">{t("helpEn")}</th><th className="px-3 py-2">{t("helpMs")}</th><th className="px-3 py-2">{t("status")}</th></tr></thead>
          <tbody>{rows.map((r) => <LookupRow key={r.code} r={r} onSave={(body) => patch.mutate({ code: r.code, body })} t={t} />)}</tbody>
        </table>
      </div>
      <div className="card space-y-3">
        <div className="font-semibold">{t("add")}</div>
        <div className="grid sm:grid-cols-5 gap-3">
          <Field label={t("code")}><input className="input uppercase" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} placeholder="E.G. PACKING" /></Field>
          <Field label={t("labelEn")}><input className="input" value={draft.labelEn} onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })} /></Field>
          <Field label={t("labelMs")}><input className="input" value={draft.labelMs} onChange={(e) => setDraft({ ...draft, labelMs: e.target.value })} /></Field>
          <Field label={t("helpEn")}><input className="input" value={draft.helpEn} onChange={(e) => setDraft({ ...draft, helpEn: e.target.value })} /></Field>
          <Field label={t("helpMs")}><input className="input" value={draft.helpMs} onChange={(e) => setDraft({ ...draft, helpMs: e.target.value })} /></Field>
        </div>
        {err && <div className="error">{err}</div>}
        <button className="btn-primary" disabled={!draft.code || !draft.labelEn || !draft.labelMs || add.isPending} onClick={() => add.mutate()}>{t("add")}</button>
      </div>
    </AdminShell>
  );
}

function LookupRow({ r, onSave, t }: { r: Row; onSave: (b: Partial<Row>) => void; t: ReturnType<typeof useTranslations> }) {
  const [v, setV] = useState({ labelEn: r.labelEn, labelMs: r.labelMs, helpEn: r.helpEn ?? "", helpMs: r.helpMs ?? "" });
  const dirty = v.labelEn !== r.labelEn || v.labelMs !== r.labelMs || v.helpEn !== (r.helpEn ?? "") || v.helpMs !== (r.helpMs ?? "");
  const save = () => { if (dirty) onSave({ labelEn: v.labelEn, labelMs: v.labelMs, helpEn: v.helpEn || null, helpMs: v.helpMs || null }); };
  const cell = (k: keyof typeof v) => <input className="input min-h-10 text-sm" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} onBlur={save} />;
  return (
    <tr className={`border-t border-grey-20 ${r.active ? "" : "opacity-50"}`}>
      <td className="px-3 py-2 font-mono whitespace-nowrap">{r.code}</td>
      <td className="px-3 py-2 min-w-40">{cell("labelEn")}</td><td className="px-3 py-2 min-w-40">{cell("labelMs")}</td>
      <td className="px-3 py-2 min-w-40">{cell("helpEn")}</td><td className="px-3 py-2 min-w-40">{cell("helpMs")}</td>
      <td className="px-3 py-2 whitespace-nowrap"><button className="btn-secondary min-h-10 text-sm" onClick={() => onSave({ active: !r.active })}>{r.active ? t("active") : t("inactive")}</button></td>
    </tr>
  );
}
