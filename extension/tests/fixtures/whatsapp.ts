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
  const pre = `[${hora}, ${data}] ${m.quem ?? "Cliente"}: `;
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
