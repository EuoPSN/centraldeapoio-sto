// HTML simplificado da LISTA de conversas do WhatsApp Web (só o que a varredura usa).
export interface ItemFx {
  nome: string;
  previa: string;
  hora: string;
  /** Última mensagem é do atendente (ticks na prévia). */
  enviada?: boolean;
  naoLida?: boolean;
  icone?: string;
}
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function item(i: ItemFx): string {
  const tick = i.enviada ? `<span data-icon="msg-dblcheck"></span>` : "";
  const nao = i.naoLida ? `<span aria-label="1 mensagem não lida">1</span>` : "";
  const icone = i.icone ? `<span data-icon="${i.icone}"></span>` : `<span data-icon="default-user"></span>`;
  return `<div role="listitem"><div class="avatar">${icone}</div><div><div><span dir="auto" title="${esc(i.nome)}">${esc(i.nome)}</span><div>${i.hora}</div></div><div>${tick}<span dir="ltr" title="${esc(i.previa)}">${esc(i.previa)}</span>${nao}</div></div></div>`;
}

export const lista = (itens: string[]) => `<div id="app"><div id="pane-side">${itens.join("")}</div></div>`;

export const LISTA_EXEMPLO = lista([
  item({ nome: "Marlene R.", previa: "Vou conversar com meu marido", hora: "14:32", naoLida: true }),
  item({ nome: "Cliente 2", previa: "Qual o valor para duas pessoas?", hora: "14:20", naoLida: true }),
  item({ nome: "Cliente 3", previa: "Perfeito, te explico como fica", hora: "13:58", enviada: true }),
  item({ nome: "Equipe (grupo)", previa: "Ana: a Omnia não lê", hora: "13:40", icone: "default-group" }),
  item({ nome: "Cliente 5", previa: "Obrigada!", hora: "ontem" }),
]);
