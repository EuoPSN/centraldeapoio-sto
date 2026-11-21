// Aba "Hoje": quais tickets do atendente entram e como o prazo aparece.
// Datas no fuso de Brasília (sem horário de verão), como o Retomar hoje da Omnia.

const BRT_MS = 3 * 3600_000;

export function diaBR(d: Date | string | number): string {
  return new Date(new Date(d).getTime() - BRT_MS).toISOString().slice(0, 10);
}
export function inicioDiaBR(dia: string): Date {
  return new Date(`${dia}T03:00:00.000Z`);
}

export interface TicketHoje {
  id: string;
  primeiro_nome: string;
  status: string;
  etapa_atual: string;
  proxima_em: string | null;
  etapa_funil: string | null;
  ponto_parada: string;
  plano: string | null;
  updated_at: string;
}

export type GrupoHoje = "atrasado" | "hoje" | "followup";

/** Só tickets na fila com data marcada: atrasados, de hoje e follow-ups de hoje. */
export function grupoDoTicket(t: Pick<TicketHoje, "status" | "etapa_atual" | "proxima_em">, agora = new Date()): GrupoHoje | null {
  if (t.status !== "fila" || !t.proxima_em) return null;
  const hoje = diaBR(agora);
  const dia = diaBR(t.proxima_em);
  if (dia < hoje) return "atrasado";
  if (dia > hoje) return null;
  return t.etapa_atual === "follow_up" ? "followup" : "hoje";
}

const ETAPA_CURTA: Record<string, string> = { follow_up: "Follow-up", d1: "D+1", d2: "D+2", d4: "D+4", d7: "D+7", d10: "D+10" };

/** "Hoje 19:00", "Agora", "D+1", "Atrasado · D+2". */
export function rotuloPrazo(t: Pick<TicketHoje, "etapa_atual" | "proxima_em">, agora = new Date()): string {
  const g = grupoDoTicket({ status: "fila", etapa_atual: t.etapa_atual, proxima_em: t.proxima_em }, agora);
  const etapa = ETAPA_CURTA[t.etapa_atual] ?? t.etapa_atual;
  if (g === "atrasado") return `Atrasado · ${etapa}`;
  if (g === "followup" && t.proxima_em) {
    const quando = new Date(t.proxima_em);
    if (quando.getTime() <= agora.getTime()) return "Agora";
    return `Hoje ${quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`;
  }
  return etapa;
}

export interface ResumoHoje {
  paraHoje: TicketHoje[];
  atualizadosHoje: number;
}

/** Monta a lista (atrasados primeiro, depois por horário) e o contador de atualizados hoje. */
export function resumirHoje(tickets: TicketHoje[], agora = new Date()): ResumoHoje {
  const paraHoje = tickets
    .filter((t) => grupoDoTicket(t, agora) !== null)
    .sort((a, b) => {
      const ga = grupoDoTicket(a, agora) === "atrasado" ? 0 : 1;
      const gb = grupoDoTicket(b, agora) === "atrasado" ? 0 : 1;
      return ga - gb || new Date(a.proxima_em!).getTime() - new Date(b.proxima_em!).getTime();
    });
  const inicio = inicioDiaBR(diaBR(agora)).getTime();
  const atualizadosHoje = tickets.filter((t) => new Date(t.updated_at).getTime() >= inicio).length;
  return { paraHoje, atualizadosHoje };
}
