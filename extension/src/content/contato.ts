// Leitura do número na aba "Dados do contato" do WhatsApp Web, SÓ quando o atendente a abriu.
// Funções puras sobre o DOM: nunca clicam, abrem abas, rolam nem escrevem. Falham em silêncio.
import { RE_DADOS_CONTATO, SELETORES } from "./selectors";
import { acharPainel, normalizarNome, textoDe, tituloDoCabecalho } from "./ler";
import { numeroValido, soDigitos } from "../lib/numeros";

export interface DadosContato {
  /** A aba foi detectada (região lateral com o título da conversa aberta)? */
  detectada: boolean;
  /** Seletor que decidiu a detecção (sem conteúdo). */
  seletor: string | null;
  /** Só dígitos do telefone achado; "" se não achou. Vai só para o painel, nunca para o diagnóstico. */
  numero: string;
  /** Trecho em que o número foi achado, com dígitos → 9 e letras → a (para o diagnóstico). */
  formaDoTexto: string;
}

export const SEM_DADOS: DadosContato = { detectada: false, seletor: null, numero: "", formaDoTexto: "" };

// +55, espaços, hífen, ponto e parênteses; DDD + 8 ou 9 dígitos.
const RE_TELEFONE = /(?:\+?\s*55[\s.-]*)?\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]?\d{4}/;

const forma = (t: string) => t.replace(/\d/g, "9").replace(/\p{L}/gu, "a");

/** Primeiro trecho do texto que parece telefone brasileiro, ou null. */
export function acharTelefone(texto: string): { numero: string; trecho: string } | null {
  const m = RE_TELEFONE.exec(texto);
  if (!m) return null;
  const numero = soDigitos(m[0]);
  return numeroValido(numero) ? { numero, trecho: m[0] } : null;
}

function regiaoDeDados(doc: Document, tituloChat: string): { el: Element; seletor: string } | null {
  const tit = normalizarNome(tituloChat);
  if (!tit) return null;
  const painel = acharPainel(doc);
  for (const seletor of SELETORES.dadosContato) {
    let lista: Element[] = [];
    try { lista = Array.from(doc.querySelectorAll(seletor)); } catch { continue; }
    for (const el of lista) {
      if (painel && (el === painel || el.contains(painel))) continue; // a conversa em si não é a aba
      if (el.closest("#pane-side")) continue; // lista de conversas
      if (!RE_DADOS_CONTATO.test(`${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("data-testid") ?? ""}`)) continue;
      const tituloIgual = SELETORES.tituloDadosContato.some((s) => {
        try {
          return Array.from(el.querySelectorAll(s)).some((t) => normalizarNome(t.getAttribute("title") || textoDe(t)) === tit);
        } catch { return false; }
      });
      if (tituloIgual) return { el, seletor };
    }
  }
  return null;
}

/** Procura a aba "Dados do contato" aberta e o número dentro dela. */
export function lerDadosDoContato(doc: Document): DadosContato {
  const painel = acharPainel(doc);
  const titulo = painel ? tituloDoCabecalho(painel) : "";
  const reg = regiaoDeDados(doc, titulo);
  if (!reg) return SEM_DADOS;
  const achado = acharTelefone(textoDe(reg.el).replace(/[‎‏‪-‮]/g, " "));
  if (!achado) return { detectada: true, seletor: reg.seletor, numero: "", formaDoTexto: "" };
  return { detectada: true, seletor: reg.seletor, numero: achado.numero, formaDoTexto: forma(achado.trecho) };
}
