import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/v1": "http://127.0.0.1:8787", "/hooks": "http://127.0.0.1:8787" },
  },
  build: { outDir: `${root}/dist`, emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
