// Varredura leve da LISTA de conversas (só o que já está visível na tela).
// NUNCA abre conversa, NUNCA rola a lista, NUNCA clica. Só consulta elementos.
// Nome e prévia ficam no navegador: quem decide o que sobe para o servidor é o service worker
// (só a chave `chat_key` em hash + horário + direção).
import { PREVIAS_TRANSITORIAS, SELETORES_LISTA, primeiro, qualquer, todos } from "./selectors";
import { textoDe } from "./ler";

export type Direcao = "cliente" | "atendente";

export interface ItemLista {
  nome: string;
  previa: string;
  /** "14:32" (hoje) ou null quando a lista mostra "ontem", dia da semana ou data. */
  hora: string | null;
  /** Texto cru do horário, para diagnóstico/teste. */
  horaTexto: string;
  naoLida: boolean;
  direcao: Direcao;
}

export type ResultadoLista =
  | { ok: true; itens: ItemLista[]; ignorados: number }
  | { ok: false; motivo: string; codigo: "sem_lista" | "sem_itens" };

export const MOTIVO_SEM_LISTA = "Não encontrei a lista de conversas.";

const RE_HORA = /^(\d{1,2}):(\d{2})$/;
const RE_FORA_DE_HOJE = /^(ontem|yesterday|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}(\/\d{2,4})?)/i;

const limpar = (t: string) => t.replace(/[‎‏‪-‮]/g, "").replace(/\s+/g, " ").trim();

function textoCurto(el: Element | null): string {
  if (!el) return "";
  return limpar(el.getAttribute("title") || textoDe(el));
}

/** Primeiro elemento da lista de seletores com texto (em ordem de preferência). */
function primeiroComTexto(raiz: Element, lista: readonly string[], excluir: Set<string> = new Set()): string {
  for (const sel of lista) {
    let els: Element[] = [];
    try { els = Array.from(raiz.querySelectorAll(sel)); } catch { continue; }
    for (const el of els) {
      const t = textoCurto(el);
      if (t && !excluir.has(t)) return t;
    }
  }
  return "";
}

/** Procura o horário: folha de texto curta que seja "HH:MM", "ontem", dia da semana ou data. */
function acharHorario(item: Element): string {
  const candidatos = qualquer(item, ["[data-testid='cell-frame-primary-detail'] *", "div", "span"]);
  for (const el of candidatos) {
    if (el.children.length > 0 && !el.getAttribute("data-testid")) continue; // só folhas
    const t = limpar(textoDe(el));
    if (t.length > 0 && t.length <= 12 && (RE_HORA.test(t) || RE_FORA_DE_HOJE.test(t))) return t;
  }
  return "";
}

function previaDe(item: Element, nome: string): string {
  return primeiroComTexto(item, SELETORES_LISTA.previa, new Set([nome]));
}

/** Lê UMA linha da lista. Devolve null quando ela deve ser ignorada ou não dá para ler com segurança. */
export function lerItem(item: Element): ItemLista | "ignorar" | null {
  const nome = primeiroComTexto(item, SELETORES_LISTA.nome);
  if (!nome) return null;

  // Grupos, comunidades, listas de transmissão, canais e Status: ignora (na dúvida, ignora).
  if (qualquer(item, SELETORES_LISTA.naoIndividual).length > 0) return "ignorar";

  const previa = previaDe(item, nome);
  // Em grupo, a prévia vem como "Nome: mensagem" (ou "Você: …"). Na dúvida, ignora.
  if (/^você:/i.test(previa) || /^you:/i.test(previa)) return "ignorar";
  if (/^[^:\n]{1,40}:\s+\S/.test(previa) && !qualquer(item, SELETORES_LISTA.statusEnviada).length) return "ignorar";

  if (PREVIAS_TRANSITORIAS.some((re) => re.test(previa))) return null; // direção desconhecida

  const horaTexto = acharHorario(item);
  const m = RE_HORA.exec(horaTexto);
  const hora = m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
  if (!horaTexto) return null; // sem horário não há como medir

  const enviada = qualquer(item, SELETORES_LISTA.statusEnviada).length > 0;
  const naoLida = qualquer(item, SELETORES_LISTA.naoLida).length > 0;
  return { nome, previa, hora, horaTexto, naoLida, direcao: enviada ? "atendente" : "cliente" };
}

/** Lê só a lista de conversas visível. Falha segura: sem lista, não lê nada. */
export function lerListaDeConversas(doc: Document): ResultadoLista {
  const lista = primeiro(doc, SELETORES_LISTA.lista);
  if (!lista) return { ok: false, motivo: MOTIVO_SEM_LISTA, codigo: "sem_lista" };
  const els = todos(lista, SELETORES_LISTA.item);
  if (!els.length) return { ok: false, motivo: "A lista de conversas está vazia ou mudou de formato.", codigo: "sem_itens" };
  const itens: ItemLista[] = [];
  let ignorados = 0;
  for (const el of els) {
    let r: ReturnType<typeof lerItem> = null;
    try { r = lerItem(el); } catch { r = null; }
    if (r === "ignorar") ignorados++;
    else if (r) itens.push(r);
  }
  return { ok: true, itens, ignorados };
}
