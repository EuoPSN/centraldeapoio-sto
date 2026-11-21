// Gera docs/fase-c/politica-privacidade-extensao.md a partir do texto da página pública
// (src/lib/privacidade-extensao.ts), para as duas versões terem sempre o mesmo conteúdo.
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIVACIDADE_ATUALIZADA, PRIVACIDADE_INTRO, PRIVACIDADE_SECOES } from "../../src/lib/privacidade-extensao.ts";

export function politicaEmMarkdown(contato = "[e-mail de contato]"): string {
  const linhas = [
    "# Política de privacidade — Extensão OMNIA Apoio para WhatsApp Web", "",
    `Última atualização: ${PRIVACIDADE_ATUALIZADA}`, "", PRIVACIDADE_INTRO, "",
  ];
  for (const s of PRIVACIDADE_SECOES) {
    linhas.push(`## ${s.titulo}`);
    for (const p of s.paragrafos ?? []) linhas.push(p.replace("{contato}", contato), "");
    if (s.itens) linhas.push(...s.itens.map((i) => `- ${i}`), "");
    if (!s.paragrafos) continue;
  }
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  writeFileSync(resolve(raiz, "docs/fase-c/politica-privacidade-extensao.md"), politicaEmMarkdown());
  console.log("política gerada");
}
