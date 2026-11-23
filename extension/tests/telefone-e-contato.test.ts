import { describe, expect, it } from "vitest";
import { lerDadosDoContato } from "../src/content/contato";
import { montarDiagnostico } from "../src/content/diagnostico";
import { validarTelefoneDigitado } from "../src/lib/numeros";
import { INDIVIDUAL_ONLINE, msgNovo, pagina } from "./fixtures/whatsapp";

describe("1d · B · telefone digitado", () => {
  it("normaliza para dígitos (com ou sem 55, com ou sem 9)", () => {
    for (const [t, d] of [["(31) 99123-4567", "31991234567"], ["+55 31 99123-4567", "5531991234567"], ["31 3123-4567", "3131234567"], ["55 (31) 3123 4567", "553131234567"]]) {
      expect(validarTelefoneDigitado(t)).toEqual({ ok: true, digitos: d });
    }
  });
  it("vazio é permitido (sem número)", () => expect(validarTelefoneDigitado("  ")).toEqual({ ok: true, digitos: "" }));
  it("recusa letras, símbolos e tamanhos fora de 10–13 dígitos com mensagem curta", () => {
    for (const t of ["31 abc 99123", "31991234567x", "12345", "55319912345678"]) {
      const r = validarTelefoneDigitado(t);
      expect(r.ok, t).toBe(false);
      if (!r.ok) expect(r.erro.length).toBeLessThan(90);
    }
  });
});

const NOME = "Marlene R.";
const base = (aba: string) => {
  document.body.innerHTML = pagina({ nome: NOME, subtitulo: "online", mensagens: msgNovo({ quem: NOME, texto: "oi", ticks: false }, 1) + msgNovo({ quem: "Atendente", texto: "olá", ticks: true }, 2) })
    .replace('<div id="main">', `${aba}<div id="main">`);
};
const aba = (titulo: string, extra: string) =>
  `<aside aria-label="Dados do contato"><header><span dir="auto" title="${titulo}">${titulo}</span></header><div><span>${extra}</span></div></aside>`;

describe("1d · C · Dados do contato", () => {
  it("DOM sem aside/aria/testid (divs): acha pelo cabeçalho 'Dados do contato'", () => {
    base(`<div class="x"><div><div><span>Dados do contato</span></div></div><div><div>${NOME}</div><div>+55 31 9438-0020</div></div></div>`);
    const d = lerDadosDoContato(document);
    expect(d).toMatchObject({ aba_detectada: true, numero: "553194380020", seletor_que_decidiu: "cabecalho:Dados do contato" });
  });
  it("aba aberta com número: lê, e o diagnóstico traz só a forma mascarada", () => {
    base(aba(NOME, "+55 31 99123-4567"));
    const d = lerDadosDoContato(document);
    expect(d).toMatchObject({ aba_detectada: true, numero: "5531991234567", forma_mascarada: "+99 99 99999-9999", seletor_que_decidiu: 'aside[aria-label*="contato" i]' });
    const rel = montarDiagnostico(document, { versao: "0.1.0", dominio: "web.whatsapp.com" });
    expect(rel.dados_do_contato).toEqual({ aba_detectada: true, seletor_que_decidiu: 'aside[aria-label*="contato" i]', forma_mascarada_do_texto: "+99 99 99999-9999", numero_encontrado: true });
    const txt = JSON.stringify(rel);
    for (const p of ["99123", "5531991", "Marlene"]) expect(txt, p).not.toContain(p);
  });
  it("aba aberta sem número: detectada, sem número", () => {
    base(aba(NOME, "Recado: disponível"));
    expect(lerDadosDoContato(document)).toMatchObject({ aba_detectada: true, numero: "", forma_mascarada: "" });
  });
  it("título diferente do chat aberto: ignora", () => {
    base(aba("Outra Pessoa", "+55 31 99123-4567"));
    expect(lerDadosDoContato(document)).toMatchObject({ aba_detectada: false, numero: "" });
  });
  it("aba fechada: nada", () => {
    document.body.innerHTML = INDIVIDUAL_ONLINE;
    expect(lerDadosDoContato(document).aba_detectada).toBe(false);
  });
  it("não lê a aba em grupo nem sem conversa", () => {
    document.body.innerHTML = aba("Qualquer", "+55 31 99123-4567");
    expect(lerDadosDoContato(document).numero).toBe("");
  });
  it("número que não é telefone (data, id) não é aceito", () => {
    base(aba(NOME, "21/11/2026 14:32"));
    expect(lerDadosDoContato(document).numero).toBe("");
  });
});
