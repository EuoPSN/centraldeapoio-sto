import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  // "@" aponta para o app da Omnia: os testes do servidor (src/lib/extensao*.ts) rodam aqui também.
  resolve: { alias: { "@": resolve(__dirname, "../src") } },
  server: { fs: { allow: [resolve(__dirname, "..")] } },
  test: { environment: "jsdom", include: ["tests/**/*.test.ts"] },
});
