import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { diaBR, grupoDoTicket, resumirHoje, rotuloPrazo, type TicketHoje } from "../src/lib/hoje";

// 21/11/2026 15:00 em Brasília = 18:00 UTC
const agora = new Date("2026-11-21T18:00:00.000Z");
const t = (o: Partial<TicketHoje>): TicketHoje => ({
  id: Math.random().toString(), primeiro_nome: "Ana", status: "fila", etapa_atual: "d1", proxima_em: "2026-11-21T12:00:00.000Z",
  etapa_funil: null, ponto_parada: "parou_explicativa", plano: null, updated_at: "2026-11-10T12:00:00.000Z", ...o,
});

describe("aba Hoje", () => {
  it("dia no fuso de Brasília", () => {
    expect(diaBR("2026-11-22T01:30:00.000Z")).toBe("2026-11-21");
  });
  it("classifica atrasado, de hoje e follow-up; ignora futuro e fora da fila", () => {
    expect(grupoDoTicket(t({ proxima_em: "2026-11-19T12:00:00.000Z" }), agora)).toBe("atrasado");
    expect(grupoDoTicket(t({}), agora)).toBe("hoje");
    expect(grupoDoTicket(t({ etapa_atual: "follow_up", proxima_em: "2026-11-21T22:00:00.000Z" }), agora)).toBe("followup");
    expect(grupoDoTicket(t({ proxima_em: "2026-11-22T12:00:00.000Z" }), agora)).toBeNull();
    expect(grupoDoTicket(t({ status: "fechou" }), agora)).toBeNull();
    expect(grupoDoTicket(t({ proxima_em: null }), agora)).toBeNull();
  });
  it("rótulos do prazo", () => {
    expect(rotuloPrazo({ etapa_atual: "follow_up", proxima_em: "2026-11-21T22:00:00.000Z" }, agora)).toBe("Hoje 19:00");
    expect(rotuloPrazo({ etapa_atual: "follow_up", proxima_em: "2026-11-21T17:00:00.000Z" }, agora)).toBe("Agora");
    expect(rotuloPrazo({ etapa_atual: "d1", proxima_em: "2026-11-21T12:00:00.000Z" }, agora)).toBe("D+1");
    expect(rotuloPrazo({ etapa_atual: "d2", proxima_em: "2026-11-19T12:00:00.000Z" }, agora)).toBe("Atrasado · D+2");
  });
  it("contadores: para hoje e atualizados hoje; atrasados vêm primeiro", () => {
    const r = resumirHoje([
      t({ id: "a", proxima_em: "2026-11-21T12:00:00.000Z" }),
      t({ id: "b", proxima_em: "2026-11-18T12:00:00.000Z" }),
      t({ id: "c", status: "fechou", updated_at: "2026-11-21T14:00:00.000Z" }),
      t({ id: "d", proxima_em: "2026-11-25T12:00:00.000Z", updated_at: "2026-11-21T10:00:00.000Z" }),
    ], agora);
    expect(r.paraHoje.map((x) => x.id)).toEqual(["b", "a"]);
    expect(r.atualizadosHoje).toBe(2);
  });
  it("a lista nunca pede o número do cliente", () => {
    const codigo = readFileSync(resolve(__dirname, "../src/panel/Hoje.tsx"), "utf8");
    expect(codigo).not.toMatch(/telefone|numero/i);
  });
});
