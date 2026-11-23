// "Preencher com IA" (Admin > Amor Saúde): funções puras compartilhadas pelas quatro abas.
// Sem React e sem imports de servidor, para rodar também nos testes.

/** Mesma normalização de `normalizarPergunta` (duvidas.ts), repetida aqui para manter o módulo isolado. */
export function normalizarNome(s: string): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Divide o texto em lotes de até `maxChars`, cortando só em fim de linha (preferindo linha em branco).
 * Nunca parte uma linha ao meio; uma linha maior que `maxChars` vira um lote sozinha.
 */
export function dividirEmLotes(texto: string, maxChars = 5000): string[] {
  const linhas = String(texto ?? "").replace(/\r\n?/g, "\n").split("\n");
  const lotes: string[] = [];
  let atual: string[] = [];
  let tamanho = 0;
  // Último ponto de corte preferido (linha em branco) dentro do lote atual.
  let corte = -1;

  const fechar = (ate: number) => {
    const bloco = atual.slice(0, ate).join("\n").trim();
    if (bloco) lotes.push(bloco);
    atual = atual.slice(ate);
    tamanho = atual.reduce((s, l) => s + l.length + 1, 0);
    corte = -1;
    // recalcula o corte preferido no que sobrou
    atual.forEach((l, i) => { if (!l.trim() && i > 0) corte = i + 1; });
  };

  for (const linha of linhas) {
    const custo = linha.length + 1;
    if (atual.length > 0 && tamanho + custo > maxChars) {
      // Prefere cortar na última linha em branco; senão, no fim da linha anterior.
      fechar(corte > 0 ? corte : atual.length);
    }
    atual.push(linha);
    tamanho += custo;
    if (!linha.trim()) corte = atual.length;
  }
  fechar(atual.length);
  return lotes;
}

/** Recupera os objetos completos de um array JSON cortado no meio. */
function recuperarObjetos(trecho: string): unknown[] {
  const itens: unknown[] = [];
  let profundidade = 0;
  let emTexto = false;
  let escape = false;
  let inicio = -1;
  for (let i = 0; i < trecho.length; i++) {
    const c = trecho[i];
    if (emTexto) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') emTexto = false;
      continue;
    }
    if (c === '"') { emTexto = true; continue; }
    if (c === "{") { if (profundidade === 0) inicio = i; profundidade++; }
    else if (c === "}") {
      profundidade--;
      if (profundidade === 0 && inicio >= 0) {
        try { itens.push(JSON.parse(trecho.slice(inicio, i + 1))); } catch { /* ignora objeto quebrado */ }
        inicio = -1;
      }
      if (profundidade < 0) profundidade = 0;
    }
  }
  return itens;
}

/**
 * Tira cercas de markdown, acha o primeiro `[` e faz `JSON.parse` até o último `]`.
 * Se a resposta vier cortada, devolve os objetos completos anteriores ao corte com `truncado: true`.
 */
export function extrairJsonArray(resposta: string): { itens: unknown[]; truncado: boolean } {
  const limpo = String(resposta ?? "").replace(/```(?:json)?/gi, "").trim();
  const ini = limpo.indexOf("[");
  if (ini < 0) return { itens: [], truncado: false };
  const fim = limpo.lastIndexOf("]");
  if (fim > ini) {
    try {
      const v = JSON.parse(limpo.slice(ini, fim + 1));
      if (Array.isArray(v)) return { itens: v, truncado: false };
    } catch { /* cai na recuperação */ }
  }
  const itens = recuperarObjetos(limpo.slice(ini + 1));
  return { itens, truncado: true };
}

export function jaExiste(nome: string, existentes: string[]): boolean {
  const n = normalizarNome(nome);
  if (!n) return false;
  return existentes.some((e) => normalizarNome(e) === n);
}

export interface ClinicaRef { id: string; nome_regiao: string; regiao?: string | null }

const TODAS = new Set(["todas", "todas as clinicas", "todas as unidades", "todos", "todas clinicas", "todas unidades"]);

/**
 * Casa os nomes devolvidos pela IA com as clínicas cadastradas.
 * Igualdade normalizada; senão contenção (mínimo 4 letras, e só se UMA clínica casar).
 */
export function casarClinicas(nomesDaIA: string[], clinicas: ClinicaRef[]): { ids: string[]; naoEncontradas: string[] } {
  const ids = new Set<string>();
  const naoEncontradas: string[] = [];
  const base = clinicas.map((c) => ({ id: c.id, n: normalizarNome(c.nome_regiao) }));

  for (const bruto of nomesDaIA ?? []) {
    const n = normalizarNome(String(bruto ?? ""));
    if (!n) continue;
    if (TODAS.has(n)) { clinicas.forEach((c) => ids.add(c.id)); continue; }
    const iguais = base.filter((c) => c.n && c.n === n);
    if (iguais.length > 0) { iguais.forEach((c) => ids.add(c.id)); continue; }
    const parciais = base.filter((c) => c.n.length >= 4 && n.length >= 4 && (n.includes(c.n) || c.n.includes(n)));
    if (parciais.length === 1) { ids.add(parciais[0].id); continue; }
    naoEncontradas.push(String(bruto).trim());
  }
  return { ids: [...ids], naoEncontradas };
}

export interface ResultadoLotes<T> { itens: T[]; falhas: number[]; truncados: number[] }

/**
 * Roda os lotes EM SEQUÊNCIA (nunca em paralelo, para não estourar a cota de IA).
 * Se um lote falhar, mantém o que já veio e devolve os índices dos lotes que falharam.
 */
export async function rodarEmLotes<T>(
  lotes: string[],
  chamar: (lote: string, indice: number) => Promise<{ itens: T[]; truncado?: boolean }>,
  aoProgredir?: (atual: number, total: number) => void,
): Promise<ResultadoLotes<T>> {
  const itens: T[] = [];
  const falhas: number[] = [];
  const truncados: number[] = [];
  for (let i = 0; i < lotes.length; i++) {
    aoProgredir?.(i + 1, lotes.length);
    try {
      const r = await chamar(lotes[i], i);
      itens.push(...r.itens);
      if (r.truncado) truncados.push(i);
    } catch {
      falhas.push(i);
    }
  }
  return { itens, falhas, truncados };
}

/** Regras de IA válidas para as quatro abas (entram no prompt de sistema). */
export const REGRAS_IA = `Nunca invente. Preço, média de referência, link e tempo de espera só saem se estiverem escritos no texto enviado; caso contrário use null.
Valores em reais são números com ponto decimal (o texto pode trazer "R$ 1.234,56"; você devolve 1234.56).
Se o texto trouxer uma lista com muitos itens, devolva um objeto para cada um, sem pular nenhum.
Responda APENAS com o array JSON, sem markdown e sem nenhum texto fora do JSON.`;

/** Aceita número ou texto no formato brasileiro ("R$ 1.234,56") e devolve número ou null. */
export function numeroOuNull(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== "string") return null;
  let t = v.replace(/R\$|\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Lista de textos limpa (aceita array ou texto separado por linhas). */
export function listaDeTextos(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return arr.map((x) => String(x ?? "").replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
}
