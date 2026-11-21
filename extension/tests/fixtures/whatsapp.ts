// HTML simplificado imitando o que o WhatsApp Web mostra (só o que a leitura usa).

export interface MsgFx {
  saiu: boolean;
  texto?: string;
  chat?: string;
  hora?: string;
  data?: string;
  quem?: string;
  midia?: "imagem" | "audio";
  citada?: string;
  emoji?: string;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function msg(m: MsgFx, i = 0): string {
  const chat = m.chat ?? "5531991234567@c.us";
  const id = `${m.saiu ? "true" : "false"}_${chat}_ID${i}`;
  const hora = m.hora ?? "14:3" + (i % 10);
  const data = m.data ?? "21/11/2026";
  const pre = `[${hora}, ${data}] ${m.quem ?? (m.saiu ? "Atendente" : "Marlene R.")}: `;
  const midia = m.midia === "imagem" ? `<img src="blob:https://web.whatsapp.com/abc">` : m.midia === "audio" ? `<span data-icon="audio-play"></span>` : "";
  const citada = m.citada ? `<div data-testid="quoted-message"><span dir="auto" class="selectable-text">${esc(m.citada)}</span></div>` : "";
  const texto = m.texto !== undefined
    ? `<div class="copyable-text" data-pre-plain-text="${pre}"><span dir="ltr" class="selectable-text">${esc(m.texto)}${m.emoji ? `<img alt="${m.emoji}" src="x.png">` : ""}</span></div>`
    : `<div class="copyable-text" data-pre-plain-text="${pre}"></div>`;
  return `<div role="row"><div data-id="${id}">${citada}${midia}${texto}</div></div>`;
}

export function pagina(opts: { nome: string; subtitulo?: string; icones?: string[]; mensagens: string; semMain?: boolean; semHeader?: boolean }): string {
  const icones = (opts.icones ?? []).map((i) => `<span data-icon="${i}"></span>`).join("");
  const header = opts.semHeader ? "" : `<header>${icones}<div><span dir="auto" title="${opts.nome}">${opts.nome}</span>${opts.subtitulo ? `<span dir="auto" title="${opts.subtitulo}">${opts.subtitulo}</span>` : ""}</div></header>`;
  const lista = `<div id="pane-side"><div role="listitem"><span title="Outro contato">Outro contato</span><div data-id="false_5531900000000@c.us_X">prévia</div></div></div>`;
  if (opts.semMain) return `<div id="app">${lista}</div>`;
  return `<div id="app">${lista}<div id="main">${header}<div>${opts.mensagens}</div></div></div>`;
}

export const CONVERSA_INDIVIDUAL = pagina({
  nome: "Marlene R.",
  subtitulo: "visto por último hoje às 14:30",
  mensagens: [
    msg({ saiu: false, texto: "Oi, vi o anúncio do cartão. Queria saber como funciona", hora: "14:20" }, 1),
    msg({ saiu: true, texto: "Oi, Marlene! Que bom falar com você ", emoji: "😊", quem: "Atendente", hora: "14:21" }, 2),
    msg({ saiu: false, texto: "Eu, meu marido e minha filha", hora: "14:25" }, 3),
    msg({ saiu: false, midia: "imagem", hora: "14:26" }, 4),
    msg({ saiu: false, midia: "audio", hora: "14:27" }, 5),
    msg({ saiu: false, texto: "Pode. Mas vou conversar com meu marido e te falo", hora: "14:32", citada: "Posso te explicar como fica?" }, 6),
  ].join(""),
});

// ---------------------------------------------------------------------------
// Variações de layout (correção 1b)
// ---------------------------------------------------------------------------

/** Mensagem sem data-id: só a classe message-in/message-out indica a direção. */
export function msgSemId(m: { saiu: boolean; texto: string; quem?: string }): string {
  const pre = `[14:30, 21/11/2026] ${m.quem ?? (m.saiu ? "Atendente" : "Marlene R.")}: `;
  return `<div role="row"><div class="${m.saiu ? "message-out" : "message-in"}"><div class="copyable-text" data-pre-plain-text="${pre}"><span dir="ltr" class="selectable-text">${esc(m.texto)}</span></div></div></div>`;
}

/** Individual SEM subtítulo de presença (contato que oculta o "visto por último"). */
export const INDIVIDUAL_SEM_SUBTITULO = pagina({
  nome: "Marlene R.",
  mensagens: [
    msg({ saiu: false, texto: "Oi, tudo bem?", hora: "14:20" }, 1),
    msg({ saiu: true, texto: "Tudo sim!", quem: "Atendente", hora: "14:21" }, 2),
  ].join(""),
});

/** Individual com subtítulo "online". */
export const INDIVIDUAL_ONLINE = pagina({
  nome: "Marlene R.",
  subtitulo: "online",
  mensagens: msg({ saiu: false, texto: "Oi", hora: "14:20" }, 1),
});

/** Grupo: nome do autor visível nas mensagens recebidas e subtítulo com vários nomes. */
export const GRUPO = pagina({
  nome: "Família Silva",
  subtitulo: "Ana, Bruno, Carla, você",
  mensagens: [
    `<div role="row"><div data-id="false_120363000000000000@g.us_A1_5531988887777@c.us"><span dir="auto" aria-label="Ana:">Ana</span><div class="copyable-text" data-pre-plain-text="[14:20, 21/11/2026] Ana: "><span dir="ltr" class="selectable-text">bom dia</span></div></div></div>`,
  ].join(""),
});

/** Conversa aberta, mas sem nenhuma mensagem carregada. */
export const CONVERSA_VAZIA = pagina({ nome: "Marlene R.", subtitulo: "online", mensagens: "" });

/** Layout sem data-id, individual com presença. */
export const SEM_DATA_ID_COM_PRESENCA = pagina({
  nome: "Marlene R.", subtitulo: "visto por último hoje às 14:30",
  mensagens: msgSemId({ saiu: false, texto: "Oi" }) + msgSemId({ saiu: true, texto: "Olá", quem: "Atendente" }),
});
/** Layout sem data-id, sem presença, só mensagens recebidas sem remetente. */
export const SEM_DATA_ID_SEM_PRESENCA = pagina({ nome: "Marlene R.", mensagens: msgSemId({ saiu: false, texto: "Oi" }) });
/** Layout sem data-id e SÓ mensagens enviadas, sem presença: nada confirma individual. */
export const SEM_DATA_ID_SO_ENVIADAS = pagina({ nome: "Marlene R.", mensagens: msgSemId({ saiu: true, texto: "Oi", quem: "Atendente" }) });

// ---------------------------------------------------------------------------
// Correção 1c: data-id em formato desconhecido (sem true_/false_ nem id do chat)
// ---------------------------------------------------------------------------

export interface MsgNovoFx {
  quem: string;
  texto?: string;
  midia?: boolean;
  /** Texto da mensagem citada; o autor da citação aparece DENTRO dela. */
  citada?: { autor: string; texto: string };
  /** Ícone de status (ticks) em msg-meta. */
  ticks?: boolean;
  /** Sem msg-meta nenhum. */
  semMeta?: boolean;
  hora?: string;
}

export function msgNovo(m: MsgNovoFx, i = 0): string {
  const hora = m.hora ?? "14:3" + (i % 10);
  const pre = `[${hora}, 21/11/2026] ${m.quem}: `;
  const citada = m.citada
    ? `<div data-testid="quoted-message"><span data-testid="author" dir="auto">${esc(m.citada.autor)}</span><span class="selectable-text" dir="auto">${esc(m.citada.texto)}</span></div>`
    : "";
  const midia = m.midia ? `<img src="blob:https://web.whatsapp.com/abc">` : "";
  const corpo = m.texto !== undefined
    ? `<div data-pre-plain-text="${pre}"><span data-testid="selectable-text" dir="ltr" class="selectable-text">${esc(m.texto)}</span></div>`
    : `<div data-pre-plain-text="${pre}"></div>`;
  const meta = m.semMeta ? "" : `<div data-testid="msg-meta"><span>${hora}</span>${m.ticks ? `<span data-icon="msg-dblcheck"></span>` : ""}</div>`;
  return `<div role="row"><div data-id="3EB0A1B2C3D4E5F6${i}" tabindex="-1">${citada}${midia}${corpo}${meta}</div></div>`;
}

/** (a) Individual, data-id desconhecido, direção pelo remetente; citação com author dentro. */
export const NOVO_INDIVIDUAL = pagina({
  nome: "Marlene R.",
  mensagens: [
    msgNovo({ quem: "Marlene R.", texto: "Oi, vi o anúncio do cartão" }, 1),
    msgNovo({ quem: "Atendente", texto: "Oi! Posso te explicar?" }, 2),
    msgNovo({ quem: "Marlene R.", texto: "Pode sim", citada: { autor: "Você", texto: "Posso te explicar?" } }, 3),
  ].join(""),
});

/** (b) Grupo com dois remetentes, data-id desconhecido, sem subtítulo nem ícone. */
export const NOVO_GRUPO_DOIS_REMETENTES = pagina({
  nome: "Família Silva",
  mensagens: [
    msgNovo({ quem: "Ana", texto: "bom dia" }, 1),
    msgNovo({ quem: "Bruno", texto: "oi gente" }, 2),
    msgNovo({ quem: "Atendente", texto: "olá" , ticks: true }, 3),
  ].join(""),
});

/** (c) Só mensagens enviadas. */
export const NOVO_SO_ENVIADAS = pagina({
  nome: "Marlene R.",
  mensagens: msgNovo({ quem: "Atendente", texto: "Oi, tudo bem?" }, 1) + msgNovo({ quem: "Atendente", texto: "Posso ajudar?" }, 2),
});

/** (e) Mídia e texto misturados. */
export const NOVO_MIDIA_E_TEXTO = pagina({
  nome: "Marlene R.",
  mensagens: [
    msgNovo({ quem: "Marlene R.", midia: true }, 1),
    msgNovo({ quem: "Marlene R.", texto: "Segue a foto", midia: true }, 2),
    msgNovo({ quem: "Atendente", texto: "Recebi, obrigada" }, 3),
  ].join(""),
});

/** Remetente com formato ilegível (sem "Nome: " no pre-plain-text): não dá para confirmar. */
export const NOVO_REMETENTE_ILEGIVEL = pagina({
  nome: "Marlene R.",
  mensagens: `<div role="row"><div data-id="ABC1"><div data-pre-plain-text="[14:30, 21/11/2026]"><span class="selectable-text">oi</span></div></div></div>`,
});

/** Direção só pelos ícones de status (remetentes de dois nomes diferentes do título: método 2 não vale). */
export const NOVO_SO_ICONES = pagina({
  nome: "Marlene R.",
  mensagens: [
    msgNovo({ quem: "Marlene R.", texto: "Oi" }, 1),
    msgNovo({ quem: "Marlene R.", texto: "Tudo bem?" }, 2),
  ].join(""),
});
