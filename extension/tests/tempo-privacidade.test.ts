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

describe("aba Tempo de resposta", () => {
  const aba = readFileSync(resolve(__dirname, "../src/panel/Tempo.tsx"), "utf8");
  it("nome e prévia vêm só do armazenamento local; a aba não grava nada no servidor", () => {
    expect(aba).toMatch(/CHAVES_TEMPO\.espera/);
    expect(aba).not.toMatch(/\.(insert|upsert|update)\(/);
  });
  it("não tem pódio nem comparação com colegas", () => {
    expect(aba).not.toMatch(/ranking|pódio|podio|colega/i);
  });
  it("pausada: nenhuma chamada ao servidor", () => {
    expect(aba).toMatch(/if \(pausada\)[\s\S]{0,60}return/);
  });
});
