import { describe, expect, it } from "vitest";
import { chaveNumero, hashContato, mesmoNumero, numeroMascarado, pareceTelefone } from "../src/lib/numeros";

describe("números", () => {
  it("mesma chave com e sem 55, com e sem 9, com formatação", () => {
    const formas = ["+55 31 99999-1234", "5531999991234", "(31) 99999-1234", "31 9999-1234", "553199991234", "3199991234"];
    const chaves = new Set(formas.map(chaveNumero));
    expect(chaves.size).toBe(1);
  });
  it("DDD diferente é outro número", () => {
    expect(mesmoNumero("31999991234", "11999991234")).toBe(false);
  });
  it("sem DDD compara só os 8 últimos", () => {
    expect(mesmoNumero("99999-1234", "(31) 99999-1234")).toBe(true);
  });
  it("detecta nome que é telefone", () => {
    expect(pareceTelefone("+55 31 99123-4567")).toBe(true);
    expect(pareceTelefone("Marlene R.")).toBe(false);
    expect(pareceTelefone("123")).toBe(false);
  });
  it("hash não contém o número e muda por usuário", async () => {
    const a = await hashContato("u1", "n:3199991234");
    const b = await hashContato("u2", "n:3199991234");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("3199991234");
  });
  it("máscara esconde o meio", () => {
    expect(numeroMascarado("5531991234567")).toBe("+55 31 ···· ··67");
  });
});
