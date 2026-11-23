import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PODIOS, PODIOS_QUALIDADE, PODIO_COMO, PODIO_TITULO } from "../../src/lib/ranking";
import { compararAntesDepois, JANELA_DIAS } from "../../src/lib/extensao-antes-depois";

const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261204090300_ranking_fechamentos.sql"), "utf8");

describe('pódio "Mais fechamentos"', () => {
  it("é o sexto pódio, com título e texto de \"Como é calculado\"", () => {
    expect(PODIOS).toHaveLength(6);
    expect(PODIOS[5]).toBe("fechamentos");
    expect(PODIOS_QUALIDADE).toContain("fechamentos");
    expect(PODIO_TITULO.fechamentos).toBe("Mais fechamentos");
    expect(PODIO_COMO.fechamentos).toMatch(/CRM/);
    expect(PODIO_COMO.fechamentos).toMatch(/Não tem mínimo/);
  });
  it("o cálculo soma as vendas do mês em crm_fechamentos, sem mínimo de retomadas, e respeita ligar/desligar e ocultos", () => {
    expect(sql).toMatch(/FROM public\.crm_fechamentos f\s+WHERE f\.periodo_ini >= v_mes AND f\.periodo_ini < \(v_mes \+ interval '1 month'\)::date/);
    expect(sql).toMatch(/SELECT 'fechamentos', a\.uid, a\.nm, COALESCE\(f\.n, 0\)::numeric, COALESCE\(f\.n, 0\), \(COALESCE\(f\.n, 0\) > 0\)/);
    expect(sql).not.toMatch(/'fechamentos'[^;]*v_min/);
    expect(sql).toMatch(/WHERE v_f/);
    expect(sql).toMatch(/podio_fechamentos BOOLEAN NOT NULL DEFAULT true/);
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.ranking_ocultos o/); // vem do CTE "at"
    expect(sql).toMatch(/ranking_hall_podio_check[\s\S]*'fechamentos'/);
  });
  it("o ranking do atendente continua sem posição fora do top 3 (função ranking_podios não muda)", () => {
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.ranking_podios/);
    const rk = readFileSync(resolve(__dirname, "../../supabase/migrations/20261201090200_ranking.sql"), "utf8");
    expect(rk).toMatch(/'meu', \(SELECT jsonb_build_object\('valor', c\.valor, 'total', c\.total, 'qualifica', c\.qualifica, 'no_podio'/);
  });
});

describe("antes e depois (60 dias)", () => {
  const hoje = "2026-11-23";
  const vendasPorDia: Record<string, number> = {};
  const marca = (ini: string, n: number, porDia: number) => { for (let i = 0; i < n; i++) vendasPorDia[new Date(Date.parse(`${ini}T12:00:00Z`) + i * 86400_000).toISOString().slice(0, 10)] = porDia; };

  it("com 60 dias de cada lado compara as vendas por semana", () => {
    const v: Record<string, number> = {};
    for (let i = 0; i < 60; i++) { v[new Date(Date.parse("2026-01-01T12:00:00Z") + i * 86400_000).toISOString().slice(0, 10)] = 1; } // antes: 60 vendas em 60 dias
    for (let i = 0; i < 60; i++) { v[new Date(Date.parse("2026-03-02T12:00:00Z") + i * 86400_000).toISOString().slice(0, 10)] = 2; } // depois: 120
    const r = compararAntesDepois({ inicio: "2026-03-02", hoje, vendasPorDia: v, cobertura: { min: "2026-01-01", max: "2026-11-01" } });
    expect(r.antes).toMatchObject({ ini: "2026-01-01", fim: "2026-03-01", diasComDados: 60, vendas: 60 });
    expect(r.depois).toMatchObject({ ini: "2026-03-02", fim: "2026-04-30", diasComDados: 60, vendas: 120 });
    expect(r.faltamAntes).toBe(0);
    expect(r.faltamDepois).toBe(0);
    expect(r.variacaoPct).toBe(100);
  });
  it("sem 60 dias de dados mostra o que há e quantos dias faltam", () => {
    marca("2026-10-01", 20, 1);
    const r = compararAntesDepois({ inicio: "2026-10-15", hoje, vendasPorDia, cobertura: { min: "2026-10-01", max: "2026-11-20" } });
    expect(r.antes.diasComDados).toBe(14); // 01/10 a 14/10
    expect(r.faltamAntes).toBe(JANELA_DIAS - 14);
    expect(r.depois.fim).toBe(hoje); // o depois ainda não completou 60 dias
    expect(r.faltamDepois).toBeGreaterThan(0);
  });
  it("sem nenhuma planilha: sem números e sem divisão por zero", () => {
    const r = compararAntesDepois({ inicio: "2026-10-15", hoje, vendasPorDia: {}, cobertura: { min: null, max: null } });
    expect(r.antes.porSemana).toBeNull();
    expect(r.variacaoPct).toBeNull();
    expect(r.faltamAntes).toBe(60);
  });
  it("só o admin lê: a tabela de datas de início tem políticas só de admin", () => {
    expect(sql).not.toMatch(/extensao_inicio[\s\S]{0,200}TO authenticated USING \(true\)/);
    expect(sql).toMatch(/extensao_inicio_read_admin/);
  });
});
