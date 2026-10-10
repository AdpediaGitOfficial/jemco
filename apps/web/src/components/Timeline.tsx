"use client";
import { useTranslations } from "next-intl";

type Row = { toState: string; fromState: string | null; at: string; reason: string | null; actor: { name: string } };
/** The record's history as a readable story. */
export function Timeline({ rows }: { rows: Row[] }) {
  const t = useTranslations("status");
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="mt-1.5 h-2 w-2 rounded-full bg-grey-60 shrink-0" />
          <div>
            <div><span className="font-semibold">{r.actor.name}</span> → {t.has(r.toState) ? t(r.toState) : r.toState}</div>
            {r.reason && <div className="text-grey-60">{r.reason}</div>}
            <div className="text-xs text-muted">{new Date(r.at).toLocaleString()}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
