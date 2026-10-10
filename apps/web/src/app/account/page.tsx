"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { AppShell } from "@/components/AppShell";
import { Field, PageTitle } from "@/components/ui";
import { setLocale } from "@/app/actions";

export default function AccountPage() {
  const t = useTranslations("account"); const locale = useLocale(); const router = useRouter(); const qc = useQueryClient();
  const { data: me } = useMe();
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const change = useMutation({ mutationFn: () => api("/auth/change-password", { method: "POST", json: { current: cur, next } }), onSuccess: () => { setMsg(t("saved")); setErr(""); setCur(""); setNext(""); qc.invalidateQueries({ queryKey: ["me"] }); setTimeout(() => router.replace("/todo"), 600); }, onError: (e) => setErr(e instanceof ApiError ? (e.fields.current ? t("wrong") : e.fields.next ? t("min12") : e.message) : String(e)) });
  const prefs = useMutation({ mutationFn: (p: { emailEnabled?: boolean; outOfOffice?: boolean; locale?: "en" | "ms" }) => api("/auth/me", { method: "PATCH", json: p }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); setMsg(t("saved")); setTimeout(() => setMsg(""), 1200); } });
  if (!me) return <AppShell><div /></AppShell>;
  return (
    <AppShell>
      <PageTitle right={msg ? <span className="text-ok text-sm mt-2">{msg}</span> : undefined}>{t("title")}</PageTitle>
      {me.mustChangePassword && <div className="card mb-4 border-warn/50 bg-warn/5">{t("mustChange")}</div>}
      <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
        <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); change.mutate(); }}>
          <h2 className="font-semibold">{t("password")}</h2>
          <Field label={t("current")}><input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
          <Field label={t("next")} error={err}><input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <button className="btn-primary" disabled={!cur || next.length < 12 || change.isPending}>{t("save")}</button>
        </form>
        <div className="card space-y-4 self-start">
          <label className="flex items-center gap-3 min-h-12"><input type="checkbox" className="h-5 w-5 accent-brand" checked={me.emailEnabled} onChange={(e) => prefs.mutate({ emailEnabled: e.target.checked })} />{t("email")}</label>
          <label className="flex items-center gap-3 min-h-12"><input type="checkbox" className="h-5 w-5 accent-brand" checked={me.outOfOffice} onChange={(e) => prefs.mutate({ outOfOffice: e.target.checked })} />{t("away")}</label>
          <Field label={t("language")}><select className="input" value={locale} onChange={async (e) => { const l = e.target.value as "en" | "ms"; await setLocale(l); prefs.mutate({ locale: l }); router.refresh(); }}><option value="en">English</option><option value="ms">Bahasa Malaysia</option></select></Field>
        </div>
      </div>
    </AppShell>
  );
}
