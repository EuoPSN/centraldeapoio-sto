import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// O content script só pode LER. Guarda estática contra ações no WhatsApp.
const arquivos = ["../src/content/ler.ts", "../src/content/whatsapp.ts", "../src/content/selectors.ts"];
const proibidos: [RegExp, string][] = [
  [/\.click\s*\(/, ".click("],
  [/\.scroll(To|By|IntoView)?\s*\(/, "scroll"],
  [/scrollTop\s*=/, "scrollTop ="],
  [/dispatchEvent/, "dispatchEvent"],
  [/execCommand/, "execCommand"],
  [/\.focus\s*\(/, ".focus("],
  [/\.(value|innerHTML|textContent|innerText)\s*=[^=]/, "escrita no DOM"],
  [/\.(appendChild|insertBefore|remove|append|prepend)\s*\(/, "alteração do DOM"],
  [/\beval\s*\(|new Function/, "eval"],
  [/\bfetch\s*\(|XMLHttpRequest|sendBeacon/, "rede"],
];

describe("content script só lê", () => {
  for (const arq of arquivos) {
    it(`${arq} não clica, rola, escreve, altera o DOM nem usa a rede`, () => {
      const codigo = readFileSync(resolve(__dirname, arq), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      for (const [re, nome] of proibidos) expect(codigo, nome).not.toMatch(re);
    });
  }
});

describe("o painel nunca escreve nem envia no WhatsApp", () => {
  it("o content script só aceita pedidos de leitura (identificar e ler)", () => {
    const codigo = readFileSync(resolve(__dirname, "../src/lib/mensagens.ts"), "utf8");
    const tipos = Array.from(codigo.matchAll(/tipo: "(omnia:[a-z]+)"/g)).map((m) => m[1]);
    expect(tipos.sort()).toEqual(["omnia:identificar", "omnia:ler"]);
  });
  it("copiar usa só a área de transferência do painel", () => {
    const codigo = readFileSync(resolve(__dirname, "../src/panel/ClienteDisse.tsx"), "utf8");
    expect(codigo).toMatch(/navigator\.clipboard\.writeText/);
    expect(codigo).not.toMatch(/tabs\.sendMessage|omnia:escrever|omnia:enviar/);
  });
});
