import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HORARIO_PADRAO, descreverHorario, fmtMinSeg, intervaloDoPeriodo, resumoEquipe, type LinhaExtensao } from "../../src/lib/extensao-admin";

const linha = (o: Partial<LinhaExtensao>): LinhaExtensao => ({
  user_id: "u", nome: "A", tickets_criados: 0, atualizados: 0, resposta_media: null, conversas_novas: 0, dentro_da_meta: 0, ignorados: 0, pausas: 0, instalou: true, primeiro_evento: null, ...o,
});

describe("Admin > Extensão do WhatsApp", () => {
  it("descreve o horário padrão", () => {
    expect(descreverHorario(HORARIO_PADRAO)).toBe("Seg a sex, 08:00–18:00 · sáb, 08:00–12:00");
    expect(descreverHorario({ "1": [] })).toBe("Sem horário de atendimento");
  });
  it("semana começa na segunda (Brasília); mês no dia 1", () => {
    const quarta = new Date("2026-11-18T15:00:00.000Z"); // quarta 12:00 BRT
    expect(intervaloDoPeriodo("semana", quarta).de).toBe("2026-11-16");
    expect(intervaloDoPeriodo("mes", quarta).de).toBe("2026-11-01");
    expect(intervaloDoPeriodo("semana", new Date("2026-11-22T15:00:00.000Z")).de).toBe("2026-11-16"); // domingo
    expect(intervaloDoPeriodo("semana", quarta).ini).toBe("2026-11-16T03:00:00.000Z");
  });
  it("média da equipe só considera quem tem resposta; ativos contam quem instalou", () => {
    const r = resumoEquipe([linha({ resposta_media: 2 }), linha({ resposta_media: 4 }), linha({ instalou: false }), linha({ resposta_media: null })]);
    expect(r).toEqual({ media_minutos: 3, ativos: 3, total: 4 });
  });
  it("formata minutos e segundos", () => {
    expect(fmtMinSeg(2 + 40 / 60)).toBe("2m 40s");
    expect(fmtMinSeg(null)).toBe("—");
  });
  it("a função SQL e o servidor do Admin não expõem conteúdo, nome nem telefone de cliente", () => {
    const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261204090100_extensao_admin.sql"), "utf8");
    const retorno = /RETURNS TABLE \(([\s\S]*?)\)\s*LANGUAGE/.exec(sql)![1];
    expect(retorno).not.toMatch(/telefone|valor_novo|valor_anterior|observacao|primeiro_nome|chat_key/i);
    expect(sql).toMatch(/private\.has_role\(auth\.uid\(\), 'admin'::app_role\)/);
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path = public/);
    const ts = readFileSync(resolve(__dirname, "../../src/lib/extensao-admin.functions.ts"), "utf8").replace(/\/\/.*$/gm, "");
    expect(ts).not.toMatch(/valor_novo|valor_anterior|telefone|primeiro_nome/);
  });
});
