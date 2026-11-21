// Relatório de diagnóstico da leitura. Descreve SÓ ESTRUTURA: nunca texto de nós, nomes de
// contato, números nem mensagens. Só consulta o DOM (nada é clicado, rolado ou escrito).
import { SELETORES } from "./selectors";
import { acharCabecalho, acharPainel, avaliarConversa, elementosDeMensagem, textoDe } from "./ler";

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
  deteccao: {
    sinais_de_grupo: Record<string, string>;
    verificacoes_positivas: Record<string, string>;
    decisao: "le" | "nao_le";
    motivo_codigo: string;
    motivo: string;
  };
  /** Preenchido pelo painel: motivo do último resultado de leitura nesta sessão do painel. */
  ultimo_resultado_no_painel?: { codigo: string; motivo: string } | null;
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

export function montarDiagnostico(doc: Document, extra: { versao: string; dominio: string }): Relatorio {
  const painel = acharPainel(doc);
  const cab = painel ? acharCabecalho(painel) : null;
  const msgs = painel ? elementosDeMensagem(painel) : [];
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
    sem_verificacao_positiva: "nenhuma verificação positiva de conversa individual: não lê",
    individual_confirmado: "conversa individual confirmada: lê",
  };
  return {
    ...base,
    area_de_mensagens: {
      total: a.totalMensagens, recebidas: a.recebidas, enviadas: a.enviadas,
      arvore: resumir(areaDeMensagens(painel, msgs[0]?.el ?? null), 0, proibidas),
    },
    deteccao: {
      sinais_de_grupo: a.sinais, verificacoes_positivas: a.positivas,
      decisao: a.veredito.tipo === "individual" ? "le" : "nao_le",
      motivo_codigo: a.codigo, motivo: motivos[a.codigo] ?? a.codigo,
    },
  };
}
