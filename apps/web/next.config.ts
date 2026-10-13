import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@jemco/shared"],
  reactStrictMode: true,
  // The Docker image sets NEXT_OUTPUT=standalone; a plain `next start` (pm2, systemd) does not want it.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
};

export default withNextIntl(nextConfig);
