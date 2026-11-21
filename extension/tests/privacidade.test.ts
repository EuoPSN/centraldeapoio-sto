import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRIVACIDADE_CONTATO, PRIVACIDADE_SECOES } from "../../src/lib/privacidade-extensao";
import { politicaEmMarkdown } from "../scripts/gerar-politica";

describe("política de privacidade", () => {
  it("o .md em docs/fase-c tem o mesmo conteúdo da página pública", () => {
    const md = readFileSync(resolve(__dirname, "../../docs/fase-c/politica-privacidade-extensao.md"), "utf8");
    expect(md).toBe(politicaEmMarkdown());
  });
  it("tem todas as seções exigidas", () => {
    const titulos = PRIVACIDADE_SECOES.map((s) => s.titulo.toLowerCase()).join("|");
    for (const t of ["o que a extensão lê", "nunca faz", "enviado", "guardado", "quem acessa", "controle", "contato"]) expect(titulos).toContain(t);
  });
  it("o contato vem de uma constante única", () => {
    expect(PRIVACIDADE_CONTATO.length).toBeGreaterThan(3);
  });
  it('nunca diz "não é plano de saúde"', () => {
    expect(JSON.stringify(PRIVACIDADE_SECOES).toLowerCase()).not.toContain("não é plano de saúde");
  });
});
