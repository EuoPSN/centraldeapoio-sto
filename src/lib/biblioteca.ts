import { z } from "zod";
import { removerDadosPessoais } from "@/lib/cliente-disse";
import { PONTOS, PONTO_LABEL, type Ponto } from "@/lib/retomada";

// Biblioteca > "Conversas que fecharam" — tipos, rótulos e validações (sem banco nem IA).
// Usado no navegador (janela de envio, Biblioteca, Admin) e no servidor.
//
// A conversa bruta nunca é guardada: o arquivo é lido no navegador, mascarado, enviado
// para a função de servidor, processado em memória e descartado.

export const PLANOS_FICHA = ["Prata", "Ouro", "Diamante", "outro"] as const;
export type PlanoFicha = (typeof PLANOS_FICHA)[number];
export const STATUS_FICHA = ["enviada", "publicada", "recusada"] as const;
export type StatusFicha = (typeof STATUS_FICHA)[number];
export const STATUS_FICHA_LABEL: Record<StatusFicha, string> = { enviada: "Nova", publicada: "Publicada", recusada: "Recusada" };

export const ERRO_FICHA = "Não consegui montar a ficha agora. Tente de novo.";
export const AVISO_PRIVACIDADE_FICHA =
  "A conversa não fica guardada: depois da ficha, o arquivo é descartado. Telefone, CPF, e-mail e falas do cliente não entram.";
export const RODAPE_BIBLIOTECA = "Só a ficha fica guardada. A conversa original, nomes, telefones e falas do cliente não.";

/** Dias depois do fechamento em que o ticket ainda oferece "Enviar conversa para a biblioteca". */
export const DIAS_PARA_ENVIAR = 7;

export interface FichaCampos {
  objecao_id: string | null;
  objecao_rotulo: string;
  titulo: string;
  ponto_parada: Ponto;
  plano: PlanoFicha;
  perfil_cliente: string;
  onde_travou: string;
  o_que_fez: string[];
  mensagem_chave: string;
  por_que_funcionou: string;
  dias_ate_fechar: number | null;
  fechou_em: string | null;
}

export interface Ficha extends FichaCampos {
  id: string;
  autor_id: string;
  autor_nome: string;
  retomada_id: string | null;
  status: StatusFicha;
  motivo_recusa: string | null;
  aprovada_por: string | null;
  publicada_em: string | null;
  created_at: string;
  updated_at: string;
}

/** Ficha publicada como a Biblioteca mostra (sem dados de aprovação). */
export interface FichaPublica extends FichaCampos {
  id: string;
  autor_nome: string;
  publicada_em: string | null;
  /** Voto da própria pessoa: true 👍, false 👎, null ainda não votou. */
  meu_voto: boolean | null;
}

export function toFicha(r: Record<string, unknown>, autor_nome = ""): Ficha {
  return {
    id: String(r.id),
    autor_id: String(r.autor_id),
    autor_nome,
    retomada_id: (r.retomada_id as string | null) ?? null,
    objecao_id: (r.objecao_id as string | null) ?? null,
    objecao_rotulo: String(r.objecao_rotulo ?? ""),
    titulo: String(r.titulo ?? ""),
    ponto_parada: (PONTOS as readonly string[]).includes(String(r.ponto_parada)) ? (r.ponto_parada as Ponto) : "recebeu_proposta",
    plano: (PLANOS_FICHA as readonly string[]).includes(String(r.plano)) ? (r.plano as PlanoFicha) : "outro",
    perfil_cliente: String(r.perfil_cliente ?? ""),
    onde_travou: String(r.onde_travou ?? ""),
    o_que_fez: Array.isArray(r.o_que_fez) ? (r.o_que_fez as unknown[]).map(String) : [],
    mensagem_chave: String(r.mensagem_chave ?? ""),
    por_que_funcionou: String(r.por_que_funcionou ?? ""),
    dias_ate_fechar: typeof r.dias_ate_fechar === "number" ? r.dias_ate_fechar : null,
    fechou_em: (r.fechou_em as string | null) ?? null,
    status: (STATUS_FICHA as readonly string[]).includes(String(r.status)) ? (r.status as StatusFicha) : "enviada",
    motivo_recusa: (r.motivo_recusa as string | null) ?? null,
    aprovada_por: (r.aprovada_por as string | null) ?? null,
    publicada_em: (r.publicada_em as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Texto das fichas
// ---------------------------------------------------------------------------

export function diasLabel(d: number | null): string {
  if (d == null) return "";
  return d === 0 ? "Fechou no mesmo dia" : `Fechou em ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Título padrão da ficha (o Admin pode editar). */
export function montarTitulo(f: { objecao_rotulo: string; ponto_parada: Ponto; dias_ate_fechar: number | null }): string {
  const dias = f.dias_ate_fechar;
  const prazo = dias == null ? "" : dias === 0 ? " no mesmo dia" : ` em ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const obj = f.objecao_rotulo.trim();
  if (obj) return `${obj.charAt(0).toUpperCase()}${obj.slice(1)} virou fechamento${prazo}`;
  return `${PONTO_LABEL[f.ponto_parada]} virou fechamento${prazo}`;
}

/** Resumo de uma linha (o que a vendedora fez). */
export function resumoFicha(f: Pick<FichaCampos, "o_que_fez" | "por_que_funcionou">): string {
  const p = f.o_que_fez[0]?.trim();
  return p || f.por_que_funcionou.trim();
}

export function dataCurta(iso: string | null): string {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-") : null;
  if (d) return `${d[2]}/${d[1]}`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ---------------------------------------------------------------------------
// Entrada: mensagens já mascaradas no navegador
// ---------------------------------------------------------------------------

export const MensagemFichaZ = z.object({
  de: z.enum(["cliente", "atendente", "pessoa"]),
  texto: z.string().max(1200),
  em: z.string().max(40),
});
export type MensagemFicha = z.infer<typeof MensagemFichaZ>;

export const MARCADOR_NOME = "[nome]";

/** Máscara aplicada de novo no servidor (o navegador já fez a primeira): dados pessoais e nomes conhecidos. */
export function mascarar(texto: string, nomes: readonly string[]): string {
  let t = removerDadosPessoais(texto);
  for (const n of nomes) {
    const nome = n.trim();
    if (nome.length < 3) continue;
    t = t.replace(new RegExp(`(?<![\\p{L}\\d])${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "giu"), MARCADOR_NOME);
  }
  return t;
}

export function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Validações da ficha (rodam em código, depois da IA e de novo no envio)
// ---------------------------------------------------------------------------

const MARCAS_MASCARA = /\[(?:telefone|cpf|e-mail|número)\]/i;
const ASPAS = /["“”«»]/;

/** (b) Telefone, CPF, e-mail ou nome próprio de cliente num campo de texto. */
export function temDadoPessoal(texto: string, nomes: readonly string[]): boolean {
  if (!texto) return false;
  if (removerDadosPessoais(texto) !== texto || MARCAS_MASCARA.test(texto)) return true;
  for (const n of nomes) {
    const nome = n.trim();
    if (nome.length < 3) continue;
    if (new RegExp(`(?<![\\p{L}\\d])${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "iu").test(texto)) return true;
  }
  return false;
}

/** (a) A mensagem-chave tem de existir, depois do mascaramento, dentro de uma mensagem do ATENDENTE.
 * Trechos separados por "…" ou "..." têm de aparecer na mesma mensagem, em ordem. */
export function mensagemChaveNoAtendente(chave: string, mensagens: readonly MensagemFicha[]): boolean {
  const trechos = chave.split(/…|\.\.\./).map(normalizar).filter((t) => t.length >= 8);
  if (!trechos.length) return false;
  return mensagens.some((m) => {
    if (m.de !== "atendente") return false;
    const alvo = normalizar(m.texto);
    let pos = 0;
    for (const t of trechos) {
      const i = alvo.indexOf(t, pos);
      if (i < 0) return false;
      pos = i + t.length;
    }
    return true;
  });
}

/** (c) "onde_travou" descreve a fala do cliente só por resumo: sem aspas e sem copiar um trecho longo. */
export function citaFalaDoCliente(texto: string, mensagens: readonly MensagemFicha[]): boolean {
  if (ASPAS.test(texto)) return true;
  const palavras = normalizar(texto).replace(/[^\p{L}\d ]/gu, " ").split(" ").filter(Boolean);
  if (palavras.length < 6) return false;
  const falas = mensagens.filter((m) => m.de === "cliente").map((m) => ` ${normalizar(m.texto).replace(/[^\p{L}\d ]/gu, " ").replace(/\s+/g, " ")} `);
  for (let i = 0; i + 6 <= palavras.length; i++) {
    const janela = ` ${palavras.slice(i, i + 6).join(" ")} `;
    if (falas.some((f) => f.includes(janela))) return true;
  }
  return false;
}

/** Datas da conversa (ISO de Brasília): dias corridos entre a primeira e a última mensagem. */
export function calcularDias(mensagens: readonly MensagemFicha[]): { dias: number | null; fechou_em: string | null } {
  const datas = mensagens.map((m) => m.em.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!datas.length) return { dias: null, fechou_em: null };
  const ini = Date.parse(`${datas[0]}T12:00:00Z`);
  const fim = Date.parse(`${datas[datas.length - 1]}T12:00:00Z`);
  return { dias: Math.max(0, Math.round((fim - ini) / 86400_000)), fechou_em: datas[datas.length - 1] };
}

export interface ProblemaFicha { campo: string; motivo: string }

/** Confere uma ficha. `mensagens` é opcional (na edição do Admin, sem conversa, só valem (b) e as aspas de (c)). */
export function validarFicha(
  f: Pick<FichaCampos, "objecao_rotulo" | "titulo" | "perfil_cliente" | "onde_travou" | "o_que_fez" | "mensagem_chave" | "por_que_funcionou">,
  opts: { nomes: readonly string[]; mensagens?: readonly MensagemFicha[] },
): ProblemaFicha[] {
  const p: ProblemaFicha[] = [];
  const campos: [string, string][] = [
    ["objeção", f.objecao_rotulo], ["título", f.titulo], ["perfil", f.perfil_cliente], ["onde travou", f.onde_travou],
    ["o que fez", f.o_que_fez.join("\n")], ["mensagem-chave", f.mensagem_chave], ["por que funcionou", f.por_que_funcionou],
  ];
  for (const [campo, texto] of campos) {
    if (temDadoPessoal(texto, opts.nomes)) p.push({ campo, motivo: "tem telefone, CPF, e-mail ou nome de cliente" });
  }
  if (!f.onde_travou.trim()) p.push({ campo: "onde travou", motivo: "está vazio" });
  else if (opts.mensagens ? citaFalaDoCliente(f.onde_travou, opts.mensagens) : ASPAS.test(f.onde_travou)) {
    p.push({ campo: "onde travou", motivo: "cita a fala do cliente; descreva só por resumo, sem aspas" });
  }
  if (!f.mensagem_chave.trim()) p.push({ campo: "mensagem-chave", motivo: "está vazia" });
  else if (opts.mensagens && !mensagemChaveNoAtendente(f.mensagem_chave, opts.mensagens)) {
    p.push({ campo: "mensagem-chave", motivo: "não é um trecho de uma mensagem do atendente" });
  }
  if (!f.o_que_fez.some((x) => x.trim())) p.push({ campo: "o que fez", motivo: "está vazio" });
  return p;
}

// ---------------------------------------------------------------------------
// Resposta da IA
// ---------------------------------------------------------------------------

const txt = (max: number) => z.string().trim().max(max).catch("");

export const FichaIARespostaSchema = z.object({
  objecao_id: z.string().nullable().catch(null),
  objecao_rotulo: txt(120),
  ponto_parada: z.enum(PONTOS),
  plano: z.enum(PLANOS_FICHA).catch("outro"),
  perfil_cliente: txt(160),
  onde_travou: z.string().trim().min(1).max(800),
  o_que_fez: z.array(z.string().trim().min(1).max(400)).min(1).max(6),
  mensagem_chave: z.string().trim().min(1).max(1200),
  por_que_funcionou: txt(800),
});
export type FichaIAResposta = z.infer<typeof FichaIARespostaSchema>;

/** Campos que o atendente revisa e envia. */
export const FichaEnvioZ = z.object({
  objecao_id: z.string().uuid().nullable(),
  objecao_rotulo: z.string().trim().max(120),
  ponto_parada: z.enum(PONTOS),
  plano: z.enum(PLANOS_FICHA),
  perfil_cliente: z.string().trim().max(160),
  onde_travou: z.string().trim().min(1).max(800),
  o_que_fez: z.array(z.string().trim().min(1).max(400)).min(1).max(6),
  mensagem_chave: z.string().trim().min(1).max(1200),
  por_que_funcionou: z.string().trim().max(800),
  dias_ate_fechar: z.number().int().min(0).max(3650).nullable(),
  fechou_em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
export type FichaEnvio = z.infer<typeof FichaEnvioZ>;
