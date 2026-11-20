import { PONTO_CURTO, ETAPA_LABEL, type EtapaRetomada, type PontoCadencia } from "@/lib/retomada";
import { ETAPA_LABEL as FECHAMENTO_ETAPA, type Etapa } from "@/lib/cliente-disse";

// "Mensagens que vendem" — tipos e regras puras (selo, atribuição e textos).
// As contas (atribuição da "última mensagem enviada", médias e selo) rodam no banco,
// em funções SQL (mensagens_desempenho e mensagens_selo); aqui só se lê o resultado.

export type Selo = "funciona_bem" | "vale_testar" | null;
export const SELO_LABEL: Record<Exclude<Selo, null>, string> = { funciona_bem: "Funciona bem", vale_testar: "Vale testar outra" };

/** Regras padrão do selo (valem se a tabela de configuração ainda não existir). */
export const MIN_ENVIOS_PADRAO = 10;
export const LIMITE_BAIXO_PADRAO = 0.7;

export type OrigemMensagem = "cadencia" | "fechamento";

export interface LinhaDesempenho {
  origem: OrigemMensagem;
  mensagem_id: string;
  versao: number;
  ponto_parada: string;
  etapa: string;
  enviadas: number;
  responderam: number;
  fecharam: number;
  /** Taxa média da etapa (todas as versões): resposta na cadência, fechamento no Fechar com este cliente. */
  media_taxa: number;
  selo: Selo;
}

export const chaveLinha = (l: Pick<LinhaDesempenho, "origem" | "mensagem_id" | "versao">) => `${l.origem}:${l.mensagem_id}:${l.versao}`;

export function pct(parte: number, total: number): number | null {
  return total > 0 ? parte / total : null;
}
export function pctTexto(v: number | null): string {
  return v == null ? "–" : `${Math.round(v * 100)}%`;
}

export function toLinha(r: Record<string, unknown>): LinhaDesempenho {
  const selo = r.selo === "funciona_bem" || r.selo === "vale_testar" ? r.selo : null;
  return {
    origem: r.origem === "fechamento" ? "fechamento" : "cadencia",
    mensagem_id: String(r.mensagem_id),
    versao: Number(r.versao ?? 1),
    ponto_parada: String(r.ponto_parada ?? ""),
    etapa: String(r.etapa ?? ""),
    enviadas: Number(r.enviadas ?? 0),
    responderam: Number(r.responderam ?? 0),
    fecharam: Number(r.fecharam ?? 0),
    media_taxa: Number(r.media_taxa ?? 0),
    selo,
  };
}

export function etapaTexto(l: Pick<LinhaDesempenho, "origem" | "etapa">): string {
  if (l.origem === "fechamento") return FECHAMENTO_ETAPA[l.etapa as Etapa] ?? l.etapa;
  const e = l.etapa as EtapaRetomada;
  return e === "d7" ? "D+7 · áudio" : ETAPA_LABEL[e] ?? l.etapa;
}
export function pontoTexto(p: string): string {
  return p === "fechamento" ? "Fechamento" : PONTO_CURTO[p as PontoCadencia] ?? p;
}

/** Selo mostrado ao atendente: "Funciona bem" e "Vale testar outra" (sem percentuais). */
export interface SeloAtendente { envios: number; selo: Selo }

export interface MensagensSeloBase {
  /** chave = origem:mensagem_id:versao */
  selos: Record<string, SeloAtendente>;
  /** Versão anterior (mais recente) com selo "Funciona bem": texto para o atendente copiar. */
  versoesBoas: Record<string, { versao: number; texto: string }>;
}

// ---------------------------------------------------------------------------
// Variáveis das mensagens da cadência
// ---------------------------------------------------------------------------

export const VARIAVEIS_PERMITIDAS = ["nome", "atendente", "plano", "dependentes", "usos", "observacao"] as const;

export function variaveisDoTexto(t: string): string[] {
  return [...new Set([...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
}

/** A nova versão só pode usar variáveis conhecidas e tem de manter as que a original já usava. */
export function variaveisOk(original: string, novo: string): { ok: boolean; desconhecidas: string[]; faltando: string[] } {
  const orig = variaveisDoTexto(original);
  const nov = variaveisDoTexto(novo);
  const desconhecidas = nov.filter((v) => !(VARIAVEIS_PERMITIDAS as readonly string[]).includes(v));
  const faltando = orig.filter((v) => !nov.includes(v));
  return { ok: !desconhecidas.length && !faltando.length, desconhecidas, faltando };
}

// ---------------------------------------------------------------------------
// Sugestões da IA
// ---------------------------------------------------------------------------

export interface SugestaoMensagem {
  id: string;
  mensagem_id: string;
  versao_base: number;
  texto_sugerido: string;
  por_que_mudar: string;
  status: "pendente" | "aprovada" | "ignorada";
  versao_criada: number | null;
  decidido_em: string | null;
  created_at: string;
}

export function toSugestao(r: Record<string, unknown>): SugestaoMensagem {
  return {
    id: String(r.id),
    mensagem_id: String(r.mensagem_id),
    versao_base: Number(r.versao_base),
    texto_sugerido: String(r.texto_sugerido ?? ""),
    por_que_mudar: String(r.por_que_mudar ?? ""),
    status: r.status === "aprovada" || r.status === "ignorada" ? r.status : "pendente",
    versao_criada: r.versao_criada == null ? null : Number(r.versao_criada),
    decidido_em: (r.decidido_em as string | null) ?? null,
    created_at: String(r.created_at ?? ""),
  };
}
