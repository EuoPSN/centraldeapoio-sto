import { z } from "zod";
import { ETAPAS_FUNIL, ETAPA_FUNIL_NOME, limparTrecho } from "@/lib/cerebro";
import { PONTOS, QUANDO } from "@/lib/retomada";
import { LIMITE_MENSAGENS, trocarNome } from "@/lib/extensao-sanitizar";

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
  /** Nome exibido do contato: usado só para trocar por [nome]; nunca vai para a IA nem é guardado. */
  nome: z.string().max(120).optional(),
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

export { ETAPAS_FUNIL, ETAPA_FUNIL_NOME };
