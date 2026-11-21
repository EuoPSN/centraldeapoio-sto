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
export const MOTIVO_SEM_CONVERSA = "Abra uma conversa individual no WhatsApp Web e tente de novo.";
export const MOTIVO_FALHA = "Não consegui ler esta conversa.";

export type ResultadoIdentificar = { ok: true; id: Identificacao } | { ok: false; motivo: string; naoLe: boolean };
export type ResultadoLer = { ok: true; conversa: Conversa } | { ok: false; motivo: string; naoLe: boolean };

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

function elementosDeMensagem(painel: ParentNode): Element[] {
  return todos(painel, SELETORES.mensagem).filter((e) => lerDataId(e.getAttribute("data-id")) !== null);
}

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------

export function acharPainel(doc: Document): Element | null {
  return primeiro(doc, SELETORES.painelConversa);
}

interface Cabecalho { nome: string; subtitulo: string; icones: string[] }

function lerCabecalho(painel: Element): Cabecalho | null {
  const cab = primeiro(painel, SELETORES.cabecalho) ?? primeiro(painel.ownerDocument, SELETORES.cabecalho);
  if (!cab) return null;
  const textos: string[] = [];
  for (const sel of SELETORES.textosCabecalho) {
    cab.querySelectorAll(sel).forEach((s) => {
      const t = limpar(s.getAttribute("title") || textoDe(s));
      if (t && !textos.includes(t)) textos.push(t);
    });
    if (textos.length) break;
  }
  const icones = qualquer(cab, SELETORES.iconesCabecalho).map((i) => (i.getAttribute("data-icon") ?? "").toLowerCase());
  return { nome: textos[0] ?? "", subtitulo: textos.slice(1).join(" · "), icones };
}

/** Subtítulo que lista participantes ("Ana, Bruno, você") ou fala de grupo. */
export function subtituloDeGrupo(sub: string): boolean {
  const t = sub.toLowerCase();
  if (!t) return false;
  if (/(dados do grupo|group info|participantes|participants|membros|members|comunidade|community|lista de transmiss|broadcast)/.test(t)) return true;
  if (/(visto por [úu]ltimo|last seen|online|digitando|typing|gravando|recording|conta comercial|business account)/.test(t)) return false;
  // "Ana, Bruno, Você": 2 ou mais itens separados por vírgula
  return t.split(",").filter((x) => x.trim()).length >= 2;
}

// ---------------------------------------------------------------------------
// Detecção de grupo. Regra: na dúvida, NÃO lê.
// ---------------------------------------------------------------------------

export function detectarGrupo(painel: Element): Veredito {
  const cab = lerCabecalho(painel);
  const msgs = elementosDeMensagem(painel);
  const ids = msgs.map((m) => lerDataId(m.getAttribute("data-id"))!);

  // Sinais de que NÃO é individual (qualquer um basta).
  if (ids.some((i) => ehNaoIndividual(i.chat))) return { tipo: "grupo", motivo: MOTIVO_GRUPO };
  const todosDataIds = qualquer(painel, SELETORES.mensagem).map((e) => e.getAttribute("data-id") ?? "");
  if (todosDataIds.some((d) => SUFIXO_NAO_INDIVIDUAL.some((s) => d.includes(s)))) return { tipo: "grupo", motivo: MOTIVO_GRUPO };
  if (cab?.icones.some((i) => ICONES_NAO_INDIVIDUAL.some((k) => i.includes(k)))) return { tipo: "grupo", motivo: MOTIVO_GRUPO };
  if (cab && subtituloDeGrupo(cab.subtitulo)) return { tipo: "grupo", motivo: MOTIVO_GRUPO };

  // Mensagens recebidas com remetentes diferentes (data-pre-plain-text) = vários participantes.
  const remetentes = new Set<string>();
  msgs.forEach((m, i) => {
    if (ids[i].saiu) return;
    const pre = primeiro(m, SELETORES.blocoCopiavel)?.getAttribute("data-pre-plain-text") ?? "";
    const quem = /\]\s*(.*?):\s*$/.exec(pre)?.[1]?.trim();
    if (quem) remetentes.add(quem.toLowerCase());
  });
  if (remetentes.size >= 2) return { tipo: "grupo", motivo: MOTIVO_GRUPO };
  // Mensagem recebida com nome de autor visível (padrão de grupo).
  if (msgs.some((m, i) => !ids[i].saiu && m.querySelector('[data-testid="author"], [data-testid="msg-author"]'))) {
    return { tipo: "grupo", motivo: MOTIVO_GRUPO };
  }

  // Confirmação positiva: sem cabeçalho legível ou sem id de chat reconhecível = dúvida.
  if (!cab || !cab.nome) return { tipo: "duvida", motivo: MOTIVO_DUVIDA };
  if (!ids.length) return { tipo: "duvida", motivo: MOTIVO_DUVIDA };
  if (!ids.every((i) => ehIndividual(i.chat))) return { tipo: "duvida", motivo: MOTIVO_DUVIDA };
  if (new Set(ids.map((i) => i.chat)).size !== 1) return { tipo: "duvida", motivo: MOTIVO_DUVIDA };
  return { tipo: "individual" };
}

// ---------------------------------------------------------------------------
// Identificação (cabeçalho + id do chat)
// ---------------------------------------------------------------------------

function numeroDoChat(painel: Element): string {
  for (const m of elementosDeMensagem(painel)) {
    const id = lerDataId(m.getAttribute("data-id"));
    if (id && /@(c\.us|s\.whatsapp\.net)$/.test(id.chat)) return soDigitos(id.chat.split("@")[0]);
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
  if (!painel) return { ok: false, motivo: MOTIVO_SEM_CONVERSA, naoLe: false };
  const v = detectarGrupo(painel);
  if (v.tipo !== "individual") return { ok: false, motivo: v.motivo, naoLe: true };
  const id = montarIdentificacao(painel);
  if (!id) return { ok: false, motivo: MOTIVO_FALHA, naoLe: false };
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
  for (const el of elementosDeMensagem(painel)) {
    const id = lerDataId(el.getAttribute("data-id"))!;
    let texto = textoDaMensagem(el);
    if (temMidia(el)) texto = texto ? `[mídia] ${texto}` : "[mídia]";
    if (!texto) continue;
    const { hora, data } = horaEData(el);
    out.push({ de: id.saiu ? "atendente" : "cliente", texto, hora, ...(data ? { data } : {}) });
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
  if (recusa) return { ok: false, motivo: recusa, naoLe: true };
  const painel = acharPainel(doc)!;
  const mensagens = lerMensagens(painel);
  if (!mensagens.length) return { ok: false, motivo: "Não encontrei mensagens carregadas nesta conversa.", naoLe: false };
  return { ok: true, conversa: { ...ident.id, mensagens } };
}
