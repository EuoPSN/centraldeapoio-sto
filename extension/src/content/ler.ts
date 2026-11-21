// Leitura da conversa aberta e detecção de grupo. Funções puras sobre o DOM recebido
// (testáveis com HTML de exemplo). NUNCA clica, rola, escreve nem envia nada:
// só consulta elementos que já estão na tela.
import {
  ICONES_NAO_INDIVIDUAL, SELETORES, SUFIXO_INDIVIDUAL, SUFIXO_NAO_INDIVIDUAL,
  primeiro, qualquer, todos,
} from "./selectors";
import { pareceTelefone, soDigitos } from "../lib/numeros";

export const MAX_MENSAGENS = 60;

export interface Mensagem { de: "cliente" | "atendente"; texto: string; hora: string; data?: string }
export interface Identificacao { nome: string; numero: string }
export interface Conversa extends Identificacao { mensagens: Mensagem[] }

export type Veredito =
  | { tipo: "individual" }
  | { tipo: "grupo"; motivo: string }
  | { tipo: "duvida"; motivo: string };

export const MOTIVO_GRUPO = "Esta conversa parece ser um grupo; a Omnia não lê grupos.";
export const MOTIVO_DUVIDA = "Não consegui confirmar que esta é uma conversa individual; por segurança a Omnia não lê.";
export const MOTIVO_SEM_CONVERSA = "Abra uma conversa no WhatsApp Web.";
export const MOTIVO_FALHA = "Não consegui ler esta conversa.";

/** Código do motivo da falha: o painel usa para escolher a mensagem e grava no diagnóstico. */
export type CodigoFalha = string;
export type ResultadoIdentificar = { ok: true; id: Identificacao } | { ok: false; motivo: string; naoLe: boolean; codigo?: CodigoFalha };
export type ResultadoLer = { ok: true; conversa: Conversa } | { ok: false; motivo: string; naoLe: boolean; codigo?: CodigoFalha };

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Texto visível de um elemento; emoji (img com alt) vira o próprio caractere. */
export function textoDe(el: Node): string {
  if (el.nodeType === 3) return (el as Text).data;
  if (el.nodeType !== 1) return "";
  const e = el as Element;
  const tag = e.tagName;
  if (tag === "IMG") return e.getAttribute("alt") ?? "";
  if (tag === "BR") return "\n";
  if (tag === "SCRIPT" || tag === "STYLE") return "";
  return Array.from(e.childNodes).map(textoDe).join("");
}

const limpar = (t: string) => t.replace(/[‎‏‪-‮]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

// ---------------------------------------------------------------------------
// Id do chat (data-id): "true_5531999991234@c.us_ABCD" · "false_120363…@g.us_ABCD_5531…@c.us"
// ---------------------------------------------------------------------------

export interface IdMensagem { saiu: boolean; chat: string }

export function lerDataId(dataId: string | null): IdMensagem | null {
  if (!dataId) return null;
  const m = /^(true|false)_([^_]+)_/.exec(dataId);
  if (!m) return null;
  return { saiu: m[1] === "true", chat: m[2] };
}

function ehIndividual(chat: string) { return SUFIXO_INDIVIDUAL.some((s) => chat.endsWith(s)); }
function ehNaoIndividual(chat: string) { return SUFIXO_NAO_INDIVIDUAL.some((s) => chat.includes(s)); }

/** Mensagem na tela. `chat` é null quando o layout não traz data-id (fallback por classe). */
export interface ElMensagem { el: Element; saiu: boolean; chat: string | null }

export function elementosDeMensagem(painel: ParentNode): ElMensagem[] {
  const comId: ElMensagem[] = [];
  for (const e of todos(painel, SELETORES.mensagem)) {
    const id = lerDataId(e.getAttribute("data-id"));
    if (id) comId.push({ el: e, saiu: id.saiu, chat: id.chat });
  }
  if (comId.length) return comId;
  // Fallback: sem data-id, a direção vem da classe message-in/message-out.
  const out: ElMensagem[] = [];
  for (const e of qualquer(painel, SELETORES.mensagemSemId)) {
    const saiu = e.classList.contains("message-out");
    if (saiu === e.classList.contains("message-in")) continue; // ambígua: ignora
    out.push({ el: e, saiu, chat: null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------

export function acharPainel(doc: Document): Element | null {
  return primeiro(doc, SELETORES.painelConversa);
}

export function acharCabecalho(painel: Element): Element | null {
  return primeiro(painel, SELETORES.cabecalho) ?? primeiro(painel.ownerDocument, ['[data-testid="conversation-header"]']);
}

interface Cabecalho { el: Element; nome: string; subtitulo: string; icones: string[]; presenca: boolean; rotuloDeGrupo: boolean }

const RE_PRESENCA = /(online|visto por [úu]ltimo|last seen|digitando|typing|gravando|recording)/i;
const RE_ROTULO_GRUPO = /(grupo|group|comunidade|community|participantes|participants|transmiss|broadcast)/i;

function lerCabecalho(painel: Element): Cabecalho | null {
  const cab = acharCabecalho(painel);
  if (!cab) return null;
  const textos: string[] = [];
  for (const sel of SELETORES.textosCabecalho) {
    cab.querySelectorAll(sel).forEach((s) => {
      const t = limpar(s.getAttribute("title") || textoDe(s));
      if (t && !textos.includes(t)) textos.push(t);
    });
    if (textos.length) break;
  }
  const nome = textos[0] ?? "";
  // Presença ("online", "visto por último"): procura em todos os textos do cabeçalho, menos o nome.
  const todosTextos = qualquer(cab, SELETORES.textosCabecalho).map((s) => limpar(s.getAttribute("title") || textoDe(s)));
  const presenca = todosTextos.some((t) => t && t !== nome && RE_PRESENCA.test(t));
  const icones = qualquer(cab, SELETORES.iconesCabecalho).map((i) => (i.getAttribute("data-icon") ?? "").toLowerCase());
  // Rótulos de grupo/comunidade em atributos de acessibilidade (nunca no texto, que é o nome do contato).
  const rotuloDeGrupo = [cab, ...Array.from(cab.querySelectorAll("*"))].some((e) =>
    RE_ROTULO_GRUPO.test(`${e.getAttribute("aria-label") ?? ""} ${e.getAttribute("data-testid") ?? ""}`));
  return { el: cab, nome, subtitulo: textos.slice(1).join(" · "), icones, presenca, rotuloDeGrupo };
}

/** Subtítulo que lista participantes ("Ana, Bruno, você") ou fala de grupo. */
export function subtituloDeGrupo(sub: string): boolean {
  const t = sub.toLowerCase();
  if (!t) return false;
  if (/(dados do grupo|group info|participantes|participants|membros|members|comunidade|community|lista de transmiss|broadcast)/.test(t)) return true;
  if (RE_PRESENCA.test(t) || /(conta comercial|business account)/.test(t)) return false;
  // "Ana, Bruno, Você": 2 ou mais itens separados por vírgula
  return t.split(",").filter((x) => x.trim()).length >= 2;
}

// ---------------------------------------------------------------------------
// Detecção de grupo. Regra: na dúvida, NÃO lê.
//   GRUPO     = qualquer sinal de grupo encontrado.
//   INDIVIDUAL = cabeçalho + mensagens + nenhum sinal de grupo + ao menos uma verificação positiva
//                + nenhuma contradição entre os ids de chat.
//   resto     = dúvida (não lê).
// ---------------------------------------------------------------------------

export type SimNao = "sim" | "não";

export interface Avaliacao {
  veredito: Veredito;
  /** Código curto do motivo final (vai para o diagnóstico). */
  codigo: string;
  cabecalhoEncontrado: boolean;
  totalMensagens: number;
  recebidas: number;
  enviadas: number;
  /** Cada sinal de GRUPO avaliado: "sim" = encontrado. */
  sinais: Record<string, SimNao>;
  /** Cada verificação POSITIVA de individual: "sim" = confirmada. */
  positivas: Record<string, SimNao>;
}

const sn = (b: boolean): SimNao => (b ? "sim" : "não");

export function avaliarConversa(painel: Element): Avaliacao {
  const cab = lerCabecalho(painel);
  const msgs = elementosDeMensagem(painel);
  const recebidasEl = msgs.filter((m) => !m.saiu);
  const chats = msgs.map((m) => m.chat).filter((c): c is string => c !== null);

  // --- Sinais de GRUPO (qualquer um basta) ---
  const todosDataIds = qualquer(painel, SELETORES.mensagem).map((e) => e.getAttribute("data-id") ?? "");
  const idNaoIndividual = chats.some(ehNaoIndividual) || todosDataIds.some((d) => SUFIXO_NAO_INDIVIDUAL.some((s) => d.includes(s)));
  const icone = !!cab?.icones.some((i) => ICONES_NAO_INDIVIDUAL.some((k) => i.includes(k)));
  const subtituloVariosNomes = !!cab && subtituloDeGrupo(cab.subtitulo);
  const rotulo = !!cab?.rotuloDeGrupo;
  const listaParticipantes = qualquer(painel, SELETORES.sinaisDeGrupoNoPainel).length > 0;
  // Remetentes diferentes nas mensagens recebidas (data-pre-plain-text) ou nome do autor visível.
  const remetentes = new Set<string>();
  for (const m of recebidasEl) {
    const pre = primeiro(m.el, SELETORES.blocoCopiavel)?.getAttribute("data-pre-plain-text") ?? "";
    const quem = /\]\s*(.*?):\s*$/.exec(pre)?.[1]?.trim();
    if (quem) remetentes.add(quem.toLowerCase());
  }
  const autorVisivel = recebidasEl.some((m) => qualquer(m.el, SELETORES.remetenteNaMensagem).length > 0);
  const remetenteNasMensagens = remetentes.size >= 2 || autorVisivel;

  const sinais: Record<string, SimNao> = {
    sinal_id_do_chat_nao_individual: sn(idNaoIndividual),
    sinal_icone_de_grupo_no_cabecalho: sn(icone),
    sinal_subtitulo_com_varios_nomes: sn(subtituloVariosNomes),
    sinal_rotulo_de_grupo_no_cabecalho: sn(rotulo),
    sinal_lista_de_participantes: sn(listaParticipantes),
    sinal_remetente_nas_mensagens: sn(remetenteNasMensagens),
  };

  // --- Verificações POSITIVAS de individual ---
  const idsContraditorios = chats.length > 0 && (!chats.every(ehIndividual) || new Set(chats).size !== 1);
  const positivas: Record<string, SimNao> = {
    verif_id_do_chat_individual: sn(chats.length > 0 && !idsContraditorios),
    verif_subtitulo_de_presenca: sn(!!cab?.presenca),
    // Ausência de remetente só vale com ao menos uma mensagem recebida visível (senão é vazio).
    verif_sem_remetente_nas_recebidas: sn(recebidasEl.length > 0 && !remetenteNasMensagens),
  };

  const base = {
    cabecalhoEncontrado: !!cab, totalMensagens: msgs.length, recebidas: recebidasEl.length,
    enviadas: msgs.length - recebidasEl.length, sinais, positivas,
  };
  const grupo = Object.values(sinais).includes("sim");
  if (grupo) return { ...base, veredito: { tipo: "grupo", motivo: MOTIVO_GRUPO }, codigo: "grupo" };
  const duvida = (codigo: string): Avaliacao => ({ ...base, veredito: { tipo: "duvida", motivo: MOTIVO_DUVIDA }, codigo });
  if (!cab) return duvida("cabecalho_nao_encontrado");
  if (!cab.nome) return duvida("cabecalho_sem_nome");
  if (!msgs.length) return duvida("sem_mensagens");
  if (idsContraditorios) return duvida("ids_de_chat_inconsistentes");
  if (!Object.values(positivas).includes("sim")) return duvida("sem_verificacao_positiva");
  return { ...base, veredito: { tipo: "individual" }, codigo: "individual_confirmado" };
}

export function detectarGrupo(painel: Element): Veredito {
  return avaliarConversa(painel).veredito;
}

// ---------------------------------------------------------------------------
// Identificação (cabeçalho + id do chat)
// ---------------------------------------------------------------------------

function numeroDoChat(painel: Element): string {
  for (const m of elementosDeMensagem(painel)) {
    if (m.chat && /@(c\.us|s\.whatsapp\.net)$/.test(m.chat)) return soDigitos(m.chat.split("@")[0]);
  }
  return "";
}

function montarIdentificacao(painel: Element): Identificacao | null {
  const cab = lerCabecalho(painel);
  if (!cab?.nome) return null;
  const doChat = numeroDoChat(painel);
  // Nome exibido que é um número (contato não salvo): vira número e o nome fica vazio.
  if (pareceTelefone(cab.nome)) return { nome: "", numero: doChat || soDigitos(cab.nome) };
  return { nome: cab.nome, numero: doChat };
}

export function identificar(doc: Document): ResultadoIdentificar {
  const painel = acharPainel(doc);
  if (!painel) return { ok: false, motivo: MOTIVO_SEM_CONVERSA, naoLe: false, codigo: "sem_conversa" };
  const a = avaliarConversa(painel);
  if (a.veredito.tipo !== "individual") return { ok: false, motivo: a.veredito.motivo, naoLe: true, codigo: a.codigo };
  const id = montarIdentificacao(painel);
  if (!id) return { ok: false, motivo: MOTIVO_FALHA, naoLe: false, codigo: "falha" };
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------

function horaEData(el: Element): { hora: string; data?: string } {
  const pre = primeiro(el, SELETORES.blocoCopiavel)?.getAttribute("data-pre-plain-text") ?? "";
  const m = /\[\s*(\d{1,2}:\d{2})(?:\s*[AaPp][Mm])?\s*,\s*([^\]]+?)\s*\]/.exec(pre);
  if (m) return { hora: m[1], data: m[2] };
  for (const sel of SELETORES.horario) {
    for (const s of Array.from(el.querySelectorAll(sel))) {
      const h = /\b(\d{1,2}:\d{2})\b/.exec(textoDe(s));
      if (h) return { hora: h[1] };
    }
  }
  return { hora: "" };
}

function textoDaMensagem(el: Element): string {
  const citadas = qualquer(el, SELETORES.citada);
  let partes: string[] = [];
  for (const sel of SELETORES.textoMensagem) {
    partes = Array.from(el.querySelectorAll(sel))
      .filter((n) => !citadas.some((c) => c.contains(n)))
      .map((n) => limpar(textoDe(n)))
      .filter(Boolean);
    if (partes.length) break;
  }
  return partes.join("\n");
}

function temMidia(el: Element): boolean {
  return qualquer(el, SELETORES.midia).some((n) => !qualquer(el, SELETORES.citada).some((c) => c.contains(n)));
}

export function lerMensagens(painel: Element, max = MAX_MENSAGENS): Mensagem[] {
  const out: Mensagem[] = [];
  for (const { el, saiu } of elementosDeMensagem(painel)) {
    let texto = textoDaMensagem(el);
    if (temMidia(el)) texto = texto ? `[mídia] ${texto}` : "[mídia]";
    if (!texto) continue;
    const { hora, data } = horaEData(el);
    out.push({ de: saiu ? "atendente" : "cliente", texto, hora, ...(data ? { data } : {}) });
  }
  return out.slice(-max);
}

/** Lê a conversa aberta. Falha de forma segura: grupo ou dúvida = nada é lido.
 * `aprovar` roda depois de identificar e ANTES de ler as mensagens (ex.: contato ignorado). */
export async function lerConversa(
  doc: Document,
  aprovar?: (id: Identificacao) => Promise<string | null>,
): Promise<ResultadoLer> {
  const ident = identificar(doc);
  if (!ident.ok) return ident;
  const recusa = aprovar ? await aprovar(ident.id) : null;
  if (recusa) return { ok: false, motivo: recusa, naoLe: true, codigo: "ignorado" };
  const painel = acharPainel(doc)!;
  const mensagens = lerMensagens(painel);
  if (!mensagens.length) return { ok: false, motivo: "Não encontrei mensagens carregadas nesta conversa.", naoLe: false, codigo: "sem_mensagens_de_texto" };
  return { ok: true, conversa: { ...ident.id, mensagens } };
}
