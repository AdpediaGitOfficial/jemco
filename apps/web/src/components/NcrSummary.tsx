"use client";
import { useTranslations } from "next-intl";
import { useLabel, useLookups } from "@/lib/hooks";
import { ClockBar, PriorityChip, StatusChip } from "./ui";
import { Timeline } from "./Timeline";

export type NcrDetail = {
  id: string; number: string; state: string; priority: string; respondBy: string | null; returnCount: number; triageNotes: string | null;
  containment: string | null; rootCause: string | null; rootCauseCategory: string | null; actionPlan: string | null; completedAt: string | null;
  dispositions: string[]; costOfNc: string | null; verificationResult: string | null; returnReason: string | null; qaJustification: string | null;
  department: { name: string }; assignee: { id: string; name: string } | null;
  complaint: { number: string; type: string; source: string; process: string; customerName: string | null; supplierName: string | null; poDoNumber: string; quantity: string; quantityUnit: string; description: string; raisedAt: string; raisedBy: { name: string } } | null;
  actions: { id: string; description: string; ownerId: string; dueDate: string; done: boolean; owner: { name: string } }[];
  clocks: { kind: string; startedAt: string; dueAt: string }[];
  transitions: { toState: string; fromState: string | null; at: string; reason: string | null; actor: { name: string } }[];
};

/** The NCR in the paper form's order: issue, action, verification, history. */
export function NcrSummary({ n }: { n: NcrDetail }) {
  const t = useTranslations("ncr");
  const { data: lk } = useLookups(); const { label } = useLabel();
  const name = (list: string, code: string) => { const o = lk?.[list]?.find((x) => x.code === code); return o ? label(o) : code; };
  const clock = n.clocks.find((c) => c.kind === "RESOLUTION") ?? n.clocks[0];
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center gap-2"><StatusChip status={n.state} /><PriorityChip priority={n.priority} /><span className="text-sm text-grey-60">{n.department.name} · {n.assignee?.name}</span></div>
        {clock && <ClockBar dueAt={clock.dueAt} startedAt={clock.startedAt} />}
        {n.state === "RETURNED" && n.returnReason && <div className="rounded-xl bg-bad/5 border border-bad/30 p-3 text-sm"><div className="font-semibold">{t("returned")}</div>{n.returnReason}</div>}
      </div>
      {n.complaint && <div className="card space-y-1 text-sm">
        <h2 className="font-semibold text-base">{t("issue")} · <span className="font-mono text-grey-60">{n.complaint.number}</span></h2>
        <div className="text-grey-60">{n.complaint.raisedBy.name} · {name("type", n.complaint.type)} · {name("source", n.complaint.source)} · {name("process", n.complaint.process)}</div>
        {n.complaint.customerName && <div>{n.complaint.customerName}</div>}{n.complaint.supplierName && <div>{n.complaint.supplierName}</div>}
        <div>PO/DO {n.complaint.poDoNumber} · {n.complaint.quantity} {name("unit", n.complaint.quantityUnit)}</div>
        <p className="whitespace-pre-wrap text-base pt-2">{n.complaint.description}</p>
        {n.triageNotes && <p className="pt-2 border-t border-grey-20 text-grey-60">{n.triageNotes}</p>}
      </div>}
      {(n.rootCause || n.actionPlan || n.actions.length > 0) && <div className="card space-y-3 text-sm">
        <h2 className="font-semibold text-base">{t("action")}</h2>
        {n.containment && <div><div className="label">{t("containment")}</div><p className="whitespace-pre-wrap">{n.containment}</p></div>}
        {n.rootCause && <div><div className="label">{t("rootCause")}</div><p className="whitespace-pre-wrap">{n.rootCause}</p>{n.rootCauseCategory && <span className="text-grey-60">{name("rootCause", n.rootCauseCategory)}</span>}</div>}
        {n.actionPlan && <div><div className="label">{t("plan")}</div><p className="whitespace-pre-wrap">{n.actionPlan}</p></div>}
        {n.actions.length > 0 && <ul className="space-y-1">{n.actions.map((a) => <li key={a.id} className="flex gap-2"><span>{a.done ? "☑" : "☐"}</span><span className="flex-1">{a.description}</span><span className="text-grey-60">{a.owner.name} · {new Date(a.dueDate).toLocaleDateString()}</span></li>)}</ul>}
      </div>}
      {n.verificationResult && <div className="card space-y-2 text-sm">
        <h2 className="font-semibold text-base">{t("verification")}</h2>
        <div>{n.verificationResult}{n.dispositions.length > 0 && ` · ${n.dispositions.map((d) => name("disposition", d)).join(", ")}`}{n.costOfNc && ` · RM ${n.costOfNc}`}</div>
        {n.qaJustification && <p className="whitespace-pre-wrap">{n.qaJustification}</p>}
      </div>}
      <div className="card"><h2 className="font-semibold mb-3">{t("history")}</h2><Timeline rows={n.transitions} /></div>
    </div>
  );
}
