import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = { title: "JEMCO NCR", description: "Complaint and non-conformance reporting", icons: { icon: "/icon.png" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <head><link rel="preconnect" href="https://rsms.me/" /><link rel="stylesheet" href="https://rsms.me/inter/inter.css" /></head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
