"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import { useLabel, useLookups, useMe } from "@/lib/hooks";
import { AppShell } from "@/components/AppShell";
import { Field, PageTitle, PriorityChip, StatusChip, ClockBar } from "@/components/ui";
import type { NcrDetail } from "@/components/NcrSummary";
import { PhotoField, type Attachment } from "@/components/PhotoField";

type Item = { id?: string; description: string; ownerId: string; dueDate: string; done: boolean };

/** Part 2B as a guided form. Autosaves on blur; Submit checks completeness and names what is missing. */
export default function ActionPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const t = useTranslations("ncr");
  const router = useRouter(); const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: n } = useQuery<NcrDetail>({ queryKey: ["ncr", number], queryFn: () => api(`/ncr/${number}`) });
  const { data: lk } = useLookups(); const { label } = useLabel();
  const [f, setF] = useState({ containment: "", rootCause: "", rootCauseCategory: "", actionPlan: "" });
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [evidence, setEvidence] = useState<Attachment[]>([]);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => {
    if (n && !loaded) {
      setF({ containment: n.containment ?? "", rootCause: n.rootCause ?? "", rootCauseCategory: n.rootCauseCategory ?? "", actionPlan: n.actionPlan ?? "" });
      setItems(n.actions.map((a) => ({ id: a.id, description: a.description, ownerId: a.ownerId, dueDate: a.dueDate.slice(0, 10), done: a.done })));
      setEvidence(n.attachments ?? []);
      setLoaded(true);
    }
  }, [n, loaded]);
  const payload = () => ({ containment: f.containment || undefined, rootCause: f.rootCause || undefined, rootCauseCategory: f.rootCauseCategory || undefined, actionPlan: f.actionPlan || undefined, actions: items.filter((i) => i.description.trim()) });
  const save = useMutation({
    mutationFn: () => api<NcrDetail>(`/ncr/${number}/action`, { method: "POST", json: payload() }),
    onSuccess: (r) => {
      setMsg(t("saved")); setErr("");
      // Take ids from the server, but keep rows the person is still typing (no text yet, so never sent).
      setItems((prev) => [...r.actions.map((a) => ({ id: a.id, description: a.description, ownerId: a.ownerId, dueDate: a.dueDate.slice(0, 10), done: a.done })), ...prev.filter((i) => !i.id && !i.description.trim())]);
      qc.setQueryData(["ncr", number], r); setTimeout(() => setMsg(""), 2000);
    },
    onError: (e) => setErr(e instanceof ApiError ? Object.values(e.fields).join(", ") || e.message : String(e)),
  });
  const submit = useMutation({
    mutationFn: async () => { await save.mutateAsync(); return api(`/ncr/${number}/submit`, { method: "POST" }); },
    onSuccess: () => { qc.invalidateQueries(); router.push("/todo"); },
    onError: (e) => { if (e instanceof ApiError && e.message === "incomplete") setErr(t("incomplete", { items: Object.keys(e.fields).map((k) => t(`missing.${k}`)).join(", ") })); else setErr(String(e)); },
  });
  if (!n || !me) return <AppShell><div /></AppShell>;
  const clock = n.clocks.find((c) => c.kind === "RESOLUTION");
  const addItem = () => setItems([...items, { description: "", ownerId: me.id, dueDate: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10), done: false }]);
  const isOfi = n.complaint?.type === "OFI";
  return (
    <AppShell>
      <PageTitle right={<div className="flex gap-2 items-center"><StatusChip status={n.state} /><PriorityChip priority={n.priority} /></div>}>{t("title", { number })}</PageTitle>
      <div className="max-w-2xl space-y-4">
        {clock && <div className="card"><ClockBar dueAt={clock.dueAt} startedAt={clock.startedAt} /></div>}
        {n.state === "RETURNED" && n.returnReason && <div className="rounded-xl bg-bad/5 border border-bad/30 p-4 text-sm"><div className="font-semibold">{t("returned")}</div>{n.returnReason}</div>}
        {n.complaint && <div className="card text-sm"><div className="text-grey-60 mb-1">{t("issue")} · {n.complaint.number}</div><p className="whitespace-pre-wrap">{n.complaint.description}</p></div>}
        <div className="card space-y-5">
          <h2 className="text-xl font-semibold">{t("action")}</h2>
          <Field label={t("containment")}><textarea className="input min-h-24 py-3" value={f.containment} onChange={(e) => setF({ ...f, containment: e.target.value })} onBlur={() => save.mutate()} /></Field>
          <Field label={t("rootCause") + (isOfi ? "" : " *")} help={t("rootCauseHelp")}><textarea className="input min-h-36 py-3" value={f.rootCause} onChange={(e) => setF({ ...f, rootCause: e.target.value })} onBlur={() => save.mutate()} /></Field>
          <Field label={t("rootCauseCategory")}><select className="input" value={f.rootCauseCategory} onChange={(e) => { setF({ ...f, rootCauseCategory: e.target.value }); }} onBlur={() => save.mutate()}><option value="" />{lk?.rootCause?.map((o) => <option key={o.code} value={o.code}>{label(o)}</option>)}</select></Field>
          <Field label={t("plan") + " *"}><textarea className="input min-h-28 py-3" value={f.actionPlan} onChange={(e) => setF({ ...f, actionPlan: e.target.value })} onBlur={() => save.mutate()} /></Field>
          <div>
            <div className="label">{t("actions")} *</div>
            <div className="space-y-3">{items.map((it, i) => (
              <div key={it.id ?? i} className="rounded-xl border border-grey-20 p-3 space-y-2">
                <input className="input" placeholder={t("actionDesc")} value={it.description} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                <div className="flex gap-2 items-center">
                  <input className="input" type="date" value={it.dueDate} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x))} />
                  <label className="flex items-center gap-2 min-h-12 px-3 rounded-xl border border-grey-20 whitespace-nowrap"><input type="checkbox" className="h-5 w-5 accent-brand" checked={it.done} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, done: e.target.checked } : x))} />{t("actionDone")}</label>
                </div>
              </div>
            ))}</div>
            <button className="btn-secondary mt-3" onClick={addItem}>+ {t("addAction")}</button>
          </div>
          <Field label={t("evidence")}><PhotoField value={evidence} onChange={setEvidence} ncrId={n.id} canRemove={false} /></Field>
          {msg && <div className="text-ok text-sm">{msg}</div>}
          {err && <div className="error">{err}</div>}
          <div className="flex gap-3 justify-end pt-2">
            <button className="btn-secondary" disabled={save.isPending} onClick={() => save.mutate()}>{t("save")}</button>
            <button className="btn-primary" disabled={submit.isPending} onClick={() => submit.mutate()}>{t("submit")}</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
