// Sanitização das conversas da extensão. Roda em DUAS camadas com este mesmo código:
//  1. no navegador (extension/src/lib/sanitizar.ts é cópia idêntica deste arquivo), ANTES de enviar;
//  2. no servidor (extensaoLerConversa), que nunca confia só no cliente.
// Arquivo puro (sem imports) de propósito: o teste extension/tests/sanitizar-sincronia.test.ts
// garante que as duas cópias não divergem.
//
// Remove telefone, CPF, CNPJ, e-mail, links e sequências longas de dígitos, e troca o nome do
// cliente por [nome]. O telefone completo NUNCA vai para a IA (só para o ticket).

export const SEM_ACENTO: Record<string, string> = {
  a: "aáàâãä", e: "eéèêë", i: "iíìîï", o: "oóòôõö", u: "uúùûü", c: "cç", n: "nñ",
};

const PALAVRAS_LIGACAO = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

function escaparRegex(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Regex de uma palavra que ignora maiúsculas e acentos, só como palavra inteira. */
function regexDaPalavra(palavra: string): RegExp {
  const corpo = Array.from(palavra.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase())
    .map((ch) => (SEM_ACENTO[ch] ? `[${SEM_ACENTO[ch]}${SEM_ACENTO[ch].toUpperCase()}]` : escaparRegex(ch)))
    .join("");
  return new RegExp(`(?<![\\p{L}\\p{N}])${corpo}(?![\\p{L}\\p{N}])`, "giu");
}

/** Pedaços do nome que devem sumir do texto (2+ letras, sem "de", "da"…). */
export function partesDoNome(nome: string | undefined | null): string[] {
  return (nome ?? "")
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((p) => p.length >= 2 && !PALAVRAS_LIGACAO.has(p.toLowerCase()));
}

export function removerDadosPessoais(texto: string): string {
  return (
    texto
      // e-mail
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]")
      // links (com ou sem http) e wa.me
      .replace(/\b(?:https?:\/\/|www\.|wa\.me\/)\S+/gi, "[link]")
      .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|br|io|me|ly|app|gov|edu)(?:\/\S*)?(?![\w@])/gi, "[link]")
      // CNPJ (formatado ou 14 dígitos)
      .replace(/(?<!\d)\d{2}\.\d{3}\.\d{3}\/\d{4}-?\d{2}(?!\d)/g, "[cnpj]")
      .replace(/(?<!\d)\d{14}(?!\d)/g, "[cnpj]")
      // CPF formatado
      .replace(/(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g, "[cpf]")
      // telefone BR: +55, DDD com ou sem parênteses/zero, 9 inicial, hífen/espaço
      .replace(
        /(?<!\d)(?:\+?55[\s.-]*)?(?:\(?0?\d{2}\)?[\s.-]*)?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}(?!\d)/g,
        "[telefone]",
      )
      // CPF só com dígitos (11) que sobrou
      .replace(/(?<!\d)\d{11}(?!\d)/g, "[cpf]")
      // qualquer sequência longa de dígitos (mesmo com espaços ou hífens no meio)
      .replace(/(?<!\d)\d(?:[\s.-]?\d){7,}(?!\d)/g, "[número]")
      .replace(/(?<!\d)\d{6,}(?!\d)/g, "[número]")
  );
}

/** Troca o nome do cliente (completo ou qualquer parte) por [nome]. */
export function trocarNome(texto: string, nome: string | undefined | null): string {
  let out = texto;
  for (const parte of partesDoNome(nome)) out = out.replace(regexDaPalavra(parte), "[nome]");
  return out.replace(/(\[nome\][\s,]*){2,}/g, "[nome] ");
}

export interface OpcoesSanitizar { nome?: string | null }

export function sanitizarTexto(texto: string, opts: OpcoesSanitizar = {}): string {
  return removerDadosPessoais(trocarNome(texto ?? "", opts.nome)).replace(/[ \t]{2,}/g, " ").trim();
}

/** Primeiro nome limpo (para o ticket): sem dados pessoais, até 40 caracteres. */
export function primeiroNome(nome: string | undefined | null): string {
  const p = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return removerDadosPessoais(p).replace(/\[[^\]]*\]/g, "").slice(0, 40).trim();
}

export interface MensagemEntrada { de: "cliente" | "atendente"; texto: string; hora?: string }
export interface MensagemLimpa { de: "cliente" | "atendente"; texto: string; hora: string }

export const LIMITE_MENSAGENS = 60;
export const LIMITE_TEXTO_MENSAGEM = 600;
export const LIMITE_TOTAL = 12000;

/** Sanitiza a lista: últimas 60, cada texto até 600 caracteres, total até 12 mil (mantém as mais recentes). */
export function sanitizarMensagens(msgs: MensagemEntrada[], opts: OpcoesSanitizar = {}): MensagemLimpa[] {
  const limpas = msgs
    .map((m) => ({
      de: m.de === "atendente" ? ("atendente" as const) : ("cliente" as const),
      texto: sanitizarTexto(m.texto, opts).slice(0, LIMITE_TEXTO_MENSAGEM),
      hora: /^\d{1,2}:\d{2}$/.test(m.hora ?? "") ? (m.hora as string) : "",
    }))
    .filter((m) => m.texto)
    .slice(-LIMITE_MENSAGENS);
  let total = 0;
  const out: MensagemLimpa[] = [];
  for (let i = limpas.length - 1; i >= 0; i--) {
    total += limpas[i].texto.length;
    if (total > LIMITE_TOTAL) break;
    out.unshift(limpas[i]);
  }
  return out;
}

/** Última fala do cliente (já sanitizada), para o "O cliente disse…". */
export function ultimaFalaDoCliente(msgs: MensagemLimpa[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].de === "cliente" && !/^\[mídia\]$/.test(msgs[i].texto)) return msgs[i].texto;
  }
  return "";
}

/** Texto corrido para a IA: "Cliente: …" / "Atendente: …". */
export function montarTranscricao(msgs: MensagemLimpa[]): string {
  return msgs.map((m) => `${m.de === "cliente" ? "Cliente" : "Atendente"}${m.hora ? ` (${m.hora})` : ""}: ${m.texto}`).join("\n");
}

// ---------------------------------------------------------------------------
// Telefone: normalização para comparar números (BR) sem duplicar por formato.
// ---------------------------------------------------------------------------

export function soDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Remove o 55 do país quando o número tem tamanho de número brasileiro com DDI (12 ou 13 dígitos). */
export function semDdi(d: string): string {
  return (d.length === 12 || d.length === 13) && d.startsWith("55") ? d.slice(2) : d;
}

/**
 * Chave de comparação: DDD (quando houver) + últimos 8 dígitos. Ignora o 55 e o 9 inicial,
 * então "+55 31 99999-1234", "(31) 9999-1234" e "3199991234" dão a mesma chave.
 * Sem DDD (8 ou 9 dígitos), devolve só os 8 últimos. (Igual a public.chave_telefone no banco.)
 */
export function chaveNumero(v: string): string {
  const d = semDdi(soDigitos(v));
  if (d.length < 8) return "";
  const ult8 = d.slice(-8);
  const resto = d.slice(0, -8);
  const ddd = resto.length >= 2 ? resto.slice(0, 2) : "";
  return ddd + ult8;
}

/** Duas chaves são o mesmo número? Se uma delas não tem DDD, compara só os 8 últimos. */
export function mesmoNumero(a: string, b: string): boolean {
  const ka = chaveNumero(a);
  const kb = chaveNumero(b);
  if (!ka || !kb) return false;
  if (ka.length === kb.length) return ka === kb;
  return ka.slice(-8) === kb.slice(-8);
}

/** Telefone plausível (10 a 13 dígitos). */
export function numeroValido(v: string): boolean {
  const n = soDigitos(v).length;
  return n >= 10 && n <= 13;
}
