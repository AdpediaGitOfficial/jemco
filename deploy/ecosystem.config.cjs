// pm2 process file for a server without Docker. Run from the repository root: pm2 start deploy/ecosystem.config.cjs
// Ports: API_PORT in apps/api/.env (default 4000); the web port is PORT below. Build first (see deploy/README.md).
module.exports = {
  apps: [
    {
      name: "jemco-api",
      cwd: "apps/api",
      script: "pnpm",
      args: "start:prod", // prisma migrate deploy, then node dist/main.js
      env: { NODE_ENV: "production" },
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "jemco-web",
      cwd: "apps/web",
      script: "pnpm",
      args: "start",
      env: { NODE_ENV: "production", PORT: process.env.WEB_PORT || 3000, HOSTNAME: "0.0.0.0" },
    },
  ],
};
