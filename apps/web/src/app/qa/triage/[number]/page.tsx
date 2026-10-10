"use client";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import { useLabel, useLookups } from "@/lib/hooks";
import { AppShell } from "@/components/AppShell";
import { ChoiceCards, Field, PageTitle, PriorityChip } from "@/components/ui";

type C = { id: string; number: string; priority: string; type: string; source: string; process: string; customerName: string | null; supplierName: string | null; poDoNumber: string; quantity: string; quantityUnit: string; description: string; raisedBy: { name: string }; infoAnswer: string | null };
type Dept = { id: string; code: string; name: string };
type Person = { id: string; name: string; departmentId: string | null; outOfOffice: boolean };
type Routing = Record<string, string>;

export default function TriagePage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const t = useTranslations("triage");
  const router = useRouter(); const qc = useQueryClient();
  const { data: c } = useQuery<C>({ queryKey: ["complaint", number], queryFn: () => api(`/complaints/${number}`) });
  const { data: depts } = useQuery<Dept[]>({ queryKey: ["departments"], queryFn: () => api("/users/departments") });
  const { data: people } = useQuery<Person[]>({ queryKey: ["assignable"], queryFn: () => api("/users/assignable") });
  const { data: lk } = useLookups(); const { label } = useLabel();
  const [decision, setDecision] = useState<"ACCEPT" | "REJECT" | "NEED_MORE_INFO">("ACCEPT");
  const [priority, setPriority] = useState(""); const [priorityChangeReason, setReason] = useState("");
  const [departmentId, setDept] = useState(""); const [assigneeId, setAssignee] = useState(""); const [notes, setNotes] = useState("");
  const [reason, setRejectReason] = useState("NOT_NC"); const [reasonText, setReasonText] = useState(""); const [question, setQuestion] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (c && !priority) setPriority(c.priority); }, [c, priority]);
  // Default department from the Process → department routing map (code match).
  const routing: Routing = { PROD_HYPER: "PROD", PROD_NORMAL: "PROD", POWDER_COATING: "PC", WAREHOUSE: "WH", PURCHASING: "PUR", LOGISTIC: "LOG", QUALITY: "QA", SALES_HYPER: "SALES", SALES_NORMAL: "SALES", OTHER: "QA" };
  useEffect(() => { if (c && depts && !departmentId) { const d = depts.find((x) => x.code === routing[c.process]); if (d) setDept(d.id); } }, [c, depts, departmentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const candidates = useMemo(() => people?.filter((p) => !departmentId || p.departmentId === departmentId) ?? [], [people, departmentId]);
  useEffect(() => { if (candidates.length && !candidates.some((p) => p.id === assigneeId)) setAssignee(candidates.find((p) => !p.outOfOffice)?.id ?? candidates[0].id); }, [candidates, assigneeId]);

  const submit = useMutation({
    mutationFn: () => api(`/complaints/${number}/triage`, { method: "POST", json:
      decision === "ACCEPT" ? { decision, priority, priorityChangeReason: priority !== c?.priority ? priorityChangeReason : undefined, departmentId, assigneeId, notes: notes || undefined }
      : decision === "REJECT" ? { decision, reason, reasonText } : { decision, question } }),
    onSuccess: () => { qc.invalidateQueries(); router.push("/qa/triage"); },
    onError: (e) => setErr(e instanceof ApiError ? Object.values(e.fields).join(", ") || e.message : String(e)),
  });
  const name = (list: string, code: string) => { const o = lk?.[list]?.find((x) => x.code === code); return o ? label(o) : code; };
  if (!c) return <AppShell><div /></AppShell>;
  const reasons = ["DUPLICATE", "NOT_NC", "INSUFFICIENT_INFO", "OUT_OF_SCOPE", "OTHER"];
  return (
    <AppShell>
      <PageTitle right={<PriorityChip priority={c.priority} />}>{t("title")} · {c.number}</PageTitle>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="card space-y-2 text-sm">
          <div className="text-grey-60">{c.raisedBy.name} · {name("type", c.type)}</div>
          <div>{name("source", c.source)} · {name("process", c.process)}</div>
          {c.customerName && <div>{c.customerName}</div>}{c.supplierName && <div>{c.supplierName}</div>}
          <div>PO/DO {c.poDoNumber} · {c.quantity} {name("unit", c.quantityUnit)}</div>
          <p className="whitespace-pre-wrap text-base pt-2">{c.description}</p>
          {c.infoAnswer && <p className="pt-2 border-t border-grey-20">{c.infoAnswer}</p>}
        </div>
        <div className="card space-y-4">
          <div className="label">{t("decision")}</div>
          <div className="grid grid-cols-1 gap-2">
            {(["ACCEPT", "REJECT", "NEED_MORE_INFO"] as const).map((d) => (
              <button key={d} onClick={() => setDecision(d)} className={`text-left rounded-xl border-2 p-3 font-semibold ${decision === d ? "border-brand bg-brand/5" : "border-grey-20"}`}>{t(d === "ACCEPT" ? "accept" : d === "REJECT" ? "reject" : "ask")}</button>
            ))}
          </div>
          {decision === "ACCEPT" && <>
            <Field label={t("priority")}><ChoiceCards options={lk?.priority ?? []} value={priority} onChange={setPriority} /></Field>
            {priority !== c.priority && <Field label={t("priorityReason")}><input className="input" value={priorityChangeReason} onChange={(e) => setReason(e.target.value)} /></Field>}
            <Field label={t("department")}><select className="input" value={departmentId} onChange={(e) => setDept(e.target.value)}>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label={t("assignee")}><select className="input" value={assigneeId} onChange={(e) => setAssignee(e.target.value)}>{candidates.map((p) => <option key={p.id} value={p.id}>{p.name}{p.outOfOffice ? " (away)" : ""}</option>)}</select></Field>
            <Field label={t("notes")}><textarea className="input min-h-20 py-3" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </>}
          {decision === "REJECT" && <>
            <Field label={t("reason")}><select className="input" value={reason} onChange={(e) => setRejectReason(e.target.value)}>{reasons.map((r) => <option key={r} value={r}>{t(`rejectReason.${r}`)}</option>)}</select></Field>
            <Field label={t("reasonText")}><textarea className="input min-h-24 py-3" value={reasonText} onChange={(e) => setReasonText(e.target.value)} /></Field>
          </>}
          {decision === "NEED_MORE_INFO" && <Field label={t("question")}><textarea className="input min-h-24 py-3" value={question} onChange={(e) => setQuestion(e.target.value)} /></Field>}
          {err && <div className="error">{err}</div>}
          <button className="btn-primary w-full" disabled={submit.isPending || (decision === "ACCEPT" && !assigneeId) || (decision === "REJECT" && !reasonText.trim()) || (decision === "NEED_MORE_INFO" && !question.trim())} onClick={() => submit.mutate()}>{t("submit")}</button>
        </div>
      </div>
    </AppShell>
  );
}
