// Planilha semanal do CRM: leitura, normalização e cruzamento. Roda no NAVEGADOR do admin.
// O servidor nunca recebe nome nem telefone de cliente em claro: só hashes e nomes de vendedores.
// Funções puras (testadas em extension/tests/crm.test.ts); a leitura do arquivo (SheetJS) fica em crm-arquivo.ts.

/** SAL FIXO do hash de telefone. O mesmo valor está na função SQL public.telefone_hash
 * (supabase/migrations/20261204090200_extensao_crm.sql). Se mudar aqui, mude lá (e recalcule os tickets). */
export const HASH_TELEFONE_SAL = "omnia-crm-v1";

/** Só dígitos, sem o 55 do país (quando o número tem 12 ou 13 dígitos) e só os últimos 9. "" se curto demais. */
export function normalizarTelefoneCrm(bruto: unknown): string {
  let d = String(bruto ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(-9);
  return d.length >= 8 ? d : "";
}

/** SHA-256 (hex) de "<sal>:<últimos 9 dígitos>". Vazio se o número não vale. */
export async function hashTelefoneCrm(bruto: unknown): Promise<string> {
  const n = normalizarTelefoneCrm(bruto);
  if (!n) return "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${HASH_TELEFONE_SAL}:${n}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Nome do vendedor comparável: sem acento, minúsculo, espaços únicos. */
export function chaveVendedor(nome: unknown): string {
  return String(nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const semAcento = (t: unknown) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
const diaOk = (y: number, m: number, d: number) => {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
};

/** Data da célula → "AAAA-MM-DD". Aceita "14/11/2026" (com ou sem hora), "2026-11-14", número serial do Excel e Date. */
export function parseDataCrm(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : diaOk(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === "number") {
    if (v < 36526 || v > 73415) return null; // 2000..2100
    const ms = Math.round((v - 25569) * 86400_000);
    const dt = new Date(ms);
    return diaOk(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const t = String(v).trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\D.*)?$/.exec(t); // dd/mm/aaaa (padrão brasileiro)
  if (m) return diaOk(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})(?:\D.*)?$/.exec(t);
  if (m) return diaOk(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

// ---------------------------------------------------------------------------
// Colunas
// ---------------------------------------------------------------------------
export const COLUNAS_ESPERADAS = ["Nome do cliente", "Telefone", "Vendedor", "Venda"] as const;

export interface Colunas { cabecalho: number; nome: number; telefone: number; vendedor: number; venda: number }

/** Acha o cabeçalho nas primeiras linhas e as colunas. `faltando` lista o que não foi achado. */
export function acharColunas(matriz: unknown[][]): { colunas: Colunas | null; faltando: string[]; encontrado: string[] } {
  let melhor: { linha: number; idx: Record<string, number>; pontos: number } | null = null;
  for (let l = 0; l < Math.min(matriz.length, 15); l++) {
    const cels = (matriz[l] ?? []).map(semAcento);
    const idx: Record<string, number> = {};
    cels.forEach((c, i) => {
      if (!c) return;
      if (idx.nome === undefined && /^nome( do)?( cliente| lead)?$/.test(c)) idx.nome = i;
      if (idx.telefone === undefined && /^(telefone|celular|fone|whatsapp|telefone do cliente)$/.test(c)) idx.telefone = i;
      if (idx.vendedor === undefined && /^(vendedor|vendedora|vendedor\(a\)|responsavel|atendente)$/.test(c)) idx.vendedor = i;
    });
    // Venda: coluna exatamente "venda"; senão a primeira cuja descrição contém "venda".
    const exata = cels.findIndex((c) => c === "venda");
    const contem = cels.findIndex((c) => c.includes("venda") && !c.includes("vendedor"));
    if (exata >= 0) idx.venda = exata; else if (contem >= 0) idx.venda = contem;
    const pontos = Object.keys(idx).length;
    if (!melhor || pontos > melhor.pontos) melhor = { linha: l, idx, pontos };
  }
  const idx = melhor?.idx ?? {};
  const faltando = [
    idx.nome === undefined ? "Nome do cliente" : null, idx.telefone === undefined ? "Telefone" : null,
    idx.vendedor === undefined ? "Vendedor" : null, idx.venda === undefined ? "Venda" : null,
  ].filter(Boolean) as string[];
  const encontrado = COLUNAS_ESPERADAS.filter((c) => !faltando.includes(c));
  // Sem o Nome a leitura segue (o nome nunca é usado); sem as demais, para e diz quais faltaram.
  if (!melhor || idx.telefone === undefined || idx.vendedor === undefined || idx.venda === undefined) return { colunas: null, faltando, encontrado };
  return { colunas: { cabecalho: melhor.linha, nome: idx.nome ?? -1, telefone: idx.telefone, vendedor: idx.vendedor, venda: idx.venda }, faltando, encontrado };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
export interface VendaCrm { vendedorKey: string; vendedorNome: string; dia: string; hash: string }

export interface LeituraCrm {
  ok: true;
  vendas: VendaCrm[];
  /** Linhas com data de Venda válida. */
  totalLinhasComVenda: number;
  semTelefoneValido: number;
  duplicadas: number;
  /** Período sugerido: da menor à maior data de Venda. */
  periodo: { ini: string; fim: string } | null;
  avisos: string[];
}
export type ResultadoLeituraCrm = LeituraCrm | { ok: false; faltando: string[]; encontrado: string[]; motivo: string };

/** Lê a matriz da planilha (linhas × colunas). Nome e telefone em claro NÃO saem desta função: só o hash. */
export async function lerMatrizCrm(matriz: unknown[][]): Promise<ResultadoLeituraCrm> {
  const { colunas, faltando, encontrado } = acharColunas(matriz);
  if (!colunas) {
    return { ok: false, faltando, encontrado, motivo: `Não achei estas colunas na planilha: ${faltando.join(", ")}. Confira se o CRM mudou o nome delas.` };
  }
  const vistas = new Set<string>();
  const vendas: VendaCrm[] = [];
  let comVenda = 0, semTel = 0, dup = 0;
  for (let l = colunas.cabecalho + 1; l < matriz.length; l++) {
    const linha = matriz[l] ?? [];
    const dia = parseDataCrm(linha[colunas.venda]);
    const vendedorNome = String(linha[colunas.vendedor] ?? "").trim();
    if (!dia || !vendedorNome) continue;
    comVenda++;
    const hash = await hashTelefoneCrm(linha[colunas.telefone]);
    if (!hash) semTel++;
    const vendedorKey = chaveVendedor(vendedorNome);
    if (hash) {
      const k = `${vendedorKey}|${hash}|${dia}`;
      if (vistas.has(k)) { dup++; continue; }
      vistas.add(k);
    }
    vendas.push({ vendedorKey, vendedorNome, dia, hash });
  }
  const dias = vendas.map((v) => v.dia).sort();
  const avisos: string[] = [];
  if (faltando.includes("Nome do cliente")) avisos.push('A coluna "Nome do cliente" não foi achada. Não faz diferença: o nome nunca é usado.');
  return {
    ok: true, vendas, totalLinhasComVenda: comVenda, semTelefoneValido: semTel, duplicadas: dup,
    periodo: dias.length ? { ini: dias[0], fim: dias[dias.length - 1] } : null, avisos,
  };
}

// ---------------------------------------------------------------------------
// Cruzamento
// ---------------------------------------------------------------------------
export const noPeriodo = (vendas: VendaCrm[], ini: string, fim: string) => vendas.filter((v) => v.dia >= ini && v.dia <= fim);

export interface VendedorPlanilha { key: string; nome: string; vendas: number }

export function vendedoresDe(vendas: VendaCrm[]): VendedorPlanilha[] {
  const m = new Map<string, VendedorPlanilha>();
  for (const v of vendas) {
    const x = m.get(v.vendedorKey) ?? { key: v.vendedorKey, nome: v.vendedorNome, vendas: 0 };
    x.vendas++;
    m.set(v.vendedorKey, x);
  }
  return [...m.values()].sort((a, b) => b.vendas - a.vendas || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "N de M conferidos": vendedores da planilha que já têm usuário da Omnia. Os pendentes não contam. */
export function conferencia(vendedores: VendedorPlanilha[], mapa: Record<string, string>) {
  const pendentes = vendedores.filter((v) => !mapa[v.key]);
  return { conferidos: vendedores.length - pendentes.length, total: vendedores.length, pendentes };
}

/** Hashes das vendas de cada usuário mapeado (sem repetir). Vendedor pendente fica de fora. */
export function hashesPorUsuario(vendas: VendaCrm[], mapa: Record<string, string>): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const v of vendas) {
    const u = mapa[v.vendedorKey];
    if (!u || !v.hash) continue;
    (out[u] ??= new Set()).add(v.hash);
  }
  return Object.fromEntries(Object.entries(out).map(([u, s]) => [u, [...s]]));
}

export interface LinhaFechamento { user_id: string; dia: string; vendas: number; tickets_fechados: number; sem_ticket: number }

/** Uma linha por usuário e dia de venda. `casados` = hashes que viraram (ou já eram) "Venda concluída (CRM)". */
export function montarLinhas(vendas: VendaCrm[], mapa: Record<string, string>, casados: Record<string, string[]>): LinhaFechamento[] {
  const grupos = new Map<string, { user_id: string; dia: string; vendas: number; hashes: Set<string> }>();
  for (const v of vendas) {
    const u = mapa[v.vendedorKey];
    if (!u) continue;
    const k = `${u}|${v.dia}`;
    const g = grupos.get(k) ?? { user_id: u, dia: v.dia, vendas: 0, hashes: new Set<string>() };
    g.vendas++;
    if (v.hash && (casados[u] ?? []).includes(v.hash)) g.hashes.add(v.hash);
    grupos.set(k, g);
  }
  return [...grupos.values()]
    .map((g) => {
      const fechados = Math.min(g.hashes.size, g.vendas);
      return { user_id: g.user_id, dia: g.dia, vendas: g.vendas, tickets_fechados: fechados, sem_ticket: g.vendas - fechados };
    })
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.user_id.localeCompare(b.user_id));
}

export interface ResumoEnvio { ini: string; fim: string; vendas: number; ticketsFechados: number; semTicket: number; conferidos: number; totalVendedores: number; pendentes: string[] }

export function resumirEnvio(linhas: LinhaFechamento[], ini: string, fim: string, conf: ReturnType<typeof conferencia>): ResumoEnvio {
  return {
    ini, fim,
    vendas: linhas.reduce((a, l) => a + l.vendas, 0),
    ticketsFechados: linhas.reduce((a, l) => a + l.tickets_fechados, 0),
    semTicket: linhas.reduce((a, l) => a + l.sem_ticket, 0),
    conferidos: conf.conferidos, totalVendedores: conf.total, pendentes: conf.pendentes.map((p) => p.nome),
  };
}

const dm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
/** "14/11 a 20/11 · 38 vendas · 31 tickets fechados · 7 sem ticket · vendedores conferidos 5 de 6". */
export function textoResumo(r: ResumoEnvio): string {
  const s = (n: number, um: string, v: string) => `${n} ${n === 1 ? um : v}`;
  return `${dm(r.ini)} a ${dm(r.fim)} · ${s(r.vendas, "venda", "vendas")} · ${s(r.ticketsFechados, "ticket fechado", "tickets fechados")} · ${r.semTicket} sem ticket · vendedores conferidos ${r.conferidos} de ${r.totalVendedores}`;
}
