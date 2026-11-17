import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

const demoModule = (file: string) => fileURLToPath(new URL(`./src/demo/${file}`, import.meta.url));

export default defineConfig(async ({ mode }) => ({
  plugins: [react(), tailwindcss()],

  // `--mode demo`: build web estático (GitHub Pages). Os plugins do Tauri viram
  // substitutos de navegador (SQLite em WebAssembly, links em nova aba).
  ...(mode === "demo" && {
    base: "./",
    build: { outDir: "dist-demo" },
    resolve: {
      alias: {
        "@tauri-apps/plugin-sql": demoModule("plugin-sql.ts"),
        "@tauri-apps/plugin-opener": demoModule("plugin-opener.ts"),
      },
    },
  }),

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
