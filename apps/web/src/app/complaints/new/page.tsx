"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CreateComplaintSchema, type CreateComplaintInput } from "@jemco/shared";
import { api, ApiError } from "@/lib/api";
import { useLabel, useLookups } from "@/lib/hooks";
import { AppShell } from "@/components/AppShell";
import { ChoiceCards, Field, PageTitle } from "@/components/ui";
import { PhotoField, type Attachment } from "@/components/PhotoField";
import type { IconName } from "@/components/icons";

const TOTAL = 7;
const DRAFT_KEY = "jemco.newComplaint";
const TYPE_ICONS: Record<string, IconName> = { CORRECTIVE: "corrective", PREVENTIVE: "preventive", OFI: "idea" };
const PRIORITY_ICONS: Record<string, IconName> = { URGENT: "flag", HIGH: "flag", MEDIUM: "flag", LOW: "flag" };
const H2 = "text-[clamp(21px,4.1vw,28px)] leading-snug tracking-[-0.03em] font-bold";

/** Six steps, one question each. Draft is kept in localStorage so a lost signal loses nothing. */
export default function NewComplaintPage() {
  const t = useTranslations("new");
  const router = useRouter();
  const { data: lk } = useLookups(); const { label } = useLabel();
  // The draft keeps the values, the step and the uploaded photos, so a dropped signal or a reload resumes where the person was.
  const draft = (() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); } catch { return {}; } })() as { v?: Partial<CreateComplaintInput>; step?: number; photos?: Attachment[] };
  const [step, setStepState] = useState(draft.step ?? 1);
  const [v, setV] = useState<Partial<CreateComplaintInput>>(draft.v ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [doneNumber, setDoneNumber] = useState<string | null>(null);
  const [photos, setPhotosState] = useState<Attachment[]>(draft.photos ?? []);
  const save = (next: { v?: Partial<CreateComplaintInput>; step?: number; photos?: Attachment[] }) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ v, step, photos, ...next })); } catch {} };
  const set = (patch: Partial<CreateComplaintInput>) => { const n = { ...v, ...patch }; setV(n); save({ v: n }); };
  const setStep = (n: number) => { setStepState(n); save({ step: n }); };
  const setPhotos = (p: Attachment[]) => { setPhotosState(p); save({ photos: p }); };

  const send = useMutation({
    mutationFn: () => api<{ number: string }>("/complaints", { method: "POST", json: { ...v, quantity: Number(v.quantity), attachmentIds: photos.map((a) => a.id) } }),
    onSuccess: (r) => { setDoneNumber(r.number); try { localStorage.removeItem(DRAFT_KEY); } catch {} setPhotosState([]); },
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
    const r = CreateComplaintSchema.safeParse({ ...v, quantity: Number(v.quantity), attachmentIds: photos.map((a) => a.id) });
    if (!r.success) { const f: Record<string, string> = {}; for (const i of r.error.issues) f[i.path.join(".")] = i.message; setErrors(f); return; }
    send.mutate();
  };

  if (doneNumber) return (
    <AppShell><div className="card max-w-lg mx-auto text-center space-y-4 py-10">
      <div className="text-ok text-5xl">✓</div>
      <h1 className="text-2xl font-bold">{t("done.title", { number: doneNumber })}</h1>
      <p className="text-grey-60">{t("done.body")}</p>
      <div className="flex gap-3 justify-center"><button className="btn-secondary" onClick={() => { setDoneNumber(null); setV({}); setPhotosState([]); setStepState(1); try { localStorage.removeItem(DRAFT_KEY); } catch {} }}>{t("done.another")}</button><Link href="/todo" className="btn-primary">{t("done.todo")}</Link></div>
    </div></AppShell>
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[900px]">
      <PageTitle right={<span className="mt-3 whitespace-nowrap text-sm text-grey-60">{t("step", { n: step, total: TOTAL })}</span>}>{t("title")}</PageTitle>
      <div className="mb-7 h-[7px] overflow-hidden rounded-full bg-[#e6e8ec]" role="progressbar" aria-label={t("title")} aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step}><div className="h-full rounded-full bg-brand transition-[width] motion-reduce:transition-none" style={{ width: `${(step / TOTAL) * 100}%` }} /></div>
      <div className="card space-y-5 rounded-3xl sm:p-8">
        {step === 1 && <><h2 className={H2}>{t("s1.title")}</h2><ChoiceCards options={lk?.type ?? []} value={v.type} icons={TYPE_ICONS} onChange={(type) => set({ type: type as CreateComplaintInput["type"] })} columns={1} /></>}
        {step === 2 && <>
          <h2 className={H2}>{t("s2.title")}</h2>
          <Field label={t("s2.process")}><ChoiceCards options={lk?.process ?? []} value={v.process} onChange={(process) => set({ process: process as CreateComplaintInput["process"] })} /></Field>
          {v.process === "OTHER" && <Field label={t("s2.other")}><input className="input" value={v.processOther ?? ""} onChange={(e) => set({ processOther: e.target.value })} /></Field>}
          <Field label={t("s2.source")}><ChoiceCards options={lk?.source ?? []} value={v.source} onChange={(source) => set({ source: source as CreateComplaintInput["source"] })} /></Field>
          {v.source === "OTHER" && <Field label={t("s2.other")}><input className="input" value={v.sourceOther ?? ""} onChange={(e) => set({ sourceOther: e.target.value })} /></Field>}
        </>}
        {step === 3 && <>
          <h2 className={H2}>{t("s3.title")}</h2>
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
        {step === 4 && <><h2 className={H2}>{t("s4.title")}</h2><ChoiceCards options={lk?.priority ?? []} value={v.priority} icons={PRIORITY_ICONS} onChange={(priority) => set({ priority: priority as CreateComplaintInput["priority"] })} columns={1} /></>}
        {step === 5 && <>
          <h2 className={H2}>{t("s5.title")}</h2><p className="help">{t("s5.help")}</p>
          <textarea className="input min-h-44 py-3" placeholder={t("s5.placeholder")} value={v.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
          {(v.description?.trim().length ?? 0) < 50 && <div className="help">{t("s5.min", { n: v.description?.trim().length ?? 0 })}</div>}
        </>}
        {step === 6 && <>
          <h2 className={H2}>{t("s6.title")}</h2><p className="help">{t("s6.help")}</p>
          <PhotoField value={photos} onChange={setPhotos} />
        </>}
        {step === 7 && <>
          <h2 className={H2}>{t("s7.title")}</h2>
          <dl className="space-y-2 text-sm">
            {([[1, name("type", v.type)], [2, `${name("process", v.process)} · ${name("source", v.source)}`], [3, `${v.customerName ?? v.supplierName ?? ""} PO/DO ${v.poDoNumber} · ${v.quantity} ${name("unit", v.quantityUnit)}`], [4, name("priority", v.priority)], [5, v.description], [6, `${photos.length} file(s)`]] as [number, string | undefined][]).map(([s, val]) => (
              <div key={s} className="flex gap-3 border-b border-grey-20 pb-2"><dd className="flex-1 whitespace-pre-wrap">{val}</dd><button className="text-brand text-sm font-semibold" onClick={() => setStep(s)}>{t("s7.edit")}</button></div>
            ))}
          </dl>
          {Object.keys(errors).length > 0 && <div className="error">{Object.entries(errors).map(([k, m]) => `${k}: ${m}`).join(", ")}</div>}
        </>}
        <div className="flex items-center justify-between gap-3 pt-3">
          <button className="btn-secondary btn-lg min-w-28" onClick={() => (step === 1 ? router.push("/todo") : setStep(step - 1))}>{t("back")}</button>
          {step < TOTAL
            ? <button className="btn-primary btn-lg min-w-28" disabled={!canNext()} onClick={() => setStep(step + 1)}>{t("next")}</button>
            : <button className="btn-primary btn-lg min-w-28" disabled={send.isPending} onClick={submit}>{t("send")}</button>}
        </div>
      </div>
      </div>
    </AppShell>
  );
}
