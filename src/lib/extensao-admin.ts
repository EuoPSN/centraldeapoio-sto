// Admin > Extensão do WhatsApp: tipos, períodos e textos. Sem banco nem servidor.
// Nada aqui recebe conteúdo, nome nem telefone de cliente: só contagens e minutos por atendente.
import { diaBR, inicioDiaBR, somarDias } from "@/lib/retomada";

export type PeriodoExtensao = "semana" | "mes" | "pessoas";
export const PERIODOS_EXTENSAO: { id: PeriodoExtensao; rotulo: string }[] = [
  { id: "semana", rotulo: "Esta semana" },
  { id: "mes", rotulo: "Mês" },
  { id: "pessoas", rotulo: "Pessoas" },
];

export interface Faixa { de: string; ate: string }
export type Horario = Record<string, Faixa[]>;

export const HORARIO_PADRAO: Horario = {
  "0": [],
  "1": [{ de: "08:00", ate: "18:00" }], "2": [{ de: "08:00", ate: "18:00" }], "3": [{ de: "08:00", ate: "18:00" }],
  "4": [{ de: "08:00", ate: "18:00" }], "5": [{ de: "08:00", ate: "18:00" }],
  "6": [{ de: "08:00", ate: "12:00" }],
};

/** Ordem de exibição: segunda a domingo (a chave é o dia da semana, 0 = domingo). */
export const DIAS_SEMANA: { chave: string; nome: string; curto: string }[] = [
  { chave: "1", nome: "Segunda", curto: "seg" }, { chave: "2", nome: "Terça", curto: "ter" }, { chave: "3", nome: "Quarta", curto: "qua" },
  { chave: "4", nome: "Quinta", curto: "qui" }, { chave: "5", nome: "Sexta", curto: "sex" }, { chave: "6", nome: "Sábado", curto: "sáb" },
  { chave: "0", nome: "Domingo", curto: "dom" },
];

export interface ConfigExtensao { meta_minutos: number; nova_conversa_horas: number; horario: Horario }
export const CONFIG_EXTENSAO_PADRAO: ConfigExtensao = { meta_minutos: 5, nova_conversa_horas: 12, horario: HORARIO_PADRAO };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const horaValida = (h: string) => HHMM.test(h);

/** Resumo em uma linha: "Seg a sex, 08:00–18:00 · sáb, 08:00–12:00". */
export function descreverHorario(h: Horario): string {
  const grupos: { dias: string[]; txt: string }[] = [];
  for (const d of DIAS_SEMANA) {
    const txt = (h[d.chave] ?? []).map((f) => `${f.de}–${f.ate}`).join(", ");
    if (!txt) continue;
    const ult = grupos[grupos.length - 1];
    if (ult && ult.txt === txt) ult.dias.push(d.curto); else grupos.push({ dias: [d.curto], txt });
  }
  if (!grupos.length) return "Sem horário de atendimento";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return grupos.map((g, i) => {
    const dias = g.dias.length > 1 ? `${g.dias[0]} a ${g.dias[g.dias.length - 1]}` : g.dias[0];
    return `${i === 0 ? cap(dias) : dias}, ${g.txt}`;
  }).join(" · ");
}

/** Intervalo [ini, fim) em instantes ISO: semana (segunda a hoje), mês (dia 1 em diante) ou todo o histórico. */
export function intervaloDoPeriodo(p: PeriodoExtensao, agora = new Date()): { ini: string; fim: string; de: string; ate: string } {
  const hoje = diaBR(agora);
  let de = hoje;
  if (p === "semana") {
    const dow = new Date(`${hoje}T12:00:00.000Z`).getUTCDay(); // 0 = domingo
    de = somarDias(hoje, -((dow + 6) % 7));
  } else if (p === "mes") de = `${hoje.slice(0, 8)}01`;
  else de = "2024-01-01";
  return { ini: inicioDiaBR(de).toISOString(), fim: inicioDiaBR(somarDias(hoje, 1)).toISOString(), de, ate: hoje };
}

/** "2m 40s" para minutos (decimais). */
export function fmtMinSeg(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(Number(min))) return "—";
  const total = Math.round(Number(min) * 60);
  const m = Math.floor(total / 60), s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export interface LinhaExtensao {
  user_id: string; nome: string; tickets_criados: number; atualizados: number; resposta_media: number | null;
  conversas_novas: number; dentro_da_meta: number; ignorados: number; pausas: number; instalou: boolean; primeiro_evento: string | null;
}

export interface ExtensaoAdminDados {
  periodo: PeriodoExtensao; de: string; ate: string;
  linhas: LinhaExtensao[];
  config: ConfigExtensao;
  equipe: { media_minutos: number | null; ativos: number; total: number };
}

export function resumoEquipe(linhas: LinhaExtensao[]): ExtensaoAdminDados["equipe"] {
  const medias = linhas.filter((l) => l.resposta_media != null).map((l) => Number(l.resposta_media));
  return {
    media_minutos: medias.length ? medias.reduce((a, b) => a + b, 0) / medias.length : null,
    ativos: linhas.filter((l) => l.instalou).length,
    total: linhas.length,
  };
}
