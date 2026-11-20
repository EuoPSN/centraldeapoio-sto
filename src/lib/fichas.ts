import { z } from "zod";
import { removerDadosPessoais } from "@/lib/cliente-disse";
import { PONTOS, PONTO_LABEL, type Ponto } from "@/lib/retomada";

// "Conversas que fecharam" — tipos e regras puras (sem banco nem IA).
// Usado no navegador (Biblioteca, janela da retomada, Admin) e no servidor.
// A conversa bruta nunca passa por aqui depois de mascarada, e nada disto a guarda.

export const PLANOS_FICHA = ["Prata", "Ouro", "Diamante", "outro"] as const;
export type PlanoFicha = (typeof PLANOS_FICHA)[number];

export const STATUS_FICHA = ["enviada", "publicada", "recusada"] as const;
export type StatusFicha = (typeof STATUS_FICHA)[number];
export const STATUS_FICHA_LABEL: Record<StatusFicha, string> = { enviada: "Nova", publicada: "Publicada", recusada: "Recusada" };

/** Janela, em dias, em que o ticket fechado ainda mostra "Enviar conversa para a biblioteca". */
export const DIAS_PARA_ENVIAR = 7;
/** Tamanho máximo do .txt aceito (caracteres). */
export const MAX_CARACTERES_CONVERSA = 600_000;

export const ERRO_FICHA = "Não consegui montar a ficha agora. Tente de novo.";
export const AVISO_PRIVACIDADE_FICHA =
  "A conversa não fica guardada: depois da ficha, o arquivo é descartado. Telefone, CPF, e-mail e falas do cliente não entram.";
export const RODAPE_BIBLIOTECA = "Só a ficha fica guardada. A conversa original, nomes, telefones e falas do cliente não.";

export interface Ficha {
  id: string;
  autor_id: string;
  retomada_id: string | null;
  objecao_id: string | null;
  objecao_rotulo: string;
  ponto_parada: Ponto;
  plano: PlanoFicha;
  perfil_cliente: string;
  onde_travou: string;
  o_que_fez: string[];
  mensagem_chave: string;
  por_que_funcionou: string;
  dias_ate_fechar: number | null;
  fechou_em: string | null;
  status: StatusFicha;
  motivo_recusa: string | null;
  aprovada_por: string | null;
  publicada_em: string | null;
  created_at: string;
  updated_at: string;
}

/** Ficha da Biblioteca: com o nome do autor e o voto da própria pessoa. */
export interface FichaBiblioteca extends Ficha {
  autor: string;
  meu_voto: boolean | null;
}

/** O que a IA devolve e o atendente revisa antes de enviar. */
export interface CamposFicha {
  objecao_id: string | null;
  objecao_rotulo: string;
  ponto_parada: Ponto;
  plano: PlanoFicha;
  perfil_cliente: string;
  onde_travou: string;
  o_que_fez: string[];
  mensagem_chave: string;
  por_que_funcionou: string;
}

export interface FichaGerada extends CamposFicha {
  /** Calculado no código pelas datas da conversa (nunca pela IA). */
  dias_ate_fechar: number | null;
  fechou_em: string | null;
}

const txt = (max: number) => z.string().trim().max(max);

/** Resposta da IA (antes das validações em código). */
export const FichaIASchema = z.object({
  objecao_id: z.string().trim().max(60).nullable().catch(null),
  objecao_rotulo: txt(80).catch(""),
  ponto_parada: z.enum(PONTOS),
  plano: z.enum(PLANOS_FICHA).catch("outro"),
  perfil_cliente: txt(160).catch(""),
  onde_travou: txt(600).min(1),
  o_que_fez: z.array(txt(300).min(1)).min(1).max(6),
  mensagem_chave: txt(1200).min(1),
  por_que_funcionou: txt(600).min(1),
});

/** Campos como o atendente (ou o Admin) os envia/edita. */
export const CamposFichaSchema = z.object({
  objecao_id: z.string().uuid().nullable().default(null),
  objecao_rotulo: txt(120).default(""),
  ponto_parada: z.enum(PONTOS),
  plano: z.enum(PLANOS_FICHA),
  perfil_cliente: txt(160).default(""),
  onde_travou: txt(800).min(1, "Diga onde a cliente travou."),
  o_que_fez: z.array(txt(400).min(1)).min(1, "Conte o que você fez.").max(6),
  mensagem_chave: txt(1500).min(1, "Falta a mensagem-chave."),
  por_que_funcionou: txt(800).default(""),
});

// ---------------------------------------------------------------------------
// Validações em código (depois da IA)
// ---------------------------------------------------------------------------

const ASPAS = /["“”«»„‟]/;

function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

/** Tem telefone, CPF, e-mail ou número longo? */
export function temDadoPessoal(t: string): boolean {
  return removerDadosPessoais(t) !== t;
}

/** Algum dos nomes aparece como palavra inteira? */
export function citaNome(t: string, nomes: readonly string[]): boolean {
  return nomes.some((n) => n.length >= 3 && new RegExp(`(?<![\\p{L}\\d])${escapar(n)}(?![\\p{L}\\d])`, "iu").test(t));
}

/** Corta reticências finais e pontuação solta para comparar uma citação. */
function semReticencias(t: string) {
  return t.replace(/(\.{3}|…)+\s*$/u, "").trim();
}

/** (a) A mensagem-chave existe, depois do mascaramento, dentro de uma mensagem do atendente. */
export function chaveNaConversa(chave: string, textosAtendente: readonly string[]): boolean {
  const c = norm(semReticencias(chave));
  if (c.length < 8) return false;
  return textosAtendente.some((m) => norm(m).includes(c));
}

/**
 * Confere uma ficha gerada. Devolve os problemas (vazio = ok).
 * `textosAtendente`: mensagens do atendente já mascaradas; sem elas, (a) não é conferida
 * (acontece só na edição do atendente, quando a conversa já foi descartada).
 */
export function validarFicha(
  f: CamposFicha,
  opts: { nomes: readonly string[]; textosAtendente?: readonly string[] },
): string[] {
  const problemas: string[] = [];
  const campos: [string, string][] = [
    ["objecao_rotulo", f.objecao_rotulo], ["perfil_cliente", f.perfil_cliente], ["onde_travou", f.onde_travou],
    ["o_que_fez", f.o_que_fez.join("\n")], ["mensagem_chave", f.mensagem_chave], ["por_que_funcionou", f.por_que_funcionou],
  ];
  if (opts.textosAtendente && !chaveNaConversa(f.mensagem_chave, opts.textosAtendente)) problemas.push("mensagem_chave_nao_encontrada");
  for (const [nome, valor] of campos) {
    if (temDadoPessoal(valor)) problemas.push(`dado_pessoal:${nome}`);
    if (citaNome(valor, opts.nomes)) problemas.push(`nome_cliente:${nome}`);
  }
  if (ASPAS.test(f.onde_travou)) problemas.push("citacao_na_fala_do_cliente");
  return problemas;
}

/** Dias corridos entre a primeira e a última mensagem (datas, sem horas). */
export function diasEntre(primeiraEm: number | null, ultimaEm: number | null): number | null {
  if (primeiraEm == null || ultimaEm == null || ultimaEm < primeiraEm) return null;
  const dia = (ms: number) => Math.floor(ms / 86_400_000);
  return dia(ultimaEm) - dia(primeiraEm);
}

export function dataISO(ms: number | null): string | null {
  if (ms == null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Texto das fichas
// ---------------------------------------------------------------------------

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** "Dúvida de preço virou fechamento em 2 dias". */
export function tituloFicha(f: Pick<Ficha, "objecao_rotulo" | "ponto_parada" | "dias_ate_fechar">): string {
  const base = f.objecao_rotulo.trim() || PONTO_LABEL[f.ponto_parada];
  const quando = f.dias_ate_fechar == null ? "" : f.dias_ate_fechar === 0 ? " no mesmo dia" : ` em ${f.dias_ate_fechar} ${plural(f.dias_ate_fechar, "dia", "dias")}`;
  return `${base} virou fechamento${quando}`;
}

/** Linha de apoio da lista: "Objeção: está caro · Recebeu a proposta · Prata". */
export function resumoFicha(f: Pick<Ficha, "objecao_rotulo" | "ponto_parada" | "plano">): string {
  return [f.objecao_rotulo.trim() ? `Objeção: ${f.objecao_rotulo.trim().toLowerCase()}` : "", PONTO_LABEL[f.ponto_parada], f.plano === "outro" ? "" : f.plano]
    .filter(Boolean).join(" · ");
}

export function diasLabel(n: number | null): string {
  if (n == null) return "";
  return n === 0 ? "No mesmo dia" : `${n} ${plural(n, "dia", "dias")}`;
}

export function dataCurta(iso: string | null): string {
  if (!iso) return "";
  const [, m, d] = iso.slice(0, 10).split("-");
  return d && m ? `${d}/${m}` : "";
}

/** Passos numerados em um texto só (e de volta), para editar em um campo. */
export function passosParaTexto(passos: readonly string[]): string {
  return passos.map((p, i) => `${i + 1}. ${p}`).join("\n");
}
export function textoParaPassos(t: string): string[] {
  return t
    .split(/\n+|(?<=[.!?])\s+(?=\d+[.)]\s)/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

// Filtro "Perfil" da Biblioteca: etiquetas simples achadas no texto do perfil.
export const PERFIL_TAGS = [
  { id: "familia", label: "Família", re: /fam[ií]lia|dependente/i },
  { id: "casal", label: "Casal", re: /casal/i },
  { id: "sozinho", label: "Uma pessoa", re: /uma pessoa|sozinh|individual/i },
  { id: "idoso", label: "Com idoso", re: /idos/i },
  { id: "criancas", label: "Com crianças", re: /filh|crian|beb[eê]/i },
] as const;
export type PerfilTagId = (typeof PERFIL_TAGS)[number]["id"];
export function perfilTags(perfil: string): PerfilTagId[] {
  return PERFIL_TAGS.filter((t) => t.re.test(perfil)).map((t) => t.id);
}

// ---------------------------------------------------------------------------
// Conversão de linhas do banco
// ---------------------------------------------------------------------------

const inArr = <T extends string>(arr: readonly T[], v: unknown, fb: T): T => ((arr as readonly string[]).includes(String(v)) ? (v as T) : fb);

export function toFicha(r: Record<string, unknown>): Ficha {
  return {
    id: String(r.id),
    autor_id: String(r.autor_id),
    retomada_id: (r.retomada_id as string | null) ?? null,
    objecao_id: (r.objecao_id as string | null) ?? null,
    objecao_rotulo: String(r.objecao_rotulo ?? ""),
    ponto_parada: inArr(PONTOS, r.ponto_parada, "recebeu_proposta"),
    plano: inArr(PLANOS_FICHA, r.plano, "outro"),
    perfil_cliente: String(r.perfil_cliente ?? ""),
    onde_travou: String(r.onde_travou ?? ""),
    o_que_fez: Array.isArray(r.o_que_fez) ? (r.o_que_fez as unknown[]).map(String) : [],
    mensagem_chave: String(r.mensagem_chave ?? ""),
    por_que_funcionou: String(r.por_que_funcionou ?? ""),
    dias_ate_fechar: r.dias_ate_fechar == null ? null : Number(r.dias_ate_fechar),
    fechou_em: (r.fechou_em as string | null) ?? null,
    status: inArr(STATUS_FICHA, r.status, "enviada"),
    motivo_recusa: (r.motivo_recusa as string | null) ?? null,
    aprovada_por: (r.aprovada_por as string | null) ?? null,
    publicada_em: (r.publicada_em as string | null) ?? null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}
