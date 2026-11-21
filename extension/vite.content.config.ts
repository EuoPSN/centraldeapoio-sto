import { defineConfig } from "vite";
import { resolve } from "node:path";

// Content script: um único arquivo (IIFE), sem chunks.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: false,
    target: "es2022",
    lib: { entry: resolve(__dirname, "src/content/whatsapp.ts"), formats: ["iife"], name: "OmniaWhatsapp", fileName: () => "content.js" },
  },
});
