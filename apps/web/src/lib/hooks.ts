"use client";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { api, type Lookups, type Me, type Lookup } from "./api";

export function useMe() {
  return useQuery<Me>({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me"), retry: false, staleTime: 60_000 });
}
export function useLookups() {
  return useQuery<Lookups>({ queryKey: ["lookups"], queryFn: () => api<Lookups>("/lookups"), staleTime: 10 * 60_000 });
}
/** Pick the label/help in the current language. */
export function useLabel() {
  const locale = useLocale();
  return {
    label: (o: Lookup) => (locale === "ms" ? o.labelMs : o.labelEn),
    help: (o: Lookup) => (locale === "ms" ? o.helpMs : o.helpEn) ?? undefined,
  };
}
export const hasRole = (me: Me | undefined, ...roles: string[]) => !!me && roles.some((r) => me.roles.includes(r));
