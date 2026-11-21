import { PONTOS_CADENCIA, PONTO_CURTO, VARIAVEIS_RETOMADA, type PontoCadencia } from "@/lib/retomada";

// "Mensagens que vendem" — tipos e regras de apresentação (sem banco nem IA).

export type Selo = "funciona_bem" | "vale_testar_outra";
export const SELO_LABEL: Record<Selo, string> = { funciona_bem: "Funciona bem", vale_testar_outra: "Vale testar outra" };

export const ROTULO_VERSAO_ANTERIOR = "Versão anterior · Funciona bem";

/** Linha devolvida por `mensagens_desempenho` (só o Admin vê). */
export interface LinhaDesempenho {
  origem: "cadencia" | "fechamento";
  /** Ponto de parada (cadência), "follow_up", ou o tipo do item (fechamento: mensagem_etapa | travamento | sinal). */
  ponto: string;
  etapa: string;
  mensagem_id: string;
  versao: number | null;
  titulo: string;
  enviadas: number;
  responderam: number | null;
  fecharam: number;
  media_resposta: number | null;
  media_fechamento: number | null;
  selo: Selo | null;
}

/** O que o atendente recebe de `mensagens_selo()`: sem percentuais. */
export interface SeloMensagem {
  origem: "cadencia" | "fechamento";
  mensagem_id: string;
  versao: number | null;
  envios: number;
  selo: Selo | null;
}

export interface VersaoAnterior { mensagem_id: string; versao: number; texto: string; canal: string }

export function toLinhaDesempenho(r: Record<string, unknown>): LinhaDesempenho {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    origem: r.origem === "fechamento" ? "fechamento" : "cadencia",
    ponto: String(r.ponto ?? ""),
    etapa: String(r.etapa ?? ""),
    mensagem_id: String(r.mensagem_id),
    versao: n(r.versao),
    titulo: String(r.titulo ?? ""),
    enviadas: Number(r.enviadas ?? 0),
    responderam: n(r.responderam),
    fecharam: Number(r.fecharam ?? 0),
    media_resposta: n(r.media_resposta),
    media_fechamento: n(r.media_fechamento),
    selo: r.selo === "funciona_bem" || r.selo === "vale_testar_outra" ? r.selo : null,
  };
}

export const pct = (parte: number | null, total: number): number | null => (parte == null || total <= 0 ? null : parte / total);
export const fmtPct = (v: number | null): string => (v == null ? "–" : `${Math.round(v * 100)}%`);

/** Chips do Admin: os pontos de parada da cadência e o "Fechar com este cliente". */
export const FILTROS_PONTO = [...PONTOS_CADENCIA, "fechar"] as const;
export type FiltroPonto = (typeof FILTROS_PONTO)[number];
export const FILTRO_PONTO_LABEL: Record<FiltroPonto, string> = {
  ...(PONTO_CURTO as Record<PontoCadencia, string>),
  fechar: "Fechar com este cliente",
};

export function pontoDaLinha(l: LinhaDesempenho): FiltroPonto {
  return l.origem === "fechamento" ? "fechar" : (l.ponto as PontoCadencia);
}

export const ETAPA_ORDEM = ["follow_up", "d1", "d2", "d4", "d7", "d10", "proposta", "plano", "dados", "pagamento", "link"];

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
    created_at: String(r.created_at),
  };
}

export interface ConfigMensagensVendem { min_envios: number; limite_baixo: number }
export const CONFIG_PADRAO: ConfigMensagensVendem = { min_envios: 10, limite_baixo: 0.7 };

const TOKEN = /\{([a-z_]+)\}/gi;
function variaveisDe(t: string): Set<string> {
  return new Set([...t.matchAll(TOKEN)].map((m) => m[1].toLowerCase()));
}

/** A nova versão só pode usar as variáveis permitidas e tem de manter as que a atual usa. */
export function conferirVariaveis(original: string, novo: string): string | null {
  const permitidas = new Set<string>(VARIAVEIS_RETOMADA);
  const usadas = variaveisDe(novo);
  for (const v of usadas) if (!permitidas.has(v)) return `variável {${v}} não existe`;
  for (const v of variaveisDe(original)) if (!usadas.has(v)) return `faltou manter {${v}}`;
  return null;
}

