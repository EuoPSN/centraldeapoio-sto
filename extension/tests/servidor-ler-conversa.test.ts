import { describe, expect, it } from "vitest";
import { LerConversaEntrada, PropostaIA, tentarProposta } from "../../src/lib/extensao";

const base = {
  etapa_funil: "proposta_enviada", ponto_parada: "recebeu_proposta", plano: "prata", dependentes: 2,
  observacao: "Vai conversar com o marido hoje à noite.", quando_retomar: "4h", objecoes_detectadas: ["preciso consultar alguém"],
};
const conversa = "Cliente: Já paguei no cartão, pode fechar\nAtendente: Fechado!";

describe("validação da resposta da IA", () => {
  it("aceita uma proposta válida", () => {
    const p = tentarProposta(base, conversa, "Marlene");
    expect(p).toMatchObject({ etapa_funil: "proposta_enviada", ponto_parada: "recebeu_proposta", plano: "Prata", dependentes: 2, quando_retomar: "4h" });
  });
  it("rejeita etapa ou ponto de parada fora das listas", () => {
    expect(tentarProposta({ ...base, etapa_funil: "qualquer" }, conversa, "x")).toBeNull();
    expect(tentarProposta({ ...base, ponto_parada: "outro" }, conversa, "x")).toBeNull();
    expect(tentarProposta("lixo", conversa, "x")).toBeNull();
  });
  it("plano desconhecido e dependentes inválidos viram vazio", () => {
    const p = tentarProposta({ ...base, plano: "Bronze", dependentes: "muitos" }, conversa, "x");
    expect(p?.plano).toBe("");
    expect(p?.dependentes).toBeNull();
  });
  it("quando_retomar fora da cadência vira amanhã", () => {
    expect(tentarProposta({ ...base, quando_retomar: "daqui a 3 dias" }, conversa, "x")?.quando_retomar).toBe("amanha");
  });
  it("observação: sem dado pessoal, sem nome, até 200 caracteres", () => {
    const p = tentarProposta({ ...base, observacao: `Marlene pediu retorno no (31) 99999-1234 ou maria@x.com. ${"muito texto ".repeat(40)}` }, conversa, "Marlene");
    expect(p!.observacao.length).toBeLessThanOrEqual(200);
    expect(p!.observacao).not.toMatch(/Marlene|99999|@/);
  });
  it('nunca escreve "não é plano de saúde"', () => {
    const p = tentarProposta({ ...base, observacao: "Explicar que não é plano de saúde e sim cartão." }, conversa, "x");
    expect(p!.observacao.toLowerCase()).not.toContain("plano de saúde");
  });
  it("limita objeções a 5 itens curtos", () => {
    const p = tentarProposta({ ...base, objecoes_detectadas: Array.from({ length: 9 }, (_, i) => `obj ${i}`) }, conversa, "x");
    expect(p!.objecoes_detectadas).toHaveLength(5);
  });
});

describe("Venda concluída só com confirmação explícita", () => {
  it("sem confirmação: rebaixa para fechamento", () => {
    expect(tentarProposta({ ...base, etapa_funil: "venda_concluida" }, conversa, "x")?.etapa_funil).toBe("fechamento");
  });
  it("marcada como explícita mas sem a frase na conversa: rebaixa", () => {
    expect(tentarProposta({ ...base, etapa_funil: "venda_concluida", venda_explicita: true, evidencia_venda: "frase inventada pela ia" }, conversa, "x")?.etapa_funil).toBe("fechamento");
  });
  it("explícita com a frase presente na conversa: mantém", () => {
    expect(tentarProposta({ ...base, etapa_funil: "venda_concluida", venda_explicita: true, evidencia_venda: "Já paguei no cartão" }, conversa, "x")?.etapa_funil).toBe("venda_concluida");
  });
});

describe("entrada da função (só texto sanitizado)", () => {
  it("aceita mensagens com direção e horário", () => {
    expect(LerConversaEntrada.safeParse({ mensagens: [{ de: "cliente", texto: "oi", hora: "14:30" }] }).success).toBe(true);
  });
  it("rejeita conversa vazia, direção inválida e excesso de mensagens", () => {
    expect(LerConversaEntrada.safeParse({ mensagens: [] }).success).toBe(false);
    expect(LerConversaEntrada.safeParse({ mensagens: [{ de: "outro", texto: "x" }] }).success).toBe(false);
    expect(LerConversaEntrada.safeParse({ mensagens: Array.from({ length: 200 }, () => ({ de: "cliente", texto: "x" })) }).success).toBe(false);
  });
  it("PropostaIA exporta o esquema usado na validação", () => {
    expect(PropostaIA.safeParse(base).success).toBe(true);
  });
});
