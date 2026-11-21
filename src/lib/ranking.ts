// Ranking de qualidade (pódios mensais): constantes, textos e formatação. Sem banco nem servidor.

export const PODIOS_QUALIDADE = ["constantes", "respondidas", "evoluiram", "ensinam"] as const;
export type PodioQualidade = (typeof PODIOS_QUALIDADE)[number];
export const PODIOS = [...PODIOS_QUALIDADE, "treino"] as const;
export type Podio = (typeof PODIOS)[number];

export const PODIO_TITULO: Record<Podio, string> = {
  constantes: "Mais constantes",
  respondidas: "Mais respondidas",
  evoluiram: "Que mais evoluíram",
  ensinam: "Que mais ensinam",
  treino: "Treino no Simulador",
};

export const PODIO_SUBTITULO: Record<Podio, string> = {
  constantes: "Retomadas feitas no dia",
  respondidas: "Clientes que responderam às retomadas",
  evoluiram: "Melhora da nota no Simulador sobre o mês passado",
  ensinam: "Conversas publicadas e objeções aprovadas",
  treino: "Pontos do mês",
};

/** "Como é calculado": uma explicação curta de cada pódio. */
export const PODIO_COMO: Record<Podio, string> = {
  constantes:
    "Das retomadas com prazo neste mês, quantas você enviou no dia do prazo (até o fim do dia). Só entra quem tem o mínimo de retomadas no mês.",
  respondidas:
    "Entre as retomadas em que você marcou \"Enviei\" no mês, quantas o cliente respondeu ou fechou. Só entra quem tem o mínimo de retomadas no mês.",
  evoluiram:
    "Quanto a nota média das suas simulações deste mês subiu sobre a do mês passado. Precisa de pelo menos 3 simulações em cada mês.",
  ensinam:
    "Conversas suas publicadas na Biblioteca mais objeções suas aprovadas com o seu crédito, no mês. Conta o número de contribuições.",
  treino:
    "Pontos que você ganhou no Simulador neste mês, com as mesmas regras de XP de sempre. Atendimento e Solução de problemas têm abas separadas.",
};

export const PODIO_MEU: Record<Podio, { rotulo: string; sufixo: string }> = {
  constantes: { rotulo: "das retomadas no dia", sufixo: "" },
  respondidas: { rotulo: "responderam", sufixo: "" },
  evoluiram: { rotulo: "sobre o mês passado", sufixo: "" },
  ensinam: { rotulo: "contribuições", sufixo: "" },
  treino: { rotulo: "pontos", sufixo: "" },
};

/** Valor como aparece no pódio: 96%, +18%, 5, 640. */
export function fmtValor(podio: Podio, v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  const r = Math.round(n);
  if (podio === "evoluiram") return `${r > 0 ? "+" : ""}${r}%`;
  if (podio === "constantes" || podio === "respondidas") return `${r}%`;
  return String(r);
}

export interface TopItem { posicao: number; nome: string; valor: number; voce: boolean }
export interface PodioPessoal {
  top: TopItem[];
  /** Só o valor da própria pessoa: nunca a posição. */
  meu: { valor: number | null; total: number; qualifica: boolean; no_podio: boolean } | null;
  anterior: number | null;
  /** Só no Treino: nível acumulado do Simulador. */
  nivel?: string;
}

export interface RankingPodios {
  mes: string;
  minimo_retomadas: number;
  ativos: Record<Podio, boolean>;
  podios: Record<Exclude<Podio, "treino">, PodioPessoal>;
  treino: { atendimento: PodioPessoal; problemas: PodioPessoal };
}

export interface CampeaoHall { mes: string; podio: Podio; nome: string; valor: number }

export interface DestaqueMes { podio: Podio; nome: string; valor: number }

/** Rótulo curto dos selos de destaque do Início: "mais constante", "mais ensina"… */
export const PODIO_DESTAQUE: Record<Podio, string> = {
  constantes: "mais constante",
  respondidas: "mais respondida",
  evoluiram: "mais evoluiu",
  ensinam: "mais ensina",
  treino: "mais treinou",
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "novembro" a partir de AAAA-MM-DD. */
export function nomeDoMes(mes: string): string {
  return MESES[Number(mes.slice(5, 7)) - 1] ?? "";
}
export function nomeDoMesAno(mes: string): string {
  return `${nomeDoMes(mes)} de ${mes.slice(0, 4)}`;
}

/** Primeiro dia do mês (AAAA-MM-01) de um dia AAAA-MM-DD, com `delta` meses de diferença. */
export function mesDe(dia: string, delta = 0): string {
  const y = Number(dia.slice(0, 4));
  const m = Number(dia.slice(5, 7)) - 1 + delta;
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
