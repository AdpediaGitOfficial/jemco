"use client";
import { cloneElement, isValidElement, useId } from "react";
import { useTranslations } from "next-intl";
import type { Lookup } from "@/lib/api";
import { useLabel } from "@/lib/hooks";

/** Colour plus words, always. */
export function StatusChip({ status }: { status: string }) {
  const t = useTranslations("status");
  const tone: Record<string, string> = {
    CLOSED: "bg-grey-20 text-grey-60", REJECTED: "bg-grey-20 text-grey-60",
    RETURNED: "bg-bad/10 text-bad", NEED_MORE_INFO: "bg-warn/10 text-warn", AWAITING_VERIFICATION: "bg-warn/10 text-warn",
  };
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${tone[status] ?? "bg-ok/10 text-ok"}`}>{t.has(status) ? t(status) : status}</span>;
}

export function PriorityChip({ priority }: { priority: string }) {
  const t = useTranslations("priority");
  const tone: Record<string, string> = { URGENT: "bg-bad text-white", HIGH: "bg-warn text-white", MEDIUM: "bg-charcoal text-white", LOW: "bg-grey-20 text-charcoal" };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[priority] ?? ""}`}>{t.has(priority) ? t(priority) : priority}</span>;
}

/** The SLA as words and a bar; never a raw timestamp. */
export function ClockBar({ dueAt, startedAt }: { dueAt: string; startedAt?: string }) {
  const t = useTranslations("ncr");
  const due = new Date(dueAt).getTime(), now = Date.now();
  const start = startedAt ? new Date(startedAt).getTime() : due - 14 * 86400_000;
  const pct = Math.max(0, Math.min(1, (now - start) / Math.max(1, due - start)));
  const days = Math.round((due - now) / 86400_000);
  const colour = pct >= 1 ? "bg-bad" : pct >= 0.8 ? "bg-warn" : "bg-ok";
  return (
    <div>
      <div className="h-2 rounded-full bg-grey-20 overflow-hidden"><div className={`h-full ${colour}`} style={{ width: `${pct * 100}%` }} /></div>
      <div className={`text-sm mt-1 ${pct >= 1 ? "text-bad font-semibold" : "text-grey-60"}`}>{days >= 0 ? t("clock", { days }) : t("clockOver", { days: -days })}</div>
    </div>
  );
}

/** Big tappable cards instead of a dropdown. One help line each. */
export function ChoiceCards({ options, value, onChange, columns = 2 }: { options: Lookup[]; value?: string; onChange: (code: string) => void; columns?: 1 | 2 | 3 }) {
  const { label, help } = useLabel();
  const cols = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-1 sm:grid-cols-3" }[columns];
  return (
    <div className={`grid gap-3 ${cols}`} role="radiogroup">
      {options.map((o) => {
        const on = o.code === value;
        return (
          <button type="button" key={o.code} role="radio" aria-checked={on} onClick={() => onChange(o.code)}
            className={`text-left rounded-2xl border-2 p-4 min-h-14 transition-colors ${on ? "border-brand bg-brand/5" : "border-grey-20 bg-white hover:border-grey-60"}`}>
            <div className="font-semibold">{label(o)}</div>
            {help(o) && <div className="help mt-0.5">{help(o)}</div>}
          </button>
        );
      })}
    </div>
  );
}

/** Associates the label with a native control automatically (htmlFor/id), so screen readers and tests can find it. */
export function Field({ label, error, help, children }: { label: string; error?: string; help?: string; children: React.ReactNode }) {
  const generated = useId();
  const native = isValidElement(children) && typeof children.type === "string" && ["input", "select", "textarea"].includes(children.type);
  const id = native ? ((children as React.ReactElement<{ id?: string }>).props.id ?? generated) : undefined;
  const control = native ? cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children;
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {control}
      {help && !error && <div className="help mt-1">{help}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export function PageTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 mb-5"><h1 className="text-2xl md:text-[28px] font-bold text-charcoal">{children}</h1>{right}</div>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="card text-center text-grey-60 py-10">{children}</div>;
}
