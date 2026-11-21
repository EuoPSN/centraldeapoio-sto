// Rótulos em português para os códigos do ticket (iguais aos da Omnia).
export const ETAPAS_FUNIL = ["novo_lead", "lead_qualificado", "proposta_enviada", "fechamento", "venda_concluida"] as const;
export type EtapaFunil = (typeof ETAPAS_FUNIL)[number];
export const ETAPA_NOME: Record<EtapaFunil, string> = {
  novo_lead: "Novo lead",
  lead_qualificado: "Lead qualificado",
  proposta_enviada: "Proposta enviada",
  fechamento: "Fechamento",
  venda_concluida: "Venda concluída",
};

export const PONTOS = ["nao_respondeu_primeira", "parou_explicativa", "recebeu_proposta", "travou_fechamento"] as const;
export type Ponto = (typeof PONTOS)[number];
export const PONTO_NOME: Record<Ponto, string> = {
  nao_respondeu_primeira: "Não respondeu a 1ª mensagem",
  parou_explicativa: "Parou na explicativa",
  recebeu_proposta: "Recebeu a proposta",
  travou_fechamento: "Travou no fechamento",
};
export const PONTO_CURTO: Record<Ponto, string> = {
  nao_respondeu_primeira: "Não respondeu a 1ª",
  parou_explicativa: "Parou na explicativa",
  recebeu_proposta: "Recebeu a proposta",
  travou_fechamento: "Travou no fechamento",
};

export const PLANOS = ["Prata", "Ouro", "Diamante"] as const;

export const QUANDO = [
  { id: "2h", horas: 2 },
  { id: "3h", horas: 3 },
  { id: "4h", horas: 4 },
  { id: "5h", horas: 5 },
  { id: "amanha", horas: null },
] as const;
export type QuandoId = (typeof QUANDO)[number]["id"];

const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "Follow-up em 2h · hoje, 17:15" / "Amanhã (D+1) · 09:00". */
export function rotuloQuando(id: string, agora = new Date()): string {
  const q = QUANDO.find((x) => x.id === id);
  if (!q) return id;
  if (q.horas != null) return `Follow-up em ${q.horas}h · hoje, ${hora(new Date(agora.getTime() + q.horas * 3600_000))}`;
  return "Amanhã (D+1) · 09:00";
}

export function rotuloCampo(campo: string): string {
  return ({ etapa_funil: "Etapa do funil", ponto_parada: "Ponto de parada", plano: "Plano", dependentes: "Dependentes", observacao: "Observação", retomar: "Retomar", status: "Situação" } as Record<string, string>)[campo] ?? campo;
}

/** Valor de um campo do ticket como o atendente lê. */
export function rotuloValor(campo: string, v: string | null): string {
  if (v == null || v === "") return "—";
  if (campo === "etapa_funil") return ETAPA_NOME[v as EtapaFunil] ?? v;
  if (campo === "ponto_parada") return PONTO_NOME[v as Ponto] ?? v;
  if (campo === "retomar") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora(d)}`;
  }
  if (campo === "status") return v === "fila" ? "Na fila" : v === "respondeu" ? "Respondeu" : v;
  return v;
}

export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
