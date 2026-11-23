import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("tempo de resposta: nada de cliente sobe ao servidor", () => {
  const codigo = readFileSync(resolve(__dirname, "../src/lib/tempo-servico.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  it("os envios ao backend têm só chave em hash, horários, minutos, meta e dia", () => {
    const envios = Array.from(codigo.matchAll(/upsert\(([\s\S]*?),\s*\{ onConflict/g)).map((m) => m[1]);
    expect(envios.length).toBeGreaterThan(0);
    for (const e of envios) expect(e).not.toMatch(/nome|previa|telefone|numero|texto/i);
  });
});
