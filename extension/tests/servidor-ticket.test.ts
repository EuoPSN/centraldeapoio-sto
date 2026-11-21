import { describe, expect, it } from "vitest";
import { SalvarTicketEntrada, TicketEntrada, acharTicketDoNumero, calcularMudancas } from "../../src/lib/extensao";

const atual = {
  etapa_funil: "lead_qualificado" as const, ponto_parada: "nao_respondeu_primeira" as const, plano: "Prata", dependentes: 2,
  observacao: "Perguntou o preço.", proxima_em: "2026-11-19T12:00:00.000Z",
};
const igual = { etapa_funil: "lead_qualificado", ponto_parada: "nao_respondeu_primeira", plano: "Prata", dependentes: 2, observacao: "Perguntou o preço." };

describe("o que mudou no ticket (de → para, um por campo)", () => {
  it("só o que mudou entra", () => {
    const m = calcularMudancas(atual, { ...igual, etapa_funil: "proposta_enviada", ponto_parada: "recebeu_proposta" }, "2026-11-21T22:00:00.000Z");
    expect(m.map((x) => x.campo)).toEqual(["etapa_funil", "ponto_parada", "retomar"]);
    expect(m[0]).toEqual({ campo: "etapa_funil", de: "lead_qualificado", para: "proposta_enviada" });
  });
  it("nada mudou: só o novo prazo de retomada", () => {
    expect(calcularMudancas(atual, igual, "2026-11-22T12:00:00.000Z").map((x) => x.campo)).toEqual(["retomar"]);
  });
  it("campos vazios equivalem a nulo (plano '' == sem plano)", () => {
    const m = calcularMudancas({ ...atual, plano: null, dependentes: null }, { ...igual, plano: "", dependentes: null }, null);
    expect(m).toEqual([]);
  });
  it("observação nova aparece como mudança", () => {
    const m = calcularMudancas(atual, { ...igual, observacao: "Vai falar com o marido." }, null);
    expect(m).toEqual([{ campo: "observacao", de: "Perguntou o preço.", para: "Vai falar com o marido." }]);
  });
});

describe("número que já tem ticket do mesmo atendente atualiza (sem duplicar)", () => {
  const tickets = [{ id: "a", telefone: "5531999991234" }, { id: "b", telefone: "11988887777" }, { id: "c", telefone: null }];
  it.each(["+55 31 99999-1234", "(31) 99999-1234", "31 9999-1234", "3199991234", "553199991234"])("acha por %s", (n) => {
    expect(acharTicketDoNumero(tickets, n)?.id).toBe("a");
  });
  it("outro DDD não casa", () => expect(acharTicketDoNumero(tickets, "21999991234")).toBeNull());
  it("número curto ou vazio não casa com nada", () => {
    expect(acharTicketDoNumero(tickets, "")).toBeNull();
    expect(acharTicketDoNumero(tickets, "1234")).toBeNull();
  });
  it("ticket sem telefone nunca casa", () => expect(acharTicketDoNumero([{ telefone: null }], "31999991234")).toBeNull());
});

describe("entrada de salvar", () => {
  const ok = { op: "salvar", numero: "5531999991234", nome: "Marlene R.", campos: { etapa_funil: "proposta_enviada", ponto_parada: "recebeu_proposta", plano: "Prata", dependentes: "2", observacao: "Ligue (31) 99999-1234", quando: "4h" } };
  it("normaliza campos e tira dado pessoal da observação", () => {
    const r = SalvarTicketEntrada.parse(ok);
    expect(r.campos.dependentes).toBe(2);
    expect(r.campos.plano).toBe("Prata");
    expect(r.campos.observacao).not.toMatch(/99999/);
  });
  it("rejeita etapa, ponto ou prazo fora das listas", () => {
    expect(TicketEntrada.safeParse({ ...ok, campos: { ...ok.campos, etapa_funil: "x" } }).success).toBe(false);
    expect(TicketEntrada.safeParse({ ...ok, campos: { ...ok.campos, ponto_parada: "x" } }).success).toBe(false);
    expect(TicketEntrada.safeParse({ ...ok, campos: { ...ok.campos, quando: "semana que vem" } }).success).toBe(false);
  });
  it("consultar só precisa do número", () => {
    expect(TicketEntrada.safeParse({ op: "consultar", numero: "31999991234" }).success).toBe(true);
  });
});
