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
    '[data-testid="conversation-panel-body"]', // fallback: corpo do painel (se o #main perder o id)
  ],

  /** Cabeçalho da conversa (nome do contato/grupo, subtítulo). */
  cabecalho: [
    "#main header", // <header> dentro do painel
    '[data-testid="conversation-header"]',
    '[data-testid="conversation-info-header"]', // fallback: bloco clicável com nome + subtítulo
    "header", // fallback genérico: qualquer <header> dentro do painel (o painel já exclui a lista lateral)
    '[role="banner"]',
  ],

  /** Textos do cabeçalho: o primeiro é o nome; os demais formam o subtítulo (online, participantes…). */
  textosCabecalho: [
    "span[title]", // o WhatsApp põe o texto completo também no atributo title
    '[data-testid="conversation-info-header-chat-title"]', // fallback: título da conversa por data-testid
    'span[dir="auto"]',
    "[title]", // último recurso: qualquer elemento com title dentro do cabeçalho
  ],

  /** Subtítulo do cabeçalho (presença ou lista de participantes). Se achar, vale no lugar dos demais textos. */
  subtituloCabecalho: ['[data-testid="chat-subtitle"]'],

  /** Ícones do cabeçalho/avatar (data-icon). Usados só para detectar grupo, comunidade, lista e Status. */
  iconesCabecalho: ["[data-icon]"],

  /** Cada mensagem carregada na tela. O data-id traz "true_/false_" + id do chat + id da mensagem. */
  mensagem: ["[data-id]"],

  /** Fallback quando as mensagens perdem o data-id: a direção vem da classe message-in/message-out
   * (classes semânticas, não ofuscadas). Sem data-id não há id do chat: a decisão de "individual"
   * então depende só dos sinais do cabeçalho e das mensagens (ver detectarGrupo). */
  mensagemSemId: [".message-in", ".message-out"],

  /** Nome do remetente exibido numa mensagem RECEBIDA: padrão de grupo. */
  remetenteNaMensagem: [
    '[data-testid="author"]',
    '[data-testid="msg-author"]',
    '[data-testid*="author"]', // fallback: qualquer testid com "author"
    'span[dir="auto"][aria-label$=":"]', // o WhatsApp rotula o nome do remetente como "Nome:"
  ],

  /** Rótulos/áreas de grupo, comunidade ou lista de participantes dentro do painel. */
  sinaisDeGrupoNoPainel: [
    '[data-testid*="group"]',
    '[data-testid*="community"]',
    '[data-testid*="participant"]',
    '[aria-label*="participantes" i]',
    '[aria-label*="participants" i]',
    '[aria-label*="dados do grupo" i]',
    '[aria-label*="group info" i]',
    '[aria-label*="comunidade" i]',
    '[aria-label*="community" i]',
  ],

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

  /** ABA "Dados do contato" (painel lateral que o ATENDENTE abre; a extensão nunca a abre).
   * O DOM real ainda NÃO foi observado: lista ampla com fallbacks, do mais específico ao mais genérico.
   * Só vale se o título dentro da região (tituloDaAba) for igual ao título da conversa aberta.
   * Ajuste aqui depois do primeiro "Copiar diagnóstico" com a aba aberta. */
  abaDadosDoContato: [
    '[data-testid="contact-info-drawer"]',
    '[data-testid*="contact-info"]',
    '[data-testid*="contact_info"]',
    'aside[aria-label*="contato" i]',
    'aside[aria-label*="contact" i]',
    'aside[aria-label*="dados" i]',
    'section[aria-label*="contato" i]',
    'section[aria-label*="contact" i]',
    'section[aria-label*="dados" i]',
    '[role="complementary"]',
    'aside[data-testid*="info"]',
    'section[data-testid*="info"]',
    "aside",
  ],

  /** Título (nome ou número) mostrado no topo da aba "Dados do contato". */
  tituloDaAba: ['[data-testid*="title"]', "h1", "h2", '[role="heading"]', "span[title]", '[aria-level]'],

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

// ---------------------------------------------------------------------------
// Lista de conversas (varredura leve do tempo de resposta)
// O DOM real da lista ainda NÃO foi observado ao vivo: listas amplas com fallback, do mais
// específico ao mais genérico. Se nada casar, a varredura falha de forma segura (não lê nada).
// Só LEITURA: nada aqui é usado para clicar, rolar ou abrir conversa.
// ---------------------------------------------------------------------------
export const SELETORES_LISTA = {
  /** Contêiner da lista de conversas (a coluna da esquerda). */
  lista: ["#pane-side", '[data-testid="chat-list"]', '[aria-label*="lista de conversas" i]', '[aria-label*="chat list" i]'],

  /** Cada conversa visível na lista. Só as que já estão renderizadas na tela. */
  item: ['[role="listitem"]', '[data-testid="cell-frame-container"]', '[role="row"]', '[role="gridcell"]'],

  /** Nome (ou número) da conversa. O primeiro com texto vale. */
  nome: ['[data-testid="cell-frame-title"] span[title]', "span[title]", '[data-testid="cell-frame-title"]', 'span[dir="auto"]'],

  /** Prévia da última mensagem. */
  previa: [
    '[data-testid="last-msg"] span[title]',
    '[data-testid="cell-frame-secondary"] span[title]',
    '[data-testid="cell-frame-secondary"] span[dir="ltr"]',
    'span[dir="ltr"][title]',
    'span[dir="ltr"]',
  ],

  /** Ticks de mensagem ENVIADA na prévia (relógio, um check, dois checks, lido). Presença = última mensagem é do atendente. */
  statusEnviada: [
    '[data-icon="msg-check"]',
    '[data-icon="msg-dblcheck"]',
    '[data-icon="msg-time"]',
    '[data-icon="msg-check-light"]',
    '[data-icon="msg-dblcheck-light"]',
    '[data-icon^="status-"]',
    '[data-testid="last-msg-status"]',
    '[data-testid^="msg-"][data-testid$="check"]',
  ],

  /** Marca de mensagem não lida (bolinha/contador). */
  naoLida: [
    '[aria-label*="não lida" i]',
    '[aria-label*="nao lida" i]',
    '[aria-label*="unread" i]',
    '[data-testid="icon-unread-count"]',
    '[data-icon="unread-count"]',
    '[data-testid="icon-unread-mark"]',
  ],

  /** Sinais de grupo, comunidade, lista de transmissão, canal e Status. Qualquer um = ignora. */
  naoIndividual: [
    '[data-icon*="group"]',
    '[data-icon*="community"]',
    '[data-icon*="broadcast"]',
    '[data-icon*="newsletter"]',
    '[data-icon*="channel"]',
    '[data-icon="status"]',
    '[data-icon*="status-ring"]',
    '[data-icon="status-v3"]',
    '[data-testid*="group"]',
    '[data-testid*="community"]',
    '[data-testid*="broadcast"]',
    '[data-testid*="status-ring"]',
  ],

  /** Onde procurar o horário (texto curto "14:32", "ontem", "22/11/2026"). */
  horario: ['[data-testid="cell-frame-primary-detail"]', '[data-testid="cell-frame-primary"]', "div", "span"],
} as const;

/** Prévia de conversa em andamento: não é mensagem, a direção é desconhecida. */
export const PREVIAS_TRANSITORIAS = [/^digitando/i, /^gravando/i, /^typing/i, /^recording/i, /^online$/i];
