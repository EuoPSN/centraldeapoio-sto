import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Painel (React) + service worker, em ES modules. O content script sai por
// vite.content.config.ts porque não pode importar outros arquivos em runtime.
export default defineConfig({
  root: resolve(__dirname, "src/panel"),
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "src/panel/index.html"),
        background: resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
