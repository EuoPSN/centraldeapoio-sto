/**
 * ÚNICO arquivo com seletores do WhatsApp Web.
 *
 * O WhatsApp muda o layout com frequência. Regras que seguimos aqui:
 *  - preferir atributos estáveis (id, data-id, data-icon, data-pre-plain-text, aria-label,
 *    role, estrutura) a nomes de classe (que são ofuscados e mudam);
 *  - cada item é uma LISTA em ordem de preferência: o primeiro seletor que achar algo vale
 *    (fallback). Se nada for achado, a leitura falha de forma segura ("Não consegui ler
 *    esta conversa") e nada é enviado;
 *  - nenhum seletor aqui é usado para clicar, rolar ou escrever: o content script só LÊ.
 *
 * Se uma atualização do WhatsApp quebrar a leitura, é só este arquivo que muda.
 */

export const SELETORES = {
  /** Painel da conversa aberta (a parte da direita). Não inclui a lista de conversas. */
  painelConversa: [
    "#main", // id estável há anos
    '[data-testid="conversation-panel-wrapper"]', // fallback por data-testid
  ],

  /** Cabeçalho da conversa (nome do contato/grupo, subtítulo). */
  cabecalho: [
    "#main header", // <header> dentro do painel
    '[data-testid="conversation-header"]',
    '[role="banner"]',
  ],

  /** Textos do cabeçalho: o primeiro é o nome; os demais formam o subtítulo (online, participantes…). */
  textosCabecalho: [
    "span[title]", // o WhatsApp põe o texto completo também no atributo title
    'span[dir="auto"]',
  ],

  /** Ícones do cabeçalho/avatar (data-icon). Usados só para detectar grupo, comunidade, lista e Status. */
  iconesCabecalho: ["[data-icon]"],

  /** Cada mensagem carregada na tela. O data-id traz "true_/false_" + id do chat + id da mensagem. */
  mensagem: ["[data-id]"],

  /** Dentro da mensagem: bloco copiável, com data-pre-plain-text "[14:32, 21/11/2026] Nome: ". */
  blocoCopiavel: ["[data-pre-plain-text]", ".copyable-text"],

  /** Dentro da mensagem: o texto em si. */
  textoMensagem: ['[data-testid="selectable-text"]', "span.selectable-text", 'span[dir="ltr"]', 'span[dir="auto"]'],

  /** Sinais de mídia dentro da mensagem (imagem, vídeo, áudio, documento, figurinha). Vira o marcador "[mídia]". */
  midia: [
    "img[src^='blob:']",
    "video",
    "audio",
    '[data-icon*="audio"]',
    '[data-icon*="ptt"]',
    '[data-icon*="media"]',
    '[data-icon*="document"]',
    '[data-icon*="sticker"]',
    '[data-testid*="audio"]',
    '[data-testid*="media"]',
  ],

  /** Mensagem citada dentro de outra: não entra como texto da mensagem. */
  citada: ['[data-testid="quoted-message"]', '[aria-label*="citada"]', '[aria-label*="Quoted"]'],

  /** Horário alternativo (quando não há data-pre-plain-text). */
  horario: ['[data-testid="msg-meta"] span', "span[aria-hidden='true']"],
} as const;

/** Trechos de data-icon que indicam conversa que NÃO é individual. */
export const ICONES_NAO_INDIVIDUAL = ["group", "community", "broadcast", "newsletter", "status", "channel"];

/** Terminações de id de chat (data-id) que identificam o tipo de conversa. */
export const SUFIXO_INDIVIDUAL = ["@c.us", "@s.whatsapp.net", "@lid"];
export const SUFIXO_NAO_INDIVIDUAL = ["@g.us", "@broadcast", "@newsletter", "@status"];

/** Primeiro elemento que casa com algum seletor da lista (em ordem). */
export function primeiro(raiz: ParentNode, lista: readonly string[]): Element | null {
  for (const sel of lista) {
    try {
      const el = raiz.querySelector(sel);
      if (el) return el;
    } catch {
      /* seletor inválido neste navegador: tenta o próximo */
    }
  }
  return null;
}

/** Todos os elementos do primeiro seletor da lista que achar algo. */
export function todos(raiz: ParentNode, lista: readonly string[]): Element[] {
  for (const sel of lista) {
    try {
      const els = Array.from(raiz.querySelectorAll(sel));
      if (els.length) return els;
    } catch {
      /* tenta o próximo */
    }
  }
  return [];
}

/** Elementos que casam com QUALQUER seletor da lista (união), sem repetir. */
export function qualquer(raiz: ParentNode, lista: readonly string[]): Element[] {
  const set = new Set<Element>();
  for (const sel of lista) {
    try {
      raiz.querySelectorAll(sel).forEach((e) => set.add(e));
    } catch {
      /* ignora */
    }
  }
  return Array.from(set);
}
