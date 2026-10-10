"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import { Field } from "./ui";

type N = { number: string; state: string; effectivenessDue: string | null; effectivenessResult: string | null; effectivenessNotes: string | null; effectivenessReviewedAt: string | null; effectivenessReviewedBy?: { name: string } | null };

/** QA records the post-closure effectiveness review; shown only on closed NCRs. */
export function EffectivenessCard({ n, canReview }: { n: N; canReview: boolean }) {
  const t = useTranslations("ncr"); const qc = useQueryClient();
  const [result, setResult] = useState<"EFFECTIVE" | "NOT_EFFECTIVE" | "NOT_APPLICABLE" | "">("");
  const [notes, setNotes] = useState(""); const [err, setErr] = useState(""); const [follow, setFollow] = useState("");
  const save = useMutation({
    mutationFn: () => api<{ result: string; followUp: string | null }>(`/ncr/${n.number}/effectiveness`, { method: "POST", json: { result, notes: notes || undefined } }),
    onSuccess: (r) => { if (r.followUp) setFollow(r.followUp); qc.invalidateQueries({ queryKey: ["ncr", n.number] }); qc.invalidateQueries({ queryKey: ["todo"] }); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : String(e)),
  });
  if (n.state !== "CLOSED") return null;
  const tone = { EFFECTIVE: "border-ok bg-ok/5", NOT_EFFECTIVE: "border-bad bg-bad/5", NOT_APPLICABLE: "border-grey-60 bg-surface" } as Record<string, string>;
  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">{t("effTitle")}</h2>
      {n.effectivenessResult ? (
        <div className="text-sm">
          <div>{t("effDone", { result: t(n.effectivenessResult), who: n.effectivenessReviewedBy?.name ?? "QA", date: n.effectivenessReviewedAt ? new Date(n.effectivenessReviewedAt).toLocaleDateString() : "" })}</div>
          {n.effectivenessNotes && <p className="text-grey-60 whitespace-pre-wrap mt-1">{n.effectivenessNotes}</p>}
          {follow && <div className="mt-2 font-semibold text-bad">{t("effFollow", { number: follow })}</div>}
        </div>
      ) : (
        <>
          <p className="help">{t("effHelp")}</p>
          {n.effectivenessDue && <div className="text-sm text-grey-60">{t("effDue", { date: new Date(n.effectivenessDue).toLocaleDateString() })}</div>}
          {canReview && <>
            <div className="grid sm:grid-cols-3 gap-2">{(["EFFECTIVE", "NOT_EFFECTIVE", "NOT_APPLICABLE"] as const).map((r) => (
              <button key={r} onClick={() => setResult(r)} className={`rounded-xl border-2 p-3 font-semibold text-left ${result === r ? tone[r] : "border-grey-20"}`}>{t(r)}</button>))}</div>
            <Field label={t("effNotes")}><textarea className="input min-h-20 py-3" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            {err && <div className="error">{err}</div>}
            <button className="btn-primary" disabled={!result || save.isPending} onClick={() => save.mutate()}>{t("effSave")}</button>
          </>}
        </>
      )}
    </div>
  );
}
