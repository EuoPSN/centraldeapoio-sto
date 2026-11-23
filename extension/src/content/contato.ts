// Leitura do número na aba "Dados do contato" do WhatsApp Web, SÓ quando o atendente a abriu.
// Nunca abre a aba nem clica em nada: só consulta o que já está na tela. Falha de forma segura
// (aba não detectada ou sem número = nada acontece). Funções puras sobre o DOM recebido.
import { SELETORES, qualquer } from "./selectors";
import { avaliarConversa, acharPainel, normalizarNome, textoDe, tituloDoCabecalho } from "./ler";
import { pareceTelefone, soDigitos } from "../lib/numeros";
import { numeroValido } from "../lib/sanitizar";

export interface DadosDoContato {
  aba_detectada: boolean;
  /** Seletor (de selectors.ts) que decidiu a detecção; "" se nenhum. */
  seletor_que_decidiu: string;
  /** Forma mascarada do texto onde o número foi achado (dígito→9, letra→a). Nunca o número nem o nome. */
  forma_mascarada: string;
  /** Número em dígitos; só vai para o painel (nunca para o diagnóstico). */
  numero: string;
}

const VAZIO: DadosDoContato = { aba_detectada: false, seletor_que_decidiu: "", forma_mascarada: "", numero: "" };

/** Telefone brasileiro tolerante a +55, espaços, hífen, pontos e parênteses. */
const RE_TELEFONE = /(?:\+?\s*55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}/;

function mascararDigitos(v: string): string {
  let o = "";
  for (const ch of v) o += /\p{Nd}/u.test(ch) ? "9" : /\p{L}/u.test(ch) ? "a" : ch === " " || ch === "+" || ch === "-" || ch === "(" || ch === ")" ? ch : "?";
  return o;
}

/** Procura o primeiro texto (folha do DOM) que pareça telefone dentro da aba. */
function acharTelefone(aba: Element): { numero: string; texto: string } | null {
  const folhas = Array.from(aba.querySelectorAll("*")).filter((e) => e.children.length === 0);
  for (const f of folhas) {
    const t = textoDe(f).replace(/[‎‏‪-‮]/g, "").trim();
    if (!t || t.length > 40) continue;
    const m = pareceTelefone(t) ? t : RE_TELEFONE.exec(t)?.[0];
    if (!m) continue;
    const d = soDigitos(m);
    if (numeroValido(d)) return { numero: d, texto: t };
  }
  return null;
}

const RE_CABECALHO_ABA = /^(dados do contato|informa[cç][õo]es do contato|contact info)$/i;

/** Fallback sem depender de data-testid/aria: acha o cabeçalho "Dados do contato" e sobe até a região
 * que também mostra o título da conversa (nome ou número) fora do painel da conversa. */
function abaPorCabecalho(doc: Document, painel: Element, titulo: string): Element | null {
  const folhas = Array.from(doc.querySelectorAll("*")).filter((e) => e.children.length === 0 && !painel.contains(e));
  const cab = folhas.filter((e) => RE_CABECALHO_ABA.test(textoDe(e).replace(/[‎‏‪-‮]/g, "").trim()));
  for (const c of cab) {
    let r: Element | null = c.parentElement;
    for (let i = 0; r && i < 14; i++, r = r.parentElement) {
      if (r.closest("#pane-side") || r.contains(painel)) break;
      const temTitulo = Array.from(r.querySelectorAll("*")).some(
        (e) => e.children.length === 0 && normalizarNome(e.getAttribute("title") || textoDe(e)) === titulo,
      );
      if (temTitulo) return r;
    }
  }
  return null;
}

export function lerDadosDoContato(doc: Document): DadosDoContato {
  try {
    const painel = acharPainel(doc);
    if (!painel) return VAZIO;
    // Só em conversa individual confirmada (mesmas regras de segurança da leitura).
    if (avaliarConversa(painel).veredito.tipo !== "individual") return VAZIO;
    const titulo = normalizarNome(tituloDoCabecalho(painel));
    if (!titulo) return VAZIO;
    for (const sel of SELETORES.abaDadosDoContato) {
      let regioes: Element[] = [];
      try { regioes = Array.from(doc.querySelectorAll(sel)); } catch { continue; }
      for (const r of regioes) {
        if (r.closest("#pane-side") || r.contains(painel) || painel.contains(r)) continue;
        // O título da aba tem de ser o da conversa aberta; senão é outra coisa (ou outro contato).
        const tituloIgual = qualquer(r, SELETORES.tituloDaAba).some((e) => normalizarNome(e.getAttribute("title") || textoDe(e)) === titulo);
        if (!tituloIgual) continue;
        const achado = acharTelefone(r);
        return { aba_detectada: true, seletor_que_decidiu: sel, forma_mascarada: achado ? mascararDigitos(achado.texto) : "", numero: achado?.numero ?? "" };
      }
    }
    const alt = abaPorCabecalho(doc, painel, titulo);
    if (alt) {
      const achado = acharTelefone(alt);
      return { aba_detectada: true, seletor_que_decidiu: "cabecalho:Dados do contato", forma_mascarada: achado ? mascararDigitos(achado.texto) : "", numero: achado?.numero ?? "" };
    }
  } catch {
    /* falha de forma segura */
  }
  return VAZIO;
}
