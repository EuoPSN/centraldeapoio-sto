import { PLANO_LABEL, type Caso } from "@/lib/cliente-disse";

// "Retomar hoje" — tipos, rótulos e regras da cadência (sem acesso a banco).

export const PONTOS = ["nao_respondeu_primeira", "parou_explicativa", "recebeu_proposta", "travou_fechamento"] as const;
export type Ponto = (typeof PONTOS)[number];
export type PontoCadencia = Ponto | "follow_up";
export const PONTOS_CADENCIA: readonly PontoCadencia[] = [...PONTOS, "follow_up"];

export const PONTO_LABEL: Record<PontoCadencia, string> = {
  nao_respondeu_primeira: "Não respondeu a 1ª mensagem",
  parou_explicativa: "Parou na explicativa",
  recebeu_proposta: "Recebeu a proposta",
  travou_fechamento: "Travou no fechamento",
  follow_up: "Follow-up",
};
/** Versão curta, usada nas pílulas do Admin. */
export const PONTO_CURTO: Record<PontoCadencia, string> = {
  nao_respondeu_primeira: "Não respondeu a 1ª",
  parou_explicativa: "Parou na explicativa",
  recebeu_proposta: "Recebeu a proposta",
  travou_fechamento: "Travou no fechamento",
  follow_up: "Follow-up",
};
/** Texto da linha da lista ("onde parou"). */
export const PONTO_LISTA: Record<Ponto, string> = {
  nao_respondeu_primeira: "Não respondeu a primeira mensagem",
  parou_explicativa: "Parou na explicativa",
  recebeu_proposta: "Recebeu a proposta",
  travou_fechamento: "Travou no fechamento",
};

export const ETAPAS_RETOMADA = ["follow_up", "d1", "d2", "d4", "d7", "d10"] as const;
export type EtapaRetomada = (typeof ETAPAS_RETOMADA)[number];
/** Régua de retrabalho (o follow-up fica fora da régua). */
export const REGUA = ["d1", "d2", "d4", "d7", "d10"] as const;
export type EtapaRegua = (typeof REGUA)[number];

export const ETAPA_LABEL: Record<EtapaRetomada, string> = {
  follow_up: "Follow-up", d1: "D+1", d2: "D+2", d4: "D+4", d7: "D+7", d10: "D+10",
};
/** Selo da lista: o D+7 mostra o canal. */
export const ETAPA_SELO: Record<EtapaRetomada, string> = {
  follow_up: "Follow-up", d1: "D+1", d2: "D+2", d4: "D+4", d7: "D+7 · áudio", d10: "D+10",
};

export const STATUS = ["fila", "respondeu", "fechou", "perdido", "esfriou"] as const;
export type StatusRetomada = (typeof STATUS)[number];
export const STATUS_LABEL: Record<StatusRetomada, string> = {
  fila: "Na fila", respondeu: "Respondeu", fechou: "Fechou", perdido: "Perdido", esfriou: "Esfriou",
};

export const ORIGENS = ["manual", "fechamento", "extensao"] as const;
export type Origem = (typeof ORIGENS)[number];

export const CANAIS = ["texto", "audio"] as const;
export type Canal = (typeof CANAIS)[number];
export const CANAL_LABEL: Record<Canal, string> = { texto: "Texto", audio: "Áudio" };

export const PAPEIS = ["lembrete", "beneficio", "prova", "audio", "despedida", "outro"] as const;
export type Papel = (typeof PAPEIS)[number];
export const PAPEL_LABEL: Record<Papel, string> = {
  lembrete: "Lembrete", beneficio: "Benefício", prova: "Prova", audio: "Áudio", despedida: "Despedida", outro: "Outro",
};

export const ACOES = ["recomendada", "copiou", "enviei", "respondeu", "fechou", "perdido", "voltou_fila", "follow_up_agendado", "esfriou"] as const;
export type Acao = (typeof ACOES)[number];

export const VARIAVEIS_RETOMADA = ["nome", "atendente", "plano", "dependentes", "usos", "observacao"] as const;

/** Opções de "Quando retomar" ao adicionar. */
export const QUANDO = [
  { id: "2h", label: "Follow-up em 2h", horas: 2 },
  { id: "3h", label: "3h", horas: 3 },
  { id: "4h", label: "4h", horas: 4 },
  { id: "5h", label: "5h", horas: 5 },
  { id: "amanha", label: "Amanhã (D+1)", horas: null },
] as const;
export type QuandoId = (typeof QUANDO)[number]["id"];

// ---------------------------------------------------------------------------
// Dados vindos do servidor
// ---------------------------------------------------------------------------

export interface Retomada {
  id: string;
  codigo: string;
  primeiro_nome: string;
  telefone: string | null;
  observacao: string;
  ponto_parada: Ponto;
  ponto_parada_inicial: Ponto;
  subetapa_fechamento: string | null;
  fechamento_caso_id: string | null;
  origem: Origem;
  status: StatusRetomada;
  etapa_atual: EtapaRetomada;
  proxima_em: string | null;
  d10_enviado_em: string | null;
  motivo_perda: string | null;
  vezes_voltou: number;
  created_at: string;
  updated_at: string;
}

export interface CadenciaMensagem {
  id: string;
  ponto_parada: PontoCadencia;
  etapa: EtapaRetomada;
  codigo: string;
  canal: Canal;
  papel: Papel;
  texto: string;
  por_que: string;
  audio_exemplo_url: string | null;
  versao: number;
  status: "rascunho" | "publicada";
  publicada_em: string | null;
  updated_at: string;
}

const inArr = <T extends string>(arr: readonly T[], v: unknown, fb: T): T => ((arr as readonly string[]).includes(String(v)) ? (v as T) : fb);

export function toRetomada(r: Record<string, unknown>): Retomada {
  return {
    id: String(r.id),
    codigo: String(r.codigo ?? ""),
    primeiro_nome: String(r.primeiro_nome ?? ""),
    telefone: (r.telefone as string | null) ?? null,
    observacao: String(r.observacao ?? ""),
    ponto_parada: inArr(PONTOS, r.ponto_parada, "nao_respondeu_primeira"),
    ponto_parada_inicial: inArr(PONTOS, r.ponto_parada_inicial, "nao_respondeu_primeira"),
    subetapa_fechamento: (r.subetapa_fechamento as string | null) ?? null,
    fechamento_caso_id: (r.fechamento_caso_id as string | null) ?? null,
    origem: inArr(ORIGENS, r.origem, "manual"),
    status: inArr(STATUS, r.status, "fila"),
    etapa_atual: inArr(ETAPAS_RETOMADA, r.etapa_atual, "d1"),
    proxima_em: (r.proxima_em as string | null) ?? null,
    d10_enviado_em: (r.d10_enviado_em as string | null) ?? null,
    motivo_perda: (r.motivo_perda as string | null) ?? null,
    vezes_voltou: Number(r.vezes_voltou ?? 0),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export function toCadenciaMensagem(r: Record<string, unknown>): CadenciaMensagem {
  return {
    id: String(r.id),
    ponto_parada: inArr(PONTOS_CADENCIA, r.ponto_parada, "follow_up"),
    etapa: inArr(ETAPAS_RETOMADA, r.etapa, "d1"),
    codigo: String(r.codigo ?? ""),
    canal: inArr(CANAIS, r.canal, "texto"),
    papel: inArr(PAPEIS, r.papel, "outro"),
    texto: String(r.texto ?? ""),
    por_que: String(r.por_que ?? ""),
    audio_exemplo_url: (r.audio_exemplo_url as string | null) ?? null,
    versao: Number(r.versao ?? 1),
    status: r.status === "publicada" ? "publicada" : "rascunho",
    publicada_em: (r.publicada_em as string | null) ?? null,
    updated_at: String(r.updated_at ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Datas (fuso de Brasília, sem horário de verão)
// ---------------------------------------------------------------------------

const BRT_MS = 3 * 3600_000;

/** AAAA-MM-DD do dia em Brasília. */
export function diaBR(d: Date | string | number): string {
  return new Date(new Date(d).getTime() - BRT_MS).toISOString().slice(0, 10);
}
/** Instante em que o dia (AAAA-MM-DD, Brasília) começa. */
export function inicioDiaBR(dia: string): Date {
  return new Date(`${dia}T03:00:00.000Z`);
}
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Hora em que as etapas por dia (D+N) ficam "na hora": 09:00 de Brasília. */
export const HORA_ETAPA = 9;
export function diaAs9(dia: string): Date {
  return new Date(inicioDiaBR(dia).getTime() + HORA_ETAPA * 3600_000);
}

export function fmtDiaMes(iso: string | Date): string {
  const [, m, d] = diaBR(iso).split("-");
  return `${d}/${m}`;
}
export function fmtHora(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
export function dataPorExtenso(d = new Date()): string {
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Cadência: próxima etapa e agenda
// ---------------------------------------------------------------------------

/** Depois de "Enviei" na etapa X: qual é a próxima e em quantos dias. D+10 não tem próxima. */
export const PROXIMA_ETAPA: Record<EtapaRetomada, { etapa: EtapaRegua; dias: number } | null> = {
  follow_up: { etapa: "d1", dias: 1 },
  d1: { etapa: "d2", dias: 1 },
  d2: { etapa: "d4", dias: 2 },
  d4: { etapa: "d7", dias: 3 },
  d7: { etapa: "d10", dias: 3 },
  d10: null,
};

/** Quando a próxima etapa fica "na hora", contando a partir de agora. */
export function agendarProxima(etapa: EtapaRetomada, agora = new Date()): { etapa: EtapaRegua; em: Date } | null {
  const p = PROXIMA_ETAPA[etapa];
  if (!p) return null;
  return { etapa: p.etapa, em: diaAs9(somarDias(diaBR(agora), p.dias)) };
}

/** Início do "Quando retomar": horas -> follow-up; senão D+1 amanhã. */
export function agendarInicial(quando: QuandoId, agora = new Date()): { etapa: EtapaRetomada; em: Date } {
  const q = QUANDO.find((x) => x.id === quando) ?? QUANDO[4];
  if (q.horas != null) return { etapa: "follow_up", em: new Date(agora.getTime() + q.horas * 3600_000) };
  return { etapa: "d1", em: diaAs9(somarDias(diaBR(agora), 1)) };
}

export type Grupo = "followup" | "hoje" | "atrasados" | "feitos";

/** Em qual grupo da lista o ticket entra (só tickets na fila com data marcada). */
export function grupoDe(r: Pick<Retomada, "status" | "etapa_atual" | "proxima_em">, agora = new Date()): Grupo | null {
  if (r.status !== "fila" || !r.proxima_em) return null;
  const hoje = diaBR(agora);
  const dia = diaBR(r.proxima_em);
  if (dia < hoje) return "atrasados";
  if (dia > hoje) return null;
  return r.etapa_atual === "follow_up" ? "followup" : "hoje";
}

/** O follow-up de hoje já passou do horário? */
export const followUpVencido = (r: Pick<Retomada, "proxima_em">, agora = new Date()) =>
  !!r.proxima_em && new Date(r.proxima_em).getTime() <= agora.getTime();

// ---------------------------------------------------------------------------
// Mensagem: template + variáveis
// ---------------------------------------------------------------------------

export interface ContextoMensagem {
  nome: string;
  atendente: string;
  caso?: Pick<Caso, "plano" | "dependentes" | "usos"> | null;
  observacao?: string;
}

const listaPt = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

export function textoDeUsos(caso: ContextoMensagem["caso"]): string {
  return listaPt((caso?.usos ?? []).map((u) => (u.rotulo?.trim() ? `${u.nome} (${u.rotulo.trim()})` : u.nome)));
}

/** Preenche {nome} {atendente} {plano} {dependentes} {usos} {observacao}. Variável sem dado fica vazia. */
export function montarMensagem(template: string, c: ContextoMensagem): string {
  const dep = c.caso?.dependentes ?? 0;
  const valores: Record<string, string> = {
    nome: c.nome,
    atendente: c.atendente,
    plano: c.caso?.plano ? PLANO_LABEL[c.caso.plano] : "",
    dependentes: dep > 0 ? `${dep} ${dep === 1 ? "dependente" : "dependentes"}` : "",
    usos: textoDeUsos(c.caso),
    observacao: c.observacao ?? "",
  };
  return template
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in valores ? valores[k] : m))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .trim();
}

/** Mensagem ainda sem texto de verdade ("[escrever]" ou vazia). */
export const semTexto = (t: string) => !t.trim() || /^\[escrever\]$/i.test(t.trim());

// ---------------------------------------------------------------------------
// Telefone (máscara BR) e primeiro nome
// ---------------------------------------------------------------------------

export function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

export const soDigitos = (v: string) => v.replace(/\D/g, "");

export const primeiroNomeDe = (v: string) => v.trim().split(/\s+/)[0] ?? "";
