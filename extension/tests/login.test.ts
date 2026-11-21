import { describe, expect, it } from "vitest";
import { mensagemDeLogin } from "../src/lib/supabase-mensagens";

describe("mensagemDeLogin", () => {
  it("traduz credenciais inválidas", () => {
    expect(mensagemDeLogin("Invalid login credentials")).toBe("E-mail ou senha incorretos.");
  });
  it("traduz falha de rede", () => {
    expect(mensagemDeLogin("Failed to fetch")).toMatch(/Sem conexão/);
  });
  it("usa mensagem genérica para o resto", () => {
    expect(mensagemDeLogin("xyz")).toMatch(/Tente de novo/);
  });
});
