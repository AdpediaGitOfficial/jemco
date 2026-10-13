"use client";
import { cloneElement, isValidElement, useId } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useTranslations } from "next-intl";
import type { Lookup } from "@/lib/api";
import { useLabel } from "@/lib/hooks";

const TONE = { success: "bg-ok-bg text-ok", warning: "bg-warn-bg text-warn", danger: "bg-bad-bg text-bad", info: "bg-info-bg text-info", neutral: "bg-[#eff0f3] text-grey-60" } as const;

/** Colour plus words, always: a tinted pill with a dot and the status name. */
export function StatusChip({ status }: { status: string }) {
  const t = useTranslations("status");
  const tone: Record<string, keyof typeof TONE> = {
    CLOSED: "success", ACCEPTED: "success", REJECTED: "neutral",
    RETURNED: "danger", NEED_MORE_INFO: "danger",
    SUBMITTED: "warning", AWAITING_VERIFICATION: "warning",
    ASSIGNED: "info", IN_PROGRESS: "info",
  };
  return <span className={`badge ${TONE[tone[status] ?? "neutral"]}`}>{t.has(status) ? t(status) : status}</span>;
}

export function PriorityChip({ priority }: { priority: string }) {
  const t = useTranslations("priority");
  const tone: Record<string, keyof typeof TONE> = { URGENT: "danger", HIGH: "warning", MEDIUM: "info", LOW: "neutral" };
  return <span className={`badge ${TONE[tone[priority] ?? "neutral"]}`}>{t.has(priority) ? t(priority) : priority}</span>;
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

/** Big tappable cards instead of a dropdown. One help line each. With `icons` each card gets a round icon and a chevron (the one-question-per-screen look). */
export function ChoiceCards({ options, value, onChange, columns = 2, icons }: { options: Lookup[]; value?: string; onChange: (code: string) => void; columns?: 1 | 2 | 3; icons?: Record<string, IconName> }) {
  const { label, help } = useLabel();
  const cols = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-1 sm:grid-cols-3" }[columns];
  return (
    <div className={`grid gap-3.5 ${cols}`} role="radiogroup">
      {options.map((o) => {
        const on = o.code === value;
        const icon = icons?.[o.code];
        return (
          <button type="button" key={o.code} role="radio" aria-checked={on} onClick={() => onChange(o.code)}
            className={`flex items-center gap-4 text-left rounded-[17px] border-[1.5px] px-4 transition-[border-color,background-color,box-shadow] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/30 ${icon ? "min-h-[98px] py-4 sm:min-h-[112px] sm:px-5" : "min-h-14 py-3.5"} ${on ? "border-brand bg-brand-50 shadow-[0_0_0_3px_rgba(229,36,42,.08)]" : "border-grey-20 bg-white hover:border-brand-200"}`}>
            {icon && <span className="grid size-11 sm:size-14 shrink-0 place-items-center rounded-full bg-brand-50 text-brand"><Icon name={icon} className="size-6 sm:size-7" /></span>}
            <span className="min-w-0 flex-1">
              <span className="block text-base sm:text-lg font-bold leading-snug">{label(o)}</span>
              {help(o) && <span className="help mt-1 block">{help(o)}</span>}
            </span>
            {icon && <Icon name="chevron" className="size-5 shrink-0 text-muted" />}
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
  return <div className="mb-6 flex items-start justify-between gap-4"><h1 className="text-[clamp(30px,4vw,43px)] leading-[1.08] tracking-[-0.04em] font-extrabold text-ink">{children}</h1>{right}</div>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="card text-center text-grey-60 py-10">{children}</div>;
}
