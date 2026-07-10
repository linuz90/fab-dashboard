import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { proxyHostForDevHost } from "./scripts/devPorts";

const apiPort = process.env.FAB_DASHBOARD_PORT ?? process.env.PORT ?? "7893";
const apiHost = process.env.FAB_DASHBOARD_HOST?.trim() || "127.0.0.1";
const apiTarget = `http://${proxyHostForDevHost(apiHost)}:${apiPort}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5193,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/healthz": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
