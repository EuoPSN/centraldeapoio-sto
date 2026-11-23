import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lerListaDeConversas } from "../src/content/lista";
import { item, lista, LISTA_EXEMPLO } from "./fixtures/lista";

function ler(html: string) {
  document.body.innerHTML = html;
  return lerListaDeConversas(document);
}

describe("varredura da lista de conversas", () => {
  it("lê nome, prévia, horário, não lida e direção; ignora grupo", () => {
    const r = ler(LISTA_EXEMPLO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ignorados).toBe(1);
    expect(r.itens.map((i) => i.nome)).toEqual(["Marlene R.", "Cliente 2", "Cliente 3", "Cliente 5"]);
    expect(r.itens[0]).toMatchObject({ hora: "14:32", naoLida: true, direcao: "cliente", previa: "Vou conversar com meu marido" });
    expect(r.itens[2]).toMatchObject({ direcao: "atendente", naoLida: false });
    expect(r.itens[3]).toMatchObject({ hora: null, horaTexto: "ontem" });
  });
  it("ignora comunidade, lista de transmissão, canal e Status", () => {
    const r = ler(lista([
      item({ nome: "A", previa: "x", hora: "10:00", icone: "community" }),
      item({ nome: "B", previa: "x", hora: "10:00", icone: "broadcast" }),
      item({ nome: "C", previa: "x", hora: "10:00", icone: "newsletter" }),
      item({ nome: "D", previa: "x", hora: "10:00", icone: "status-ring" }),
      item({ nome: "E", previa: "oi", hora: "10:00" }),
    ]));
    expect(r.ok && r.itens.map((i) => i.nome)).toEqual(["E"]);
    expect(r.ok && r.ignorados).toBe(4);
  });
  it('prévia de grupo ("Nome: texto" ou "Você: texto") é ignorada, na dúvida', () => {
    const r = ler(lista([
      item({ nome: "Turma", previa: "Ana: oi gente", hora: "10:00" }),
      item({ nome: "Turma 2", previa: "Você: certo", hora: "10:00", enviada: true }),
    ]));
    expect(r.ok && r.itens).toEqual([]);
    expect(r.ok && r.ignorados).toBe(2);
  });
  it('"digitando…" não é mensagem: não entra', () => {
    const r = ler(lista([item({ nome: "A", previa: "digitando…", hora: "10:00" })]));
    expect(r.ok && r.itens).toEqual([]);
  });
  it("falha segura: sem a lista não lê nada", () => {
    expect(ler(`<div id="app"><div id="main">oi</div></div>`)).toMatchObject({ ok: false, codigo: "sem_lista" });
    expect(ler(`<div id="pane-side"></div>`)).toMatchObject({ ok: false, codigo: "sem_itens" });
  });
  it("fallback de seletor: lista por data-testid", () => {
    const r = ler(`<div data-testid="chat-list">${item({ nome: "Ana", previa: "oi", hora: "09:05" })}</div>`);
    expect(r.ok && r.itens[0]).toMatchObject({ nome: "Ana", hora: "09:05" });
  });
});

describe("a varredura não abre conversa, não rola e não clica", () => {
  it("lista.ts não tem ação no DOM", () => {
    const codigo = readFileSync(resolve(__dirname, "../src/content/lista.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/\.click\s*\(|\.scroll|scrollTop|dispatchEvent|\.focus\s*\(|\bfetch\s*\(/);
  });
});
