"use server";
import { cookies } from "next/headers";
export async function setLocale(locale: "en" | "ms") {
  (await cookies()).set("locale", locale, { path: "/", maxAge: 365 * 24 * 3600 });
}
