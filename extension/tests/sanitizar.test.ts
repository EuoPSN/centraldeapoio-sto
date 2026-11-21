import { describe, expect, it } from "vitest";
// Mesmo código do servidor: testamos a versão do app (a cópia da extensão é garantida igual).
import {
  montarTranscricao, primeiroNome, removerDadosPessoais, sanitizarMensagens, sanitizarTexto, ultimaFalaDoCliente,
} from "../../src/lib/extensao-sanitizar";
import * as ext from "../src/lib/sanitizar";

describe("telefone BR", () => {
  it.each([
    "31999991234",
    "5531999991234",
    "+5531999991234",
    "+55 31 99999-1234",
    "55 (31) 99999-1234",
    "(31) 99999-1234",
    "(31)99999-1234",
    "31 99999 1234",
    "31-99999-1234",
    "031 99999-1234",
    "3199991234", // sem 9
    "(31) 9999-1234",
    "55 31 9999-1234",
    "99999-1234", // sem DDD
    "9999-1234",
    "99999.1234",
  ])("remove %s", (tel) => {
    const out = removerDadosPessoais(`Pode me chamar no ${tel} depois`);
    expect(out).not.toMatch(/\d{4}/);
    expect(out).toMatch(/^Pode me chamar no \[(telefone|número|cpf)\] depois$/);
  });
  it("não mexe em preço, hora, data nem quantidade", () => {
    const t = "O plano Prata custa R$ 59,90 por mês, às 14:30 do dia 21/11/2026, para 3 pessoas. Valor 1.234,56";
    expect(removerDadosPessoais(t)).toBe(t);
  });
});

describe("CPF e CNPJ", () => {
  it("CPF com pontuação", () => expect(removerDadosPessoais("meu cpf 123.456.789-09 ok")).toBe("meu cpf [cpf] ok"));
  it("CPF sem pontuação", () => expect(removerDadosPessoais("cpf 12345678909 ok")).toMatch(/\[(cpf|telefone)\]/));
  it("CPF só com hífen final", () => expect(removerDadosPessoais("123456789-09")).not.toMatch(/\d{5}/));
  it("CNPJ formatado e simples", () => {
    expect(removerDadosPessoais("12.345.678/0001-95")).toBe("[cnpj]");
    expect(removerDadosPessoais("12345678000195")).toBe("[cnpj]");
  });
});

describe("e-mail, links e dígitos longos", () => {
  it("e-mail", () => expect(removerDadosPessoais("escreva para maria.silva+x@gmail.com já")).toBe("escreva para [e-mail] já"));
  it("e-mail com subdomínio", () => expect(removerDadosPessoais("a@b.co.uk")).toBe("[e-mail]"));
  it("links com identificadores", () => {
    expect(removerDadosPessoais("veja https://site.com.br/pedido?id=12345&u=ab")).toBe("veja [link]");
    expect(removerDadosPessoais("wa.me/5531999991234")).toBe("[link]");
    expect(removerDadosPessoais("www.exemplo.com/x")).toBe("[link]");
    expect(removerDadosPessoais("exemplo.com.br/promo")).toBe("[link]");
  });
  it("sequência longa de dígitos", () => {
    expect(removerDadosPessoais("protocolo 20261121987654")).toMatch(/\[(número|cnpj)\]/);
    expect(removerDadosPessoais("cartão 4111 1111 1111 1111")).not.toMatch(/\d{4}/);
  });
});

describe("nome do cliente", () => {
  it("troca nome completo e partes por [nome], sem acento e sem maiúsculas", () => {
    const out = sanitizarTexto("Oi, Marlene! A MARLENE Rodrigues falou com José. marlene? Marlenes", { nome: "Marlene Rodrigues de Souza" });
    expect(out).toBe("Oi, [nome]! A [nome] falou com José. [nome]? Marlenes");
  });
  it("ignora acentos ao casar", () => {
    expect(sanitizarTexto("falou com a Jose e com o José", { nome: "José" })).toBe("falou com a [nome] e com o [nome]");
  });
  it("não troca 'de', 'da' nem palavras parecidas", () => {
    expect(sanitizarTexto("a casa de Ana da Silva", { nome: "Ana da Silva" })).toBe("a casa de [nome] da [nome]");
    expect(sanitizarTexto("banana e Ana", { nome: "Ana" })).toBe("banana e [nome]");
  });
  it("primeiro nome para o ticket", () => {
    expect(primeiroNome("  marlene rodrigues ")).toBe("marlene");
    expect(primeiroNome("31999991234")).toBe("");
    expect(primeiroNome("")).toBe("");
  });
});

describe("mensagens", () => {
  it("sanitiza, limita a 60 e descarta vazias", () => {
    const msgs = Array.from({ length: 70 }, (_, i) => ({ de: i % 2 ? ("atendente" as const) : ("cliente" as const), texto: `msg ${i} ligue 31999991234`, hora: "14:3" + (i % 10) }));
    const out = sanitizarMensagens([...msgs, { de: "cliente", texto: "   ", hora: "" }], { nome: "x" });
    expect(out).toHaveLength(60);
    expect(JSON.stringify(out)).not.toMatch(/\d{5}/);
  });
  it("última fala do cliente ignora mídia e fala do atendente", () => {
    const out = sanitizarMensagens([
      { de: "cliente", texto: "Vou falar com meu marido" },
      { de: "atendente", texto: "Claro!" },
      { de: "cliente", texto: "[mídia]" },
    ]);
    expect(ultimaFalaDoCliente(out)).toBe("Vou falar com meu marido");
  });
  it("transcrição em texto corrido", () => {
    const t = montarTranscricao(sanitizarMensagens([{ de: "cliente", texto: "oi", hora: "9:05" }, { de: "atendente", texto: "olá" }]));
    expect(t).toBe("Cliente (9:05): oi\nAtendente: olá");
  });
});

describe("camada do navegador == camada do servidor", () => {
  it("mesmo resultado", () => {
    const t = "Joana, cpf 123.456.789-09, tel (31) 99999-1234, joana@x.com https://a.com/1";
    expect(ext.sanitizarTexto(t, { nome: "Joana" })).toBe(sanitizarTexto(t, { nome: "Joana" }));
  });
});
