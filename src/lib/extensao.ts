import { z } from "zod";
import { ETAPAS_FUNIL, ETAPA_FUNIL_NOME, limparTrecho } from "@/lib/cerebro";
import { PONTOS, QUANDO } from "@/lib/retomada";
import type { Ponto } from "@/lib/retomada";
import { LIMITE_MENSAGENS, chaveNumero, mesmoNumero, removerDadosPessoais, trocarNome } from "@/lib/extensao-sanitizar";

// Extensão do Chrome (WhatsApp Web): tipos e esquemas compartilhados entre as rotas
// /api/extensao/* e os testes. Sem acesso a banco nem IA aqui.

export const PLANOS_EXT = ["Prata", "Ouro", "Diamante"] as const;
export const QUANDO_IDS = QUANDO.map((q) => q.id) as [string, ...string[]];

/** Entrada de "Ler conversa": SÓ texto já sanitizado + direção + horário. Nada de telefone. */
export const LerConversaEntrada = z.object({
  mensagens: z.array(z.object({
    de: z.enum(["cliente", "atendente"]),
    texto: z.string().max(2000),
    hora: z.string().max(8).optional(),
  })).min(1).max(LIMITE_MENSAGENS * 2),
});
export type LerConversaEntradaT = z.infer<typeof LerConversaEntrada>;

/** Resposta da IA (antes das travas do servidor). */
export const PropostaIA = z.object({
  etapa_funil: z.enum(ETAPAS_FUNIL),
  venda_explicita: z.boolean().default(false),
  evidencia_venda: z.string().max(300).default(""),
  ponto_parada: z.enum(PONTOS),
  plano: z.string().nullish().transform((v) => {
    const t = (v ?? "").trim().toLowerCase();
    return PLANOS_EXT.find((p) => p.toLowerCase() === t) ?? "";
  }),
  dependentes: z.union([z.number(), z.string(), z.null()]).optional().transform((v) => {
    if (v == null || v === "") return null;
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 && n <= 20 ? n : null;
  }),
  observacao: z.string().default(""),
  quando_retomar: z.string().default("amanha").transform((v) => (QUANDO_IDS.includes(v) ? v : "amanha")),
  objecoes_detectadas: z.array(z.string()).default([]).transform((a) => a.map((x) => x.trim().slice(0, 80)).filter(Boolean).slice(0, 5)),
});

export interface Proposta {
  etapa_funil: (typeof ETAPAS_FUNIL)[number];
  ponto_parada: (typeof PONTOS)[number];
  plano: "" | (typeof PLANOS_EXT)[number];
  dependentes: number | null;
  observacao: string;
  quando_retomar: string;
  objecoes_detectadas: string[];
}

export const ERRO_LER = "Não consegui ler esta conversa agora. Tente de novo em instantes.";

/** Valida a resposta da IA e aplica as travas do servidor (venda concluída, observação sem dado pessoal). */
export function tentarProposta(raw: unknown, transcricao: string, nome: string | undefined): Proposta | null {
  const r = PropostaIA.safeParse(raw);
  if (!r.success) return null;
  const d = r.data;
  let etapa = d.etapa_funil;
  if (etapa === "venda_concluida") {
    // Travas: só vale com confirmação explícita E a frase citada existe na conversa.
    const ev = d.evidencia_venda.trim().toLowerCase();
    const achou = ev.length >= 6 && transcricao.toLowerCase().includes(ev);
    if (!d.venda_explicita || !achou) etapa = "fechamento";
  }
  let obs = limparTrecho(trocarNome(d.observacao, nome), nome ?? null)
    .replace(/n[ãa]o [ée] plano de sa[úu]de/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (obs.length > 200) obs = obs.slice(0, 199).replace(/\s+\S*$/, "") + "…";
  return {
    etapa_funil: etapa, ponto_parada: d.ponto_parada, plano: d.plano as Proposta["plano"],
    dependentes: d.dependentes, observacao: obs, quando_retomar: d.quando_retomar, objecoes_detectadas: d.objecoes_detectadas,
  };
}

// ---------------------------------------------------------------------------
// Ticket: criar ou atualizar
// ---------------------------------------------------------------------------

export type EtapaFunilCod = (typeof ETAPAS_FUNIL)[number];

/** Campos do ticket que a extensão confere e salva. */
export const CamposTicket = z.object({
  etapa_funil: z.enum(ETAPAS_FUNIL),
  ponto_parada: z.enum(PONTOS),
  plano: z.string().nullish().transform((v) => PLANOS_EXT.find((p) => p.toLowerCase() === (v ?? "").trim().toLowerCase()) ?? ""),
  dependentes: z.union([z.number(), z.string(), z.null()]).optional().transform((v) => {
    if (v == null || v === "") return null;
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 && n <= 20 ? n : null;
  }),
  observacao: z.string().max(600).default("").transform((v) => removerDadosPessoais(v).trim().slice(0, 500)),
  quando: z.enum(QUANDO_IDS).default("amanha"),
});
export type CamposTicketT = z.infer<typeof CamposTicket>;

export const ConsultarTicketEntrada = z.object({
  op: z.literal("consultar"),
  numero: z.string().max(40).default(""),
});

export const SalvarTicketEntrada = z.object({
  op: z.literal("salvar"),
  /** Número (só dígitos ou formatado) da conversa aberta. Vai só para o ticket, nunca para a IA. */
  numero: z.string().max(40).default(""),
  /** Nome exibido do contato: vira o primeiro nome do ticket. */
  nome: z.string().max(120).default(""),
  campos: CamposTicket,
});
export type SalvarTicketEntradaT = z.infer<typeof SalvarTicketEntrada>;

export const TicketEntrada = z.discriminatedUnion("op", [ConsultarTicketEntrada, SalvarTicketEntrada]);

/** O ticket como a extensão enxerga (sem telefone). */
export interface TicketDTO {
  id: string;
  codigo: string;
  primeiro_nome: string;
  etapa_funil: EtapaFunilCod | null;
  ponto_parada: Ponto;
  plano: string | null;
  dependentes: number | null;
  observacao: string;
  status: string;
  etapa_atual: string;
  proxima_em: string | null;
  created_at: string;
  updated_at: string;
}

export const CAMPOS_HISTORICO = ["etapa_funil", "ponto_parada", "plano", "dependentes", "observacao", "retomar"] as const;
export type CampoHistorico = (typeof CAMPOS_HISTORICO)[number];
export interface Mudanca { campo: CampoHistorico; de: string | null; para: string | null }

const txt = (v: unknown): string | null => {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
};

/** Diferenças entre o ticket que existe e o que será salvo (uma por campo que mudou).
 * `retomarNovo`/`retomarAtual` são as datas (ISO) de quando retomar. */
export function calcularMudancas(
  atual: Pick<TicketDTO, "etapa_funil" | "ponto_parada" | "plano" | "dependentes" | "observacao" | "proxima_em">,
  novo: { etapa_funil: string; ponto_parada: string; plano: string; dependentes: number | null; observacao: string },
  retomarNovo: string | null,
): Mudanca[] {
  const out: Mudanca[] = [];
  const pares: [CampoHistorico, unknown, unknown][] = [
    ["etapa_funil", atual.etapa_funil, novo.etapa_funil],
    ["ponto_parada", atual.ponto_parada, novo.ponto_parada],
    ["plano", atual.plano, novo.plano],
    ["dependentes", atual.dependentes, novo.dependentes],
    ["observacao", atual.observacao, novo.observacao],
  ];
  for (const [campo, a, b] of pares) {
    if (txt(a) !== txt(b)) out.push({ campo, de: txt(a), para: txt(b) });
  }
  if (retomarNovo && txt(atual.proxima_em) !== retomarNovo) out.push({ campo: "retomar", de: txt(atual.proxima_em), para: retomarNovo });
  return out;
}

/** Acha, entre os tickets abertos do atendente, o que tem o mesmo número (por formato normalizado). */
export function acharTicketDoNumero<T extends { telefone: string | null }>(tickets: T[], numero: string): T | null {
  if (!chaveNumero(numero)) return null;
  return tickets.find((t) => !!t.telefone && mesmoNumero(t.telefone, numero)) ?? null;
}

// ---------------------------------------------------------------------------
// "O cliente disse…" no painel
// ---------------------------------------------------------------------------

export const ClienteDisseEntrada = z.discriminatedUnion("op", [
  z.object({ op: z.literal("responder"), fala: z.string().max(2000), ponto: z.enum(PONTOS).nullish() }),
  z.object({ op: z.literal("copiou"), objecao_id: z.string().uuid(), angulo: z.string().max(40).nullish() }),
]);

export interface ClienteDisseResposta {
  /** O que a fala do cliente foi: objeções, sinais de compra ou travamentos já aprovados. */
  itens: { tipo: "objecao" | "sinal" | "travamento"; id: string; nome: string }[];
  /** Objeção principal, com o conteúdo aprovado (ou sugestão da IA, quando `sugestao_ia`). */
  objecao: {
    id: string | null; nome: string; sugestao_ia: boolean;
    leituras: { titulo: string; pergunta: string }[];
    angulos: { tipo: string; rotulo: string; texto: string }[];
    pergunta_avancar: string | null; evite_dizer: string | null;
  } | null;
  /** Mensagem pronta de um sinal de compra ou travamento (quando não há objeção). */
  item_mensagem: { titulo: string; mensagem: string | null; passos: string[] } | null;
  casos: { titulo: string; mensagem_chave: string; por_que_funcionou: string; dias_ate_fechar: number | null }[];
}

export { ETAPAS_FUNIL, ETAPA_FUNIL_NOME };
