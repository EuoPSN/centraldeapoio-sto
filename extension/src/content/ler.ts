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

/** Como a direção (recebida × enviada) de uma mensagem foi decidida. */
export type MetodoDirecao = "data_id_antigo" | "remetente" | "icones_de_status" | "alinhamento" | "indefinida";

/** Mensagem na tela. `chat` é null quando o data-id não está no formato antigo; `saiu` é null
 * quando nenhum método confiável decidiu a direção. */
export interface ElMensagem { el: Element; saiu: boolean | null; chat: string | null; metodo: MetodoDirecao; remetente: string | null }

const MOTIVO_REMETENTE_ILEGIVEL = "Não consegui identificar quem enviou as mensagens (formato novo do WhatsApp); por segurança a Omnia não lê.";
export const MOTIVO_SEM_MENSAGEM_DO_CLIENTE = "Ainda não há mensagem do cliente nesta conversa.";
export const MOTIVO_VARIOS_REMETENTES = "Há mais de um remetente nas mensagens recebidas: parece um grupo.";
export const MOTIVO_DIRECAO = "Não consegui separar o que o cliente enviou do que você enviou; por segurança a Omnia não lê.";

/** Normaliza nome para comparação: sem marcas invisíveis, caixa e espaços; telefone vira só dígitos. */
export function normalizarNome(t: string): string {
  const s = limpar(t).replace(/\s+/g, " ").toLowerCase();
  return pareceTelefone(s) ? soDigitos(s) : s;
}

/** Elementos dentro de mensagem citada (não fazem parte do corpo da mensagem principal). */
function citadasDe(raiz: ParentNode): Element[] { return qualquer(raiz, SELETORES.citada); }
const dentroDeCitada = (n: Element, citadas: Element[]) => citadas.some((c) => c === n || c.contains(n));

/** Bloco copiável do corpo da mensagem (ignora o que estiver dentro de citação). */
function blocoDaMensagem(el: Element): Element | null {
  const citadas = citadasDe(el);
  return qualquer(el, SELETORES.blocoCopiavel).find((b) => !dentroDeCitada(b, citadas)) ?? null;
}

/** Remetente do data-pre-plain-text "[14:32, 21/11/2026] Nome: ". null se não for legível. */
export function remetenteDe(el: Element): string | null {
  const pre = blocoDaMensagem(el)?.getAttribute("data-pre-plain-text") ?? "";
  const m = /\]\s*(.+?):\s*$/.exec(pre);
  const nome = m?.[1]?.trim();
  return nome ? normalizarNome(nome) : null;
}

function temTexto(el: Element): boolean {
  return !!blocoDaMensagem(el) || qualquer(el, ['[data-testid="selectable-text"]', "span.selectable-text"]).length > 0;
}

/** Ícone de status (ticks) dentro de msg-meta: presença = mensagem enviada. null se não há msg-meta. */
function statusDeEnvio(el: Element): boolean | null {
  const metas = el.querySelectorAll('[data-testid="msg-meta"]');
  if (!metas.length) return null;
  return Array.from(metas).some((meta) =>
    meta.querySelector('[data-icon^="msg-"]') ||
    Array.from(meta.querySelectorAll("[aria-label]")).some((i) => RE_STATUS_ENVIO.test(i.getAttribute("aria-label") ?? "")));
}
const RE_STATUS_ENVIO = /\b(enviada|entregue|lida|pendente|sent|delivered|read|pending)\b/i;

/** Alinhamento do balão em relação ao centro do painel. null se não der para decidir. */
function porAlinhamento(el: Element, painel: Element): boolean | null {
  const p = painel.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (!p.width || !r.width) return null;
  const dif = (r.left + r.width / 2) - (p.left + p.width / 2);
  if (Math.abs(dif) < p.width * 0.05) return null;
  return dif > 0;
}

/** Candidatas a mensagem: data-id e classes message-in/out que tenham texto, sem aninhadas. */
function candidatas(painel: ParentNode): Element[] {
  let lista = qualquer(painel, [...SELETORES.mensagem, ...SELETORES.mensagemSemId]).filter(temTexto);
  if (!lista.length) {
    // Sem data-id nem classes: cada bloco de texto copiável vira uma mensagem.
    lista = qualquer(painel, SELETORES.blocoCopiavel).filter((b) => !b.parentElement?.closest("[data-pre-plain-text]"));
  }
  // Fica a mais externa quando uma contém outra (evita contar duas vezes).
  return lista.filter((e) => !lista.some((o) => o !== e && o.contains(e)));
}

/** Mensagens na tela, com direção decidida por: 1) data-id antigo, 2) remetente do
 * data-pre-plain-text, 3) ícones de status, 4) alinhamento. Para no primeiro sinal confiável. */
export function elementosDeMensagem(painel: Element, titulo?: string): ElMensagem[] {
  const els = candidatas(painel);
  const remetentes = els.map(remetenteDe);
  const tit = titulo ? normalizarNome(titulo) : "";
  // Método 2 só vale se todo remetente diferente do título for um só (o atendente).
  const distintos = new Set(remetentes.filter((r): r is string => !!r && r !== tit));
  const remetenteServe = !!tit && distintos.size <= 1;

  return els.map((el, i) => {
    const remetente = remetentes[i];
    const id = lerDataId(el.getAttribute("data-id"));
    const base = { el, chat: id?.chat ?? null, remetente };
    if (id) return { ...base, saiu: id.saiu, metodo: "data_id_antigo" as const };
    if (remetenteServe && remetente) return { ...base, saiu: remetente !== tit, metodo: "remetente" as const };
    const st = statusDeEnvio(el);
    if (st !== null) return { ...base, saiu: st, metodo: "icones_de_status" as const };
    const al = porAlinhamento(el, painel);
    if (al !== null) return { ...base, saiu: al, metodo: "alinhamento" as const };
    return { ...base, saiu: null, metodo: "indefinida" as const };
  });
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
  const doTestid = qualquer(cab, SELETORES.subtituloCabecalho).map((e) => limpar(e.getAttribute("title") || textoDe(e))).find(Boolean);
  return { el: cab, nome, subtitulo: doTestid ?? textos.slice(1).join(" · "), icones, presenca, rotuloDeGrupo };
}

/** Título (nome) da conversa no cabeçalho; "" se não achar. */
export function tituloDoCabecalho(painel: Element): string { return lerCabecalho(painel)?.nome ?? ""; }

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
//   GRUPO      = qualquer sinal de grupo encontrado, ou 2+ remetentes distintos entre as RECEBIDAS.
//   INDIVIDUAL = cabeçalho com nome + mensagens + nenhum sinal de grupo + direção decidida +
//                no máximo UM remetente distinto entre as recebidas (legível). Se ele for diferente
//                do título (contato salvo com outro nome), ainda é individual: só se registra.
//   O nome nas mensagens ENVIADAS é o do atendente: nunca conta como sinal de grupo.
//   resto      = dúvida (não lê).
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
  /** Quantas mensagens cada método de direção decidiu. */
  metodosDeDirecao: Record<MetodoDirecao, number>;
  /** Elementos de autor ignorados por estarem dentro de mensagem citada. */
  autoresEmCitacao: number;
  /** Só contagens e formas mascaradas (sem nome, número nem texto). */
  remetentes: { distintos_recebidas: number; distintos_enviadas: number };
  subtitulo: { forma_mascarada: string; nomes: "0" | "1" | "2+" };
  /** Observações que não bloqueiam (ex.: "titulo_diferente_do_remetente"). */
  observacoes: string[];
}

function mascararLocal(v: string): string {
  let o = "";
  for (const ch of v) o += /\p{Nd}/u.test(ch) ? "9" : /\p{L}/u.test(ch) ? "a" : ch === "," || ch === " " || ch === "-" || ch === "+" ? ch : "?";
  return o;
}

/** Forma mascarada do subtítulo: dígito→9, letra→a; itens com nome (separados por vírgula) → [nome]. */
export function subtituloMascarado(sub: string): { forma: string; nomes: "0" | "1" | "2+" } {
  const t = sub.trim();
  if (!t) return { forma: "", nomes: "0" };
  if (RE_PRESENCA.test(t) || /(conta comercial|business account)/i.test(t)) return { forma: mascararLocal(t), nomes: "0" };
  const itens = t.split(",").map((x) => x.trim()).filter(Boolean);
  const forma = itens.map((i) => (/\p{L}/u.test(i) ? "[nome]" : mascararLocal(i))).join(", ");
  return { forma, nomes: itens.length >= 2 ? "2+" : itens.length === 1 ? "1" : "0" };
}

const sn = (b: boolean): SimNao => (b ? "sim" : "não");

export function avaliarConversa(painel: Element): Avaliacao {
  const cab = lerCabecalho(painel);
  const titulo = cab?.nome ?? "";
  const tit = normalizarNome(titulo);
  const msgs = elementosDeMensagem(painel, titulo);
  const recebidasEl = msgs.filter((m) => m.saiu === false);
  const enviadasEl = msgs.filter((m) => m.saiu === true);
  const indefinidas = msgs.filter((m) => m.saiu === null).length;
  const chats = msgs.map((m) => m.chat).filter((c): c is string => c !== null);
  const metodosDeDirecao: Record<MetodoDirecao, number> = { data_id_antigo: 0, remetente: 0, icones_de_status: 0, alinhamento: 0, indefinida: 0 };
  for (const m of msgs) metodosDeDirecao[m.metodo]++;

  // --- Sinais de GRUPO (qualquer um basta) ---
  const todosDataIds = qualquer(painel, SELETORES.mensagem).map((e) => e.getAttribute("data-id") ?? "");
  const idNaoIndividual = chats.some(ehNaoIndividual) || todosDataIds.some((d) => SUFIXO_NAO_INDIVIDUAL.some((s) => d.includes(s)));
  const icone = !!cab?.icones.some((i) => ICONES_NAO_INDIVIDUAL.some((k) => i.includes(k)));
  const subtituloVariosNomes = !!cab && subtituloDeGrupo(cab.subtitulo);
  const rotulo = !!cab?.rotuloDeGrupo;
  const listaParticipantes = qualquer(painel, SELETORES.sinaisDeGrupoNoPainel).length > 0;
  // Nome do autor exibido no corpo da mensagem principal (o de mensagem citada não conta).
  let autoresEmCitacao = 0;
  let autorVisivel = false;
  for (const m of msgs) {
    const citadas = citadasDe(m.el);
    for (const a of qualquer(m.el, SELETORES.remetenteNaMensagem)) {
      if (dentroDeCitada(a, citadas)) autoresEmCitacao++; else autorVisivel = true;
    }
  }
  // Remetentes: só as RECEBIDAS contam. O nome nas enviadas é o do atendente (só vai para o diagnóstico).
  const rem = (l: ElMensagem[]) => new Set(l.map((m) => m.remetente).filter((r): r is string => !!r));
  const remRecebidas = rem(recebidasEl);
  const recebidasSemTitulo = [...remRecebidas].filter((r) => r !== tit);
  const variosRemetentes = remRecebidas.size >= 2;
  const sub = subtituloMascarado(cab?.subtitulo ?? "");
  const remetenteNasMensagens = variosRemetentes || autorVisivel;

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
  const remetentesLegiveis = recebidasEl.length > 0 && recebidasEl.every((m) => !!m.remetente);
  const remetenteIgualTitulo = remetentesLegiveis && !!tit && recebidasEl.every((m) => m.remetente === tit);
  const positivas: Record<string, SimNao> = {
    verif_direcao_decidida_em_todas: sn(msgs.length > 0 && indefinidas === 0),
    verif_ha_mensagem_do_cliente: sn(recebidasEl.length > 0),
    verif_remetente_legivel_nas_recebidas: sn(remetentesLegiveis),
    verif_remetente_igual_ao_titulo: sn(remetenteIgualTitulo),
    verif_subtitulo_de_presenca: sn(!!cab?.presenca),
  };

  const base = {
    cabecalhoEncontrado: !!cab, totalMensagens: msgs.length, recebidas: recebidasEl.length,
    enviadas: enviadasEl.length, sinais, positivas, metodosDeDirecao, autoresEmCitacao,
    remetentes: { distintos_recebidas: remRecebidas.size, distintos_enviadas: rem(enviadasEl).size },
    subtitulo: { forma_mascarada: sub.forma, nomes: sub.nomes },
    observacoes: [] as string[],
  };
  const grupo = (codigo: string, motivo = MOTIVO_GRUPO): Avaliacao => ({ ...base, veredito: { tipo: "grupo", motivo }, codigo });
  const duvida = (codigo: string, motivo = MOTIVO_DUVIDA): Avaliacao => ({ ...base, veredito: { tipo: "duvida", motivo }, codigo });

  if (variosRemetentes && !idNaoIndividual && !icone && !subtituloVariosNomes && !rotulo && !listaParticipantes && !autorVisivel) {
    return grupo("grupo_varios_remetentes", MOTIVO_VARIOS_REMETENTES);
  }
  if (Object.values(sinais).includes("sim")) return grupo("grupo");
  if (!cab) return duvida("cabecalho_nao_encontrado");
  if (!cab.nome) return duvida("cabecalho_sem_nome");
  if (!msgs.length) return duvida("sem_mensagens");
  if (idsContraditorios) return duvida("ids_de_chat_inconsistentes");
  if (indefinidas) return duvida("direcao_indefinida", MOTIVO_DIRECAO);
  if (!recebidasEl.length) return duvida("sem_mensagem_do_cliente", MOTIVO_SEM_MENSAGEM_DO_CLIENTE);
  if (!remetentesLegiveis) return duvida("remetente_ilegivel", MOTIVO_REMETENTE_ILEGIVEL);
  // Um único remetente entre as recebidas, diferente do título: o contato pode ter nome salvo
  // diferente do nome do perfil. Continua individual; só registra no diagnóstico.
  if (recebidasSemTitulo.length) base.observacoes.push("titulo_diferente_do_remetente");
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
  const pre = blocoDaMensagem(el)?.getAttribute("data-pre-plain-text") ?? "";
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
  const titulo = lerCabecalho(painel)?.nome ?? "";
  for (const { el, saiu } of elementosDeMensagem(painel, titulo)) {
    if (saiu === null) continue; // direção não decidida: nunca entra
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
