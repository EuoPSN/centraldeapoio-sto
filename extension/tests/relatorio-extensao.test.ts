import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { montarAbasInteligencia, montarRelatorioInteligenciaXlsx, type DadosInteligencia } from "../../src/lib/inteligencia-relatorio";

const base: DadosInteligencia = {
  de: "2026-11-01", ate: "2026-11-23", escopo: "equipe", exportadoPor: "Admin", exportadoEm: "2026-11-23T15:00:00.000Z",
  atendentes: { u1: "Rogério", u2: "Carla" }, raiox: [], uso: [], funil: [], blocosCerebro: [],
  extensao: [
    { semana: "2026-11-16", user_id: "u2", tickets_criados: 5, atualizados: 2, ignorados: 1, pausas: 0 },
    { semana: "2026-11-16", user_id: "u1", tickets_criados: 8, atualizados: 3, ignorados: 0, pausas: 2 },
  ],
  tempo: [{ dia: "2026-11-18", user_id: "u1", conversas_novas: 17, dentro_da_meta: 14, media_minutos: 3.33, sem_resposta: 2 }],
  fechamentos: [{ periodo_ini: "2026-11-16", periodo_fim: "2026-11-22", user_id: "u1", vendas: 7, tickets_fechados: 5, sem_ticket: 2 }],
  metaTempoMinutos: 5,
};

describe("relatório Excel: abas da extensão", () => {
  const abas = montarAbasInteligencia(base);
  const aba = (n: string) => abas.find((a) => a.nome === n)!;

  it("tem as abas Extensao, Tempo_de_resposta e Fechamentos", () => {
    expect(abas.map((a) => a.nome)).toEqual(expect.arrayContaining(["Extensao", "Tempo_de_resposta", "Fechamentos"]));
  });
  it("Extensao: por semana e atendente, ordenado", () => {
    expect(aba("Extensao").colunas.map((c) => c.nome)).toEqual(["semana_inicio", "atendente", "tickets_criados", "tickets_atualizados", "conversas_ignoradas", "pausas"]);
    expect(aba("Extensao").linhas).toEqual([["2026-11-16", "Carla", 5, 2, 1, 0], ["2026-11-16", "Rogério", 8, 3, 0, 2]]);
  });
  it("Tempo_de_resposta e Fechamentos", () => {
    expect(aba("Tempo_de_resposta").linhas).toEqual([["2026-11-18", "Rogério", 17, 14, 3.33, 2]]);
    expect(aba("Fechamentos").linhas).toEqual([["2026-11-16", "2026-11-22", "Rogério", 7, 5, 2]]);
  });
  it("sem as migrações (dados ausentes) as abas não aparecem", () => {
    const sem = montarAbasInteligencia({ ...base, extensao: undefined, tempo: undefined, fechamentos: undefined }).map((a) => a.nome);
    expect(sem).not.toContain("Extensao");
    expect(sem).not.toContain("Fechamentos");
  });
  it("o LEIA-ME explica as abas novas e o pódio de fechamentos", () => {
    const leia = JSON.stringify(aba("LEIA-ME").linhas);
    for (const t of ["Extensao.semana_inicio", "Tempo_de_resposta.primeira_resposta_media_min", "Fechamentos.sem_ticket", "minutos_uteis"]) expect(leia).toContain(t);
    expect(JSON.stringify(montarAbasInteligencia({ ...base, ranking: [] }).find((a) => a.nome === "LEIA-ME")!.linhas)).toContain("fechamentos");
  });
  it("nenhuma coluna das abas novas é de telefone, nome de cliente ou fala", () => {
    for (const n of ["Extensao", "Tempo_de_resposta", "Fechamentos"]) {
      for (const c of aba(n).colunas) expect(c.nome).not.toMatch(/telefone|cliente|fala|mensagem|texto|hash|chat_key/i);
    }
  });
  it("gera o .xlsx de verdade, com as abas", async () => {
    const buf = await montarRelatorioInteligenciaXlsx(base);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(expect.arrayContaining(["LEIA-ME", "Extensao", "Tempo_de_resposta", "Fechamentos"]));
  });
});

describe("escopo do atendente no servidor", () => {
  const ts = readFileSync(resolve(__dirname, "../../src/lib/inteligencia-relatorio.functions.ts"), "utf8");
  it("o atendente só pede os próprios dados (o filtro de usuário não vem do navegador)", () => {
    expect(ts).toMatch(/const usuarioParam = o\.equipe \? o\.filtroUser : o\.userId;/);
    expect(ts).toMatch(/const equipe = data\.equipe && ehAdmin;/);
  });
  it("as funções SQL forçam o próprio id para quem não é admin", () => {
    const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261204090400_extensao_relatorio.sql"), "utf8");
    expect(sql.match(/CASE WHEN (v_admin|private\.has_role\(v_eu, 'admin'::app_role\)) THEN _user ELSE v_eu END/g)).toHaveLength(2);
    expect(sql.replace(/--.*$/gm, "")).not.toMatch(/telefone|primeiro_nome|chat_key/i);
  });
});
