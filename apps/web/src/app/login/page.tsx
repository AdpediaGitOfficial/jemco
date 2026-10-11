"use client";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Field } from "@/components/ui";

function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await api("/auth/login", { method: "POST", json: { email, password } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      router.replace(params.get("next") || "/todo");
    } catch { setErr(t("failed")); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
      <Image src="/jemco-logo.webp" alt="JEMCO" width={160} height={50} className="mx-auto" priority />
      <h1 className="text-xl font-bold text-center text-charcoal">{t("title")}</h1>
      <Field label={t("email")}><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label={t("password")} error={err}><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
      <button className="btn-primary w-full" disabled={busy}>{t("button")}</button>
    </form>
  );
}
export default function LoginPage() {
  return <div className="min-h-dvh flex items-center justify-center p-4"><Suspense><LoginForm /></Suspense></div>;
}
