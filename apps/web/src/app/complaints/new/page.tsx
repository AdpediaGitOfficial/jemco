"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CreateComplaintSchema, type CreateComplaintInput } from "@jemco/shared";
import { api, ApiError } from "@/lib/api";
import { useLabel, useLookups } from "@/lib/hooks";
import { AppShell } from "@/components/AppShell";
import { ChoiceCards, Field, PageTitle } from "@/components/ui";

const TOTAL = 6;
const DRAFT_KEY = "jemco.newComplaint";

/** Six steps, one question each. Draft is kept in localStorage so a lost signal loses nothing. */
export default function NewComplaintPage() {
  const t = useTranslations("new");
  const { data: lk } = useLookups(); const { label } = useLabel();
  const [step, setStep] = useState(1);
  const [v, setV] = useState<Partial<CreateComplaintInput>>(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); } catch { return {}; }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [doneNumber, setDoneNumber] = useState<string | null>(null);
  const set = (patch: Partial<CreateComplaintInput>) => { const n = { ...v, ...patch }; setV(n); try { localStorage.setItem(DRAFT_KEY, JSON.stringify(n)); } catch {} };

  const send = useMutation({
    mutationFn: () => api<{ number: string }>("/complaints", { method: "POST", json: { ...v, quantity: Number(v.quantity), attachmentIds: [] } }),
    onSuccess: (r) => { setDoneNumber(r.number); try { localStorage.removeItem(DRAFT_KEY); } catch {} },
    onError: (e) => { if (e instanceof ApiError) setErrors(e.fields); },
  });

  const name = (list: string, code?: string) => { const o = lk?.[list]?.find((x) => x.code === code); return o ? label(o) : code ?? ""; };
  const canNext = () => {
    switch (step) {
      case 1: return !!v.type;
      case 2: return !!v.process && !!v.source && (v.process !== "OTHER" || !!v.processOther) && (v.source !== "OTHER" || !!v.sourceOther);
      case 3: return !!v.poDoNumber && !!v.quantity && !!v.quantityUnit && (v.source !== "CUSTOMER" || !!v.customerName) && (v.source !== "SUPPLIER" || !!v.supplierName);
      case 4: return !!v.priority;
      case 5: return (v.description?.trim().length ?? 0) >= 50;
      default: return true;
    }
  };
  const submit = () => {
    const r = CreateComplaintSchema.safeParse({ ...v, quantity: Number(v.quantity), attachmentIds: [] });
    if (!r.success) { const f: Record<string, string> = {}; for (const i of r.error.issues) f[i.path.join(".")] = i.message; setErrors(f); return; }
    send.mutate();
  };

  if (doneNumber) return (
    <AppShell><div className="card max-w-lg mx-auto text-center space-y-4 py-10">
      <div className="text-ok text-5xl">✓</div>
      <h1 className="text-2xl font-bold">{t("done.title", { number: doneNumber })}</h1>
      <p className="text-grey-60">{t("done.body")}</p>
      <div className="flex gap-3 justify-center"><button className="btn-secondary" onClick={() => { setDoneNumber(null); setV({}); setStep(1); }}>{t("done.another")}</button><Link href="/todo" className="btn-primary">{t("done.todo")}</Link></div>
    </div></AppShell>
  );

  return (
    <AppShell>
      <PageTitle right={<span className="text-sm text-grey-60 mt-2">{t("step", { n: step, total: TOTAL })}</span>}>{t("title")}</PageTitle>
      <div className="h-1.5 rounded-full bg-grey-20 mb-6"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} /></div>
      <div className="card max-w-2xl space-y-5">
        {step === 1 && <><h2 className="text-xl font-semibold">{t("s1.title")}</h2><ChoiceCards options={lk?.type ?? []} value={v.type} onChange={(type) => set({ type: type as CreateComplaintInput["type"] })} columns={1} /></>}
        {step === 2 && <>
          <h2 className="text-xl font-semibold">{t("s2.title")}</h2>
          <Field label={t("s2.process")}><ChoiceCards options={lk?.process ?? []} value={v.process} onChange={(process) => set({ process: process as CreateComplaintInput["process"] })} /></Field>
          {v.process === "OTHER" && <Field label={t("s2.other")}><input className="input" value={v.processOther ?? ""} onChange={(e) => set({ processOther: e.target.value })} /></Field>}
          <Field label={t("s2.source")}><ChoiceCards options={lk?.source ?? []} value={v.source} onChange={(source) => set({ source: source as CreateComplaintInput["source"] })} /></Field>
          {v.source === "OTHER" && <Field label={t("s2.other")}><input className="input" value={v.sourceOther ?? ""} onChange={(e) => set({ sourceOther: e.target.value })} /></Field>}
        </>}
        {step === 3 && <>
          <h2 className="text-xl font-semibold">{t("s3.title")}</h2>
          {v.source === "CUSTOMER" && <Field label={t("s3.customer")} error={errors.customerName}><input className="input" value={v.customerName ?? ""} onChange={(e) => set({ customerName: e.target.value })} /></Field>}
          {v.source === "SUPPLIER" && <Field label={t("s3.supplier")} error={errors.supplierName}><input className="input" value={v.supplierName ?? ""} onChange={(e) => set({ supplierName: e.target.value })} /></Field>}
          <Field label={t("s3.po")} error={errors.poDoNumber}><input className="input" value={v.poDoNumber ?? ""} onChange={(e) => set({ poDoNumber: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("s3.qty")} error={errors.quantity}><input className="input" type="number" inputMode="decimal" min={0} value={v.quantity ?? ""} onChange={(e) => set({ quantity: e.target.value as unknown as number })} /></Field>
            <Field label={t("s3.unit")}><select className="input" value={v.quantityUnit ?? ""} onChange={(e) => set({ quantityUnit: e.target.value as CreateComplaintInput["quantityUnit"] })}><option value="" />{lk?.unit?.map((u) => <option key={u.code} value={u.code}>{label(u)}</option>)}</select></Field>
          </div>
          <Field label={t("s3.delivery")}><input className="input" type="date" value={v.deliveryDate ?? ""} onChange={(e) => set({ deliveryDate: e.target.value || undefined })} /></Field>
          {(v.process === "SALES_HYPER" || v.process === "SALES_NORMAL") && <Field label={t("s3.cef")}><input className="input" value={v.cefNumber ?? ""} onChange={(e) => set({ cefNumber: e.target.value })} /></Field>}
        </>}
        {step === 4 && <><h2 className="text-xl font-semibold">{t("s4.title")}</h2><ChoiceCards options={lk?.priority ?? []} value={v.priority} onChange={(priority) => set({ priority: priority as CreateComplaintInput["priority"] })} columns={1} /></>}
        {step === 5 && <>
          <h2 className="text-xl font-semibold">{t("s5.title")}</h2><p className="help">{t("s5.help")}</p>
          <textarea className="input min-h-44 py-3" placeholder={t("s5.placeholder")} value={v.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
          {(v.description?.trim().length ?? 0) < 50 && <div className="help">{t("s5.min", { n: v.description?.trim().length ?? 0 })}</div>}
        </>}
        {step === 6 && <>
          <h2 className="text-xl font-semibold">{t("s6.title")}</h2>
          <dl className="space-y-2 text-sm">
            {([[1, name("type", v.type)], [2, `${name("process", v.process)} · ${name("source", v.source)}`], [3, `${v.customerName ?? v.supplierName ?? ""} PO/DO ${v.poDoNumber} · ${v.quantity} ${name("unit", v.quantityUnit)}`], [4, name("priority", v.priority)], [5, v.description]] as [number, string | undefined][]).map(([s, val]) => (
              <div key={s} className="flex gap-3 border-b border-grey-20 pb-2"><dd className="flex-1 whitespace-pre-wrap">{val}</dd><button className="text-brand text-sm font-semibold" onClick={() => setStep(s)}>{t("s6.edit")}</button></div>
            ))}
          </dl>
          {Object.keys(errors).length > 0 && <div className="error">{Object.entries(errors).map(([k, m]) => `${k}: ${m}`).join(", ")}</div>}
        </>}
        <div className="flex justify-between pt-2">
          <button className="btn-secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>{t("back")}</button>
          {step < TOTAL
            ? <button className="btn-primary" disabled={!canNext()} onClick={() => setStep(step + 1)}>{t("next")}</button>
            : <button className="btn-primary" disabled={send.isPending} onClick={submit}>{t("send")}</button>}
        </div>
      </div>
    </AppShell>
  );
}
