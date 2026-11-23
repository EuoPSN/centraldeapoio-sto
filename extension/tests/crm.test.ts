import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import {
  HASH_TELEFONE_SAL, acharColunas, chaveVendedor, conferencia, hashTelefoneCrm, hashesPorUsuario, lerMatrizCrm, montarLinhas,
  noPeriodo, normalizarTelefoneCrm, parseDataCrm, resumirEnvio, textoResumo, vendedoresDe,
} from "../../src/lib/crm";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("telefone do CRM", () => {
  it("só dígitos, sem o 55, últimos 9", () => {
    expect(normalizarTelefoneCrm("+55 (31) 99123-4567")).toBe("991234567");
    expect(normalizarTelefoneCrm("5531991234567")).toBe("991234567");
    expect(normalizarTelefoneCrm("31991234567")).toBe("991234567");
    expect(normalizarTelefoneCrm("991234567")).toBe("991234567");
    expect(normalizarTelefoneCrm("123")).toBe("");
    expect(normalizarTelefoneCrm(null)).toBe("");
  });
  it("hash com sal fixo; mesmo número em formatos diferentes dá o mesmo hash", async () => {
    const esperado = sha(`${HASH_TELEFONE_SAL}:991234567`);
    expect(await hashTelefoneCrm("(31) 99123-4567")).toBe(esperado);
    expect(await hashTelefoneCrm("+55 31 991234567")).toBe(esperado);
    expect(await hashTelefoneCrm("abc")).toBe("");
  });
  it("o sal e a normalização do SQL são os mesmos do código", () => {
    const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261204090200_extensao_crm.sql"), "utf8");
    expect(sql).toContain(`'${HASH_TELEFONE_SAL}:'`);
    expect(sql).toMatch(/right\(d2, 9\)/);
    expect(sql).toMatch(/length\(d\) >= 12 AND left\(d, 2\) = '55'/);
  });
});

describe("datas", () => {
  it("dd/mm/aaaa, ISO, serial do Excel e Date", () => {
    expect(parseDataCrm("14/11/2026")).toBe("2026-11-14");
    expect(parseDataCrm("14/11/2026 15:30")).toBe("2026-11-14");
    expect(parseDataCrm("2026-11-14")).toBe("2026-11-14");
    expect(parseDataCrm(46340)).toBe("2026-11-14");
    expect(parseDataCrm(new Date(Date.UTC(2026, 10, 14)))).toBe("2026-11-14");
    expect(parseDataCrm("31/02/2026")).toBeNull();
    expect(parseDataCrm("")).toBeNull();
    expect(parseDataCrm("abc")).toBeNull();
  });
});

const cab = ["Nome do cliente", "Telefone", "Vendedor", "Novo lead", "Venda"];
const planilha = [
  ["Relatório clientes-vendas"],
  cab,
  ["Ana Souza", "(31) 99111-1111", "Rogério P.", "01/11/2026", "14/11/2026"],
  ["Bia Lima", "5531992222222", "Carla M.", "02/11/2026", "15/11/2026"],
  ["Caio", "31993333333", "Wesley S.", "03/11/2026", "16/11/2026"],
  ["Dani", "", "Rogério P.", "03/11/2026", "17/11/2026"],
  ["Edu", "31994444444", "Rogério P.", "03/11/2026", null],
  ["Ana Souza (repetida)", "31991111111", "Rogério P.", "01/11/2026", "14/11/2026"],
];

describe("planilha do CRM", () => {
  it("acha o cabeçalho e as colunas, mesmo com linha de título antes", () => {
    const r = acharColunas(planilha);
    expect(r.faltando).toEqual([]);
    expect(r.colunas).toMatchObject({ cabecalho: 1, telefone: 1, vendedor: 2, venda: 4 });
  });
  it("mostra quais colunas faltaram em vez de falhar calado", async () => {
    const r = await lerMatrizCrm([["Cliente", "Fone", "Responsável"], ["x", "1", "y"]]);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.faltando).toContain("Venda"); expect(r.motivo).toMatch(/Venda/); }
    const r2 = await lerMatrizCrm([["Nome do cliente", "Telefone", "Vendedor", "Orçamento"], ["x", "1", "y", "z"]]);
    expect(r2.ok === false && r2.faltando).toEqual(["Venda"]);
  });
  it("lê vendas com data de Venda, dedup, período sugerido e hashes (sem nome nem telefone na saída)", async () => {
    const r = await lerMatrizCrm(planilha);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.vendas).toHaveLength(4); // a linha sem data de Venda sai; a repetida é descartada
    expect(r.duplicadas).toBe(1);
    expect(r.semTelefoneValido).toBe(1);
    expect(r.periodo).toEqual({ ini: "2026-11-14", fim: "2026-11-17" });
    const bruto = JSON.stringify(r);
    for (const proibido of ["Ana", "Bia", "Caio", "99111", "92222", "93333"]) expect(bruto).not.toContain(proibido);
    expect(r.vendas.every((v) => v.hash === "" || /^[0-9a-f]{64}$/.test(v.hash))).toBe(true);
  });
  it("lê um .xlsx de verdade (datas como número serial)", async () => {
    const ws = XLSX.utils.aoa_to_sheet([cab, ["Ana", "31991111111", "Rogério P.", 46327, 46340]]);
    ws["E2"].z = "dd/mm/yyyy"; ws["D2"].z = "dd/mm/yyyy";
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Plan1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const lido = XLSX.read(buf, { type: "array" });
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(lido.Sheets[lido.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
    const r = await lerMatrizCrm(matriz);
    expect(r.ok && r.vendas[0].dia).toBe("2026-11-14");
  });
  it("lê um .csv com ponto e vírgula e datas brasileiras", async () => {
    const csv = "Nome do cliente;Telefone;Vendedor;Venda\nAna;(31) 99111-1111;Rogério P.;14/11/2026\n";
    const lido = XLSX.read(csv, { type: "string", raw: true });
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(lido.Sheets[lido.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
    const r = await lerMatrizCrm(matriz);
    expect(r.ok && r.vendas).toHaveLength(1);
    expect(r.ok && r.vendas[0].dia).toBe("2026-11-14");
  });
});

describe("cruzamento e resumo", () => {
  it("vendedor pendente não conta até mapear; N de M conferidos", async () => {
    const r = await lerMatrizCrm(planilha);
    if (!r.ok) throw new Error("falhou");
    const vendedores = vendedoresDe(r.vendas);
    expect(vendedores.map((v) => v.key)).toEqual(["rogerio p.", "carla m.", "wesley s."]);
    const mapa = { [chaveVendedor("Rogério P.")]: "u-rogerio", [chaveVendedor("Carla M.")]: "u-carla" };
    expect(conferencia(vendedores, mapa)).toMatchObject({ conferidos: 2, total: 3 });
    expect(conferencia(vendedores, mapa).pendentes.map((p) => p.nome)).toEqual(["Wesley S."]);
    const porUsuario = hashesPorUsuario(r.vendas, mapa);
    expect(Object.keys(porUsuario).sort()).toEqual(["u-carla", "u-rogerio"]);
    // Rogério vendeu 2 com telefone (hash) e 1 sem: só os 2 com hash vão para o cruzamento
    expect(porUsuario["u-rogerio"]).toHaveLength(1);
    const hRog = porUsuario["u-rogerio"][0];
    const linhas = montarLinhas(r.vendas, mapa, { "u-rogerio": [hRog] });
    expect(linhas).toEqual([
      { user_id: "u-rogerio", dia: "2026-11-14", vendas: 1, tickets_fechados: 1, sem_ticket: 0 },
      { user_id: "u-carla", dia: "2026-11-15", vendas: 1, tickets_fechados: 0, sem_ticket: 1 },
      { user_id: "u-rogerio", dia: "2026-11-17", vendas: 1, tickets_fechados: 0, sem_ticket: 1 },
    ]);
    const resumo = resumirEnvio(linhas, "2026-11-14", "2026-11-17", conferencia(vendedores, mapa));
    expect(textoResumo(resumo)).toBe("14/11 a 17/11 · 3 vendas · 1 ticket fechado · 2 sem ticket · vendedores conferidos 2 de 3");
    expect(resumo.pendentes).toEqual(["Wesley S."]);
  });
  it("só vendas dentro do período escolhido", async () => {
    const r = await lerMatrizCrm(planilha);
    if (!r.ok) throw new Error("falhou");
    expect(noPeriodo(r.vendas, "2026-11-15", "2026-11-16")).toHaveLength(2);
  });
  it("reenviar semanas que se sobrepõem não conta vendas em dobro: o dia é a chave", () => {
    const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261204090200_extensao_crm.sql"), "utf8");
    expect(sql).toMatch(/DELETE FROM public\.crm_fechamentos WHERE periodo_ini >= _ini AND periodo_fim <= _fim/);
    expect(sql).toMatch(/UNIQUE \(user_id, periodo_ini, periodo_fim\)/);
  });
});

describe("o servidor nunca recebe nome nem telefone de cliente", () => {
  it("as funções do servidor só aceitam hashes e nomes de vendedor", () => {
    const ts = readFileSync(resolve(__dirname, "../../src/lib/crm.functions.ts"), "utf8").replace(/\/\/.*$/gm, "");
    expect(ts).toMatch(/regex\(\/\^\[0-9a-f\]\{64\}\$\/\)/);
    expect(ts).not.toMatch(/telefone|nome_cliente|nomeCliente/i);
    const ui = readFileSync(resolve(__dirname, "../../src/components/admin/FechamentosCrm.tsx"), "utf8");
    expect(ui).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });
  it("a planilha não é guardada: a leitura só devolve a matriz em memória", () => {
    const arq = readFileSync(resolve(__dirname, "../../src/lib/crm-arquivo.ts"), "utf8");
    expect(arq).not.toMatch(/fetch\(|upload|storage|insert\(/i);
  });
});
