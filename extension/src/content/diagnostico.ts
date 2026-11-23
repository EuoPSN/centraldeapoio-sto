// Relatório de diagnóstico da leitura. Descreve SÓ ESTRUTURA: nunca texto de nós, nomes de
// contato, números nem mensagens. Só consulta o DOM (nada é clicado, rolado ou escrito).
import { SELETORES } from "./selectors";
import { lerDadosDoContato } from "./contato";
import { acharCabecalho, acharPainel, avaliarConversa, elementosDeMensagem, textoDe, tituloDoCabecalho } from "./ler";
import type { MetodoDirecao } from "./ler";

export const VERSAO_FORMATO = 1;
const NIVEIS = 4;
const MAX_FILHOS = 6;

/** aria-label genéricos (rótulos fixos da interface) que podem aparecer com o valor. */
const ARIA_GENERICOS = new Set([
  "menu", "mais opções", "more options", "pesquisar", "search", "anexar", "attach", "voltar", "back", "fechar", "close",
  "enviar", "send", "chamada de vídeo", "chamada de voz", "video call", "voice call", "dados do contato", "contact info",
  "dados do grupo", "group info", "lista de mensagens", "message list", "mensagem", "message", "digite uma mensagem", "type a message",
  "emoji", "emojis", "figurinhas", "stickers", "gravar mensagem de voz", "voice message",
]);
/** Atributos data-* e id cujo VALOR pode aparecer (identificadores de interface, sem dados pessoais). */
const ATRIBUTOS_COM_VALOR = new Set(["data-testid", "data-icon", "role"]);
const IDS_SEGUROS = new Set(["app", "main", "pane-side", "side"]);
const RE_VALOR_SEGURO = /^[a-z0-9_:.-]{1,40}$/i;

export interface NoResumido {
  tag: string;
  atributos?: Record<string, string>;
  filhos?: NoResumido[];
  /** Quantos filhos foram cortados (limite de largura). */
  mais_filhos?: number;
}

export interface RelatorioSeletor {
  nome: string;
  escopo: "painel" | "cabecalho" | "documento" | "documento (painel ausente)";
  encontrou: "sim" | "não";
  /** Elementos achados pelo primeiro seletor que bateu. */
  elementos: number;
  /** Posição (0 = principal, 1+ = fallback) do primeiro seletor que bateu. */
  fallback_que_bateu: number | null;
  tentativas: { posicao: number; seletor: string; elementos: number }[];
}

export interface Relatorio {
  formato: number;
  gerado_em: string;
  extensao: { versao: string };
  aba: { dominio: string; content_script_presente: boolean };
  pausada?: boolean;
  seletores: RelatorioSeletor[];
  cabecalho: { encontrado: boolean; arvore: NoResumido | null };
  area_de_mensagens: { total: number; recebidas: number; enviadas: number; arvore: NoResumido | null };
  /** Só a FORMA mascarada dos identificadores (dígito→9, letra→a, nome→[nome]) e nomes de atributos. */
  formas_dos_identificadores?: {
    data_id: Record<string, number>;
    data_pre_plain_text: Record<string, number>;
    atributos_de_mensagem_de_texto: string[];
  };
  direcao?: { metodos: Record<MetodoDirecao, number>; autores_ignorados_em_citacao: number };
  deteccao: {
    sinais_de_grupo: Record<string, string>;
    verificacoes_positivas: Record<string, string>;
    decisao: "le" | "nao_le";
    motivo_codigo: string;
    motivo: string;
    /** Só contagens (sem nomes). */
    remetentes?: { distintos_recebidas: number; distintos_enviadas: number };
    /** Forma mascarada de chat-subtitle (dígito→9, letra→a, nomes→[nome]) e quantos nomes tem. */
    subtitulo?: { forma_mascarada: string; nomes: "0" | "1" | "2+" };
    observacoes?: string[];
  };
  /** Aba "Dados do contato": detecção e forma mascarada do texto do número (nunca o número nem o nome). */
  dados_do_contato?: { aba_detectada: boolean; seletor_que_decidiu: string; forma_mascarada_do_texto: string; numero_encontrado: boolean };
  /** Preenchido pelo painel: motivo do último resultado de leitura nesta sessão do painel. */
  ultimo_resultado_no_painel?: { codigo: string; motivo: string } | null;
}

// ---------------------------------------------------------------------------
// Forma mascarada de identificadores (sem nome, número nem texto)
// ---------------------------------------------------------------------------

const PRESERVADOS = new Set(["_", "@", ".", "[", "]", ",", ":", "/", " ", "-", "+"]);

/** Dígito → 9, letra → a, preserva _ @ . [ ] , : / espaço - +; qualquer outro caractere vira "?". */
export function mascarar(v: string): string {
  let o = "";
  for (const ch of v) {
    if (/\p{Nd}/u.test(ch)) o += "9";
    else if (/\p{L}/u.test(ch)) o += "a";
    else if (PRESERVADOS.has(ch)) o += ch;
    else o += "?";
  }
  return o;
}

/** data-pre-plain-text: "[hh:mm, dd/mm/aaaa] Nome: " → "[99:99, 99/99/9999] [nome]: ". */
export function mascararPrePlain(v: string): string {
  const m = /^(\[[^\]]*\]\s*)([\s\S]*?)(:\s*)$/.exec(v);
  if (!m) return mascarar(v);
  return `${mascarar(m[1])}[nome]${mascarar(m[3])}`;
}

function contarFormas(valores: string[], f: (v: string) => string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const v of valores) { const k = f(v); r[k] = (r[k] ?? 0) + 1; }
  return r;
}

const MAX_AMOSTRA = 5;

function formasDosIdentificadores(painel: Element, msgEl: Element | null) {
  const ids = Array.from(painel.querySelectorAll("[data-id]")).slice(0, MAX_AMOSTRA).map((e) => e.getAttribute("data-id") ?? "");
  const pres = Array.from(painel.querySelectorAll("[data-pre-plain-text]")).slice(0, MAX_AMOSTRA).map((e) => e.getAttribute("data-pre-plain-text") ?? "");
  const atributos = new Set<string>();
  if (msgEl) {
    const bloco = msgEl.matches("[data-pre-plain-text]") ? msgEl : msgEl.querySelector("[data-pre-plain-text]");
    for (const e of [msgEl, bloco]) e?.getAttributeNames().forEach((n) => atributos.add(n.toLowerCase()));
  }
  return {
    data_id: contarFormas(ids, mascarar),
    data_pre_plain_text: contarFormas(pres, mascararPrePlain),
    atributos_de_mensagem_de_texto: Array.from(atributos).sort(),
  };
}

function contar(raiz: ParentNode, seletor: string): number {
  try { return raiz.querySelectorAll(seletor).length; } catch { return 0; }
}

function relatorioSeletores(doc: Document, painel: Element | null, cab: Element | null): RelatorioSeletor[] {
  const lista = Object.entries(SELETORES) as [string, readonly string[]][];
  return lista.map(([nome, sels]) => {
    let escopo: RelatorioSeletor["escopo"];
    let raiz: ParentNode;
    if (nome === "painelConversa") { escopo = "documento"; raiz = doc; }
    else if (nome === "cabecalho") { escopo = painel ? "painel" : "documento (painel ausente)"; raiz = painel ?? doc; }
    else if (nome === "textosCabecalho" || nome === "iconesCabecalho") { escopo = "cabecalho"; raiz = cab ?? doc; }
    else { escopo = painel ? "painel" : "documento (painel ausente)"; raiz = painel ?? doc; }
    const tentativas = sels.map((seletor, posicao) => ({ posicao, seletor, elementos: contar(raiz, seletor) }));
    const bateu = tentativas.find((t) => t.elementos > 0);
    return {
      nome, escopo, encontrou: bateu ? "sim" : "não", elementos: bateu?.elementos ?? 0,
      fallback_que_bateu: bateu ? bateu.posicao : null, tentativas,
    };
  });
}

// ---------------------------------------------------------------------------
// Árvore resumida (sem textos)
// ---------------------------------------------------------------------------

/** Palavras do nome do contato (e do texto do cabeçalho): valores que as contenham são omitidos. */
function palavrasProibidas(cab: Element | null): string[] {
  if (!cab) return [];
  return textoDe(cab).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
}

const omitido = (v: string) => `[omitido:${v.length}]`;

function valorSeguro(nomeAttr: string, valor: string, proibidas: string[]): string {
  const v = valor.trim();
  const minus = v.toLowerCase();
  if (nomeAttr === "id") return IDS_SEGUROS.has(v) ? v : omitido(valor);
  if (proibidas.some((w) => minus.includes(w))) return omitido(valor);
  if (nomeAttr === "aria-label") return ARIA_GENERICOS.has(minus) ? v : omitido(valor);
  if (!ATRIBUTOS_COM_VALOR.has(nomeAttr)) return omitido(valor);
  // Sem dígitos longos, sem "@", só caracteres de identificador de interface.
  if (/\d{4,}/.test(v) || v.includes("@") || !RE_VALOR_SEGURO.test(v)) return omitido(valor);
  return v;
}

function resumir(el: Element, nivel: number, proibidas: string[]): NoResumido {
  const atributos: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) {
    const n = a.name.toLowerCase();
    if (n === "role" || n === "id" || n.startsWith("aria-") || n.startsWith("data-")) atributos[n] = valorSeguro(n, a.value, proibidas);
  }
  const no: NoResumido = { tag: el.tagName.toLowerCase() };
  if (Object.keys(atributos).length) no.atributos = atributos;
  if (nivel < NIVEIS - 1) {
    const filhos = Array.from(el.children);
    if (filhos.length) no.filhos = filhos.slice(0, MAX_FILHOS).map((f) => resumir(f, nivel + 1, proibidas));
    if (filhos.length > MAX_FILHOS) no.mais_filhos = filhos.length - MAX_FILHOS;
  }
  return no;
}

/** Contêiner da lista de mensagens: o pai comum das mensagens (ou o painel, sem mensagens). */
function areaDeMensagens(painel: Element, primeira: Element | null): Element {
  if (!primeira) return painel;
  const dono = primeira.closest('[role="application"], [data-testid="conversation-panel-messages"]');
  return dono ?? primeira.parentElement?.parentElement ?? painel;
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

function dadosDoContatoRelatorio(doc: Document) {
  const d = lerDadosDoContato(doc);
  return { aba_detectada: d.aba_detectada, seletor_que_decidiu: d.seletor_que_decidiu, forma_mascarada_do_texto: d.forma_mascarada, numero_encontrado: !!d.numero };
}

export function montarDiagnostico(doc: Document, extra: { versao: string; dominio: string }): Relatorio {
  const painel = acharPainel(doc);
  const cab = painel ? acharCabecalho(painel) : null;
  const msgs = painel ? elementosDeMensagem(painel, painel ? tituloDoCabecalho(painel) : "") : [];
  const proibidas = palavrasProibidas(cab);

  const base = {
    formato: VERSAO_FORMATO,
    gerado_em: new Date().toISOString(),
    extensao: { versao: extra.versao },
    aba: { dominio: extra.dominio, content_script_presente: true },
    seletores: relatorioSeletores(doc, painel, cab),
    cabecalho: { encontrado: !!cab, arvore: cab ? resumir(cab, 0, proibidas) : null },
  };

  if (!painel) {
    return {
      ...base,
      area_de_mensagens: { total: 0, recebidas: 0, enviadas: 0, arvore: null },
      deteccao: {
        sinais_de_grupo: {}, verificacoes_positivas: {}, decisao: "nao_le",
        motivo_codigo: "sem_conversa", motivo: "painel da conversa não encontrado (nenhuma conversa aberta ou seletor quebrado)",
      },
    };
  }

  const a = avaliarConversa(painel);
  const motivos: Record<string, string> = {
    grupo: "sinal de grupo encontrado: não lê",
    cabecalho_nao_encontrado: "cabeçalho não encontrado: não lê",
    cabecalho_sem_nome: "cabeçalho sem nome legível: não lê",
    sem_mensagens: "nenhuma mensagem encontrada: não lê",
    ids_de_chat_inconsistentes: "ids de chat contraditórios ou desconhecidos: não lê",
    direcao_indefinida: "nenhum método decidiu a direção de alguma mensagem: não lê",
    sem_mensagem_do_cliente: "só há mensagens enviadas: não dá para confirmar o contato: não lê",
    remetente_ilegivel: "remetente das mensagens recebidas não pôde ser lido: não lê",
    grupo_varios_remetentes: "mais de um remetente nas mensagens recebidas: parece grupo: não lê",
    individual_confirmado: "conversa individual confirmada: lê",
  };
  return {
    ...base,
    area_de_mensagens: {
      total: a.totalMensagens, recebidas: a.recebidas, enviadas: a.enviadas,
      arvore: resumir(areaDeMensagens(painel, msgs[0]?.el ?? null), 0, proibidas),
    },
    formas_dos_identificadores: formasDosIdentificadores(painel, msgs.find((m) => m.remetente)?.el ?? msgs[0]?.el ?? null),
    dados_do_contato: dadosDoContatoRelatorio(doc),
    direcao: { metodos: a.metodosDeDirecao, autores_ignorados_em_citacao: a.autoresEmCitacao },
    deteccao: {
      sinais_de_grupo: a.sinais, verificacoes_positivas: a.positivas,
      decisao: a.veredito.tipo === "individual" ? "le" : "nao_le",
      motivo_codigo: a.codigo, motivo: motivos[a.codigo] ?? a.codigo,
      remetentes: a.remetentes, subtitulo: a.subtitulo, observacoes: a.observacoes,
    },
  };
}
