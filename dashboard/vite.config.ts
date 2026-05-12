import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env["VITE_API_URL"] ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
      "/auth": { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
  },
});
