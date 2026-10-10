"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import { useLabel, useLookups } from "@/lib/hooks";
import { AppShell } from "@/components/AppShell";
import { Field, PageTitle } from "@/components/ui";
import { NcrSummary, type NcrDetail } from "@/components/NcrSummary";

export default function VerifyPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const t = useTranslations("verify");
  const router = useRouter(); const qc = useQueryClient();
  const { data: n } = useQuery<NcrDetail>({ queryKey: ["ncr", number], queryFn: () => api(`/ncr/${number}`) });
  const { data: lk } = useLookups(); const { label } = useLabel();
  const [result, setResult] = useState<"SATISFACTORY" | "NON_SATISFACTORY">("SATISFACTORY");
  const [dispositions, setDisp] = useState<string[]>([]); const [cost, setCost] = useState(""); const [just, setJust] = useState(""); const [ret, setRet] = useState("");
  const [err, setErr] = useState("");
  const submit = useMutation({
    mutationFn: () => api(`/ncr/${number}/verify`, { method: "POST", json: result === "SATISFACTORY" ? { result, dispositions, costOfNc: cost ? Number(cost) : undefined, qaJustification: just } : { result, returnReason: ret, qaJustification: just } }),
    onSuccess: () => { qc.invalidateQueries(); router.push("/qa/verify"); },
    onError: (e) => setErr(e instanceof ApiError ? Object.values(e.fields).join(", ") || e.message : String(e)),
  });
  if (!n) return <AppShell><div /></AppShell>;
  return (
    <AppShell>
      <PageTitle>{t("title", { number })}</PageTitle>
      <div className="grid md:grid-cols-2 gap-5">
        <NcrSummary n={n} />
        <div className="card space-y-4">
          <div className="label">{t("result")}</div>
          <button onClick={() => setResult("SATISFACTORY")} className={`w-full text-left rounded-xl border-2 p-3 font-semibold ${result === "SATISFACTORY" ? "border-ok bg-ok/5" : "border-grey-20"}`}>{t("ok")}</button>
          <button onClick={() => setResult("NON_SATISFACTORY")} className={`w-full text-left rounded-xl border-2 p-3 font-semibold ${result === "NON_SATISFACTORY" ? "border-bad bg-bad/5" : "border-grey-20"}`}>{t("no")}</button>
          {result === "SATISFACTORY" ? <>
            <Field label={t("dispositions")}>
              <div className="grid gap-2">{lk?.disposition?.map((d) => (
                <label key={d.code} className="flex items-center gap-3 min-h-12 rounded-xl border border-grey-20 px-3"><input type="checkbox" className="h-5 w-5 accent-brand" checked={dispositions.includes(d.code)} onChange={(e) => setDisp(e.target.checked ? [...dispositions, d.code] : dispositions.filter((x) => x !== d.code))} />{label(d)}</label>
              ))}</div>
            </Field>
            <Field label={t("cost")}><input className="input" type="number" inputMode="decimal" min={0} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
          </> : <Field label={t("returnReason")}><textarea className="input min-h-24 py-3" value={ret} onChange={(e) => setRet(e.target.value)} /></Field>}
          <Field label={t("justification")}><textarea className="input min-h-24 py-3" value={just} onChange={(e) => setJust(e.target.value)} /></Field>
          {err && <div className="error">{err}</div>}
          <button className="btn-primary w-full" disabled={submit.isPending || !just.trim() || (result === "SATISFACTORY" ? !dispositions.length : !ret.trim())} onClick={() => submit.mutate()}>{t("submit")}</button>
        </div>
      </div>
    </AppShell>
  );
}
