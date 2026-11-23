// Cálculo do tempo de primeira resposta. Funções PURAS (testáveis); o service worker só liga
// estas funções ao armazenamento local e ao backend. Brasília = UTC-3 fixo (sem horário de verão).
import type { ItemLista } from "../content/lista";

const BRT_MS = 3 * 3600_000;
const MIN = 60_000;

export interface Faixa { de: string; ate: string }
export type Horario = Record<string, Faixa[]>;
export interface ConfigTempo { meta_minutos: number; nova_conversa_horas: number; horario: Horario }

export const HORARIO_PADRAO: Horario = {
  "0": [],
  "1": [{ de: "08:00", ate: "18:00" }], "2": [{ de: "08:00", ate: "18:00" }], "3": [{ de: "08:00", ate: "18:00" }],
  "4": [{ de: "08:00", ate: "18:00" }], "5": [{ de: "08:00", ate: "18:00" }],
  "6": [{ de: "08:00", ate: "12:00" }],
};
export const CONFIG_PADRAO: ConfigTempo = { meta_minutos: 5, nova_conversa_horas: 12, horario: HORARIO_PADRAO };

const aMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

/** Dia (AAAA-MM-DD) em Brasília. */
export function diaBR(ms: number): string { return new Date(ms - BRT_MS).toISOString().slice(0, 10); }

/** Minutos dentro do horário de atendimento entre dois instantes (ms). Soma por dia, em horário de Brasília. */
export function minutosUteis(iniMs: number, fimMs: number, horario: Horario): number {
  if (!(fimMs > iniMs)) return 0;
  const ini = Math.max(iniMs, fimMs - 60 * 86400_000); // trava: no máximo 60 dias
  let total = 0;
  // meia-noite de Brasília do primeiro dia, em ms "relógio de parede" (UTC deslocado)
  const iniLocal = ini - BRT_MS, fimLocal = fimMs - BRT_MS;
  const primeiroDia = Math.floor(iniLocal / 86400_000) * 86400_000;
  for (let dia = primeiroDia; dia <= fimLocal; dia += 86400_000) {
    const dow = new Date(dia).getUTCDay(); // 0 = domingo
    for (const f of horario[String(dow)] ?? []) {
      const de = dia + aMin(f.de) * MIN, ate = dia + aMin(f.ate) * MIN;
      const a = Math.max(de, iniLocal), b = Math.min(ate, fimLocal);
      if (b > a) total += (b - a) / MIN;
    }
  }
  return Math.round(total * 100) / 100;
}

/** Valida/normaliza o horário vindo do backend; qualquer coisa estranha volta ao padrão. */
export function horarioValido(h: unknown): Horario {
  if (!h || typeof h !== "object") return HORARIO_PADRAO;
  const out: Horario = {};
  for (let d = 0; d < 7; d++) {
    const faixas = (h as Record<string, unknown>)[String(d)];
    if (!Array.isArray(faixas)) { out[String(d)] = []; continue; }
    out[String(d)] = faixas
      .filter((f): f is Faixa => !!f && typeof f.de === "string" && typeof f.ate === "string" && /^\d{2}:\d{2}$/.test(f.de) && /^\d{2}:\d{2}$/.test(f.ate) && aMin(f.ate) > aMin(f.de));
  }
  return out;
}

/** "14:32" de hoje (Brasília) → instante em ms; nulo se estiver no futuro (provável "ontem") ou inválido. */
export function horaDeHoje(hhmm: string | null, agoraMs: number): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  const meiaNoite = Date.parse(`${diaBR(agoraMs)}T00:00:00.000Z`) + BRT_MS;
  const t = meiaNoite + (h * 60 + mi) * MIN;
  return t > agoraMs + 2 * MIN ? null : t; // tolera 2 min de relógio
}

/** Mensagem automática ou de bot? Só padrões FORTES na prévia; se não der para ter certeza, é humana
 * (limitação documentada: a lista não mostra quem enviou, só o texto). */
const PADROES_AUTOMATICA = [
  /mensagem autom[aá]tica/i,
  /resposta autom[aá]tica/i,
  /este [eé] um atendimento autom[aá]tico/i,
  /no momento n[aã]o (estamos|podemos) (atend|respond)/i,
  /fora do (nosso )?hor[aá]rio de atendimento/i,
  /nosso hor[aá]rio de atendimento [eé]/i,
  /digite (o n[uú]mero|a op[cç][aã]o)/i,
  /^\s*\*?(menu|op[cç][oõ]es)\*?\s*:?\s*$/i,
];
export function pareceAutomatica(previa: string): boolean {
  return PADROES_AUTOMATICA.some((re) => re.test(previa ?? ""));
}

// ---------------------------------------------------------------------------
// Estado por conversa (guardado só no navegador, indexado pela chave em hash)
// ---------------------------------------------------------------------------
export interface EstadoChat {
  /** Última mensagem vista (qualquer direção), em ms. */
  atividade: number;
  /** Início da conversa nova que ainda espera resposta (primeira mensagem do cliente), em ms. */
  aguarda: number | null;
}
export type Estado = Record<string, EstadoChat>;

export interface ItemChave extends ItemLista { chave: string }

export interface Registro {
  chave: string;
  inicio: number;
  /** null = ainda sem resposta (linha nova). */
  resposta: number | null;
  minutos: number | null;
  dentro: boolean | null;
}

export interface Espera { chave: string; nome: string; previa: string; inicio: number }

export interface Resultado { estado: Estado; registros: Registro[]; espera: Espera[] }

const RETENCAO_MS = 3 * 86400_000;

/** Aplica uma varredura ao estado. `itens` já vêm sem grupos/ignorados e com a chave em hash. */
export function processarVarredura(estado: Estado, itens: ItemChave[], agoraMs: number, cfg: ConfigTempo): Resultado {
  const novo: Estado = {};
  for (const [k, v] of Object.entries(estado)) if (agoraMs - v.atividade < RETENCAO_MS || v.aguarda) novo[k] = { ...v };
  const registros: Registro[] = [];
  const limiteNova = cfg.nova_conversa_horas * 3600_000;

  for (const it of itens) {
    const t = horaDeHoje(it.hora, agoraMs);
    const s = novo[it.chave];
    if (t === null) continue; // "ontem", data ou horário inválido: não dá para medir com segurança
    if (it.direcao === "cliente") {
      if (!s) {
        novo[it.chave] = { atividade: t, aguarda: t };
        registros.push({ chave: it.chave, inicio: t, resposta: null, minutos: null, dentro: null });
      } else if (s.aguarda !== null) {
        s.atividade = Math.max(s.atividade, t); // várias seguidas: o relógio continua na primeira
      } else if (t > s.atividade) {
        const nova = t - s.atividade >= limiteNova;
        s.atividade = t;
        if (nova) {
          s.aguarda = t;
          registros.push({ chave: it.chave, inicio: t, resposta: null, minutos: null, dentro: null });
        }
      }
    } else {
      if (!s) { novo[it.chave] = { atividade: t, aguarda: null }; continue; }
      if (s.aguarda !== null && t >= s.aguarda && !pareceAutomatica(it.previa)) {
        const min = minutosUteis(s.aguarda, t, cfg.horario);
        registros.push({ chave: it.chave, inicio: s.aguarda, resposta: t, minutos: min, dentro: min <= cfg.meta_minutos });
        s.aguarda = null;
      }
      s.atividade = Math.max(s.atividade, t);
    }
  }

  const porChave = new Map(itens.map((i) => [i.chave, i]));
  const espera: Espera[] = [];
  for (const [chave, s] of Object.entries(novo)) {
    if (s.aguarda === null) continue;
    const it = porChave.get(chave);
    if (!it || it.direcao !== "cliente") continue; // só o que está na tela agora, ainda aguardando
    if (minutosUteis(s.aguarda, agoraMs, cfg.horario) > cfg.meta_minutos) espera.push({ chave, nome: it.nome, previa: it.previa, inicio: s.aguarda });
  }
  espera.sort((a, b) => a.inicio - b.inicio);
  return { estado: novo, registros, espera };
}

/** "3 min 20 s" para um valor em minutos. */
export function formatarMinutos(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return "—";
  const total = Math.round(min * 60);
  const m = Math.floor(total / 60), s = total % 60;
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}
