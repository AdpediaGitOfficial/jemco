"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { AdminShell } from "@/components/admin";

type Row = { id: string; tableName: string; rowId: string; field: string; oldValue: string | null; newValue: string | null; at: string; actor: { name: string } | null };
export default function ChangesAdmin() {
  const t = useTranslations("admin");
  const { data } = useQuery<Row[]>({ queryKey: ["admin", "changes"], queryFn: () => api("/admin/changes") });
  return (
    <AdminShell section="changes">
      <div className="card p-0 overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-surface text-left text-grey-60"><tr><th className="px-3 py-2">{t("when")}</th><th className="px-3 py-2">{t("who")}</th><th className="px-3 py-2">{t("what")}</th><th className="px-3 py-2">{t("field")}</th><th className="px-3 py-2">{t("from")}</th><th className="px-3 py-2">{t("to")}</th></tr></thead>
        <tbody>{data?.map((r) => <tr key={r.id} className="border-t border-grey-20"><td className="px-3 py-2 whitespace-nowrap text-grey-60">{new Date(r.at).toLocaleString()}</td><td className="px-3 py-2 whitespace-nowrap">{r.actor?.name ?? "system"}</td><td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{r.tableName} · {r.rowId.slice(0, 12)}</td><td className="px-3 py-2">{r.field}</td><td className="px-3 py-2 max-w-48 truncate text-grey-60">{r.oldValue ?? ""}</td><td className="px-3 py-2 max-w-48 truncate">{r.newValue ?? ""}</td></tr>)}</tbody>
      </table></div>
    </AdminShell>
  );
}
