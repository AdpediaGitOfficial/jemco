"use client";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Field, PageTitle, PriorityChip, StatusChip } from "@/components/ui";
import { useLabel, useLookups } from "@/lib/hooks";

type C = { number: string; status: string; priority: string; type: string; source: string; process: string; customerName: string | null; supplierName: string | null; poDoNumber: string; quantity: string; quantityUnit: string; description: string; raisedAt: string; infoQuestion: string | null; infoAnswer: string | null; rejectionText: string | null; ncr: { number: string; state: string } | null };

export default function ComplaintPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const t = useTranslations("complaint");
  const qc = useQueryClient();
  const { data: c } = useQuery<C>({ queryKey: ["complaint", number], queryFn: () => api(`/complaints/${number}`) });
  const { data: lk } = useLookups(); const { label } = useLabel();
  const [answer, setAnswer] = useState("");
  const send = useMutation({ mutationFn: () => api(`/complaints/${number}/answer`, { method: "POST", json: { answer } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["complaint", number] }) });
  const name = (list: string, code: string) => { const o = lk?.[list]?.find((x) => x.code === code); return o ? label(o) : code; };
  if (!c) return <AppShell><div /></AppShell>;
  return (
    <AppShell>
      <PageTitle right={<StatusChip status={c.status} />}>{t("title", { number: c.number })}</PageTitle>
      {c.status === "NEED_MORE_INFO" && (
        <div className="card mb-4 border-warn/40 space-y-3">
          <div className="font-semibold">{t("question")}</div><p>{c.infoQuestion}</p>
          <Field label={t("answer")}><textarea className="input min-h-28 py-3" value={answer} onChange={(e) => setAnswer(e.target.value)} /></Field>
          <button className="btn-primary" disabled={!answer.trim() || send.isPending} onClick={() => send.mutate()}>{t("send")}</button>
        </div>
      )}
      {c.status === "REJECTED" && <div className="card mb-4 border-grey-60"><div className="font-semibold">{t("rejected")}</div><p className="text-grey-60">{c.rejectionText}</p></div>}
      {c.ncr && <div className="card mb-4 border-ok/40 font-semibold">{t("ncr", { number: c.ncr.number })} · <StatusChip status={c.ncr.state} /></div>}
      <div className="card space-y-2 text-sm">
        <div className="flex gap-2 items-center"><PriorityChip priority={c.priority} /><span>{name("type", c.type)}</span></div>
        <div><span className="text-grey-60">{name("source", c.source)}</span> · {name("process", c.process)}</div>
        {c.customerName && <div>{c.customerName}</div>}{c.supplierName && <div>{c.supplierName}</div>}
        <div>PO/DO {c.poDoNumber} · {c.quantity} {name("unit", c.quantityUnit)}</div>
        <p className="whitespace-pre-wrap pt-2 text-base">{c.description}</p>
        {c.infoAnswer && <p className="pt-2 border-t border-grey-20"><span className="text-grey-60">{t("answer")}:</span> {c.infoAnswer}</p>}
      </div>
    </AppShell>
  );
}
