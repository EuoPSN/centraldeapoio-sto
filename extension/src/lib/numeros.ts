// Normalização de números de telefone (BR) e hash para a lista de ignorados.

/** Só dígitos. */
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
 * Sem DDD (8 ou 9 dígitos), devolve só os 8 últimos.
 */
export function chaveNumero(v: string): string {
  const d = semDdi(soDigitos(v));
  if (d.length < 8) return "";
  const ult8 = d.slice(-8);
  const resto = d.slice(0, -8); // DDD (+ 9 inicial)
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

/** Pelo menos um número de telefone plausível (10 a 13 dígitos). */
export function numeroValido(v: string): boolean {
  const n = soDigitos(v).length;
  return n >= 10 && n <= 13;
}

/** O texto é basicamente um número de telefone (nome exibido de contato não salvo)? */
export function pareceTelefone(texto: string): boolean {
  const t = (texto ?? "").trim();
  return /^[+\d()\s.-]+$/.test(t) && numeroValido(t);
}

/** Hash (SHA-256, hex) usado na lista de ignorados: nunca o número em claro. */
export async function hashContato(usuarioId: string, chave: string): Promise<string> {
  const dados = new TextEncoder().encode(`omnia:${usuarioId}:${chave}`);
  const buf = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Número para mostrar no painel, com o meio escondido: "+55 31 ···· ··12". */
export function numeroMascarado(v: string): string {
  const d = soDigitos(v);
  if (d.length < 8) return "";
  const nac = semDdi(d);
  const ddd = nac.length >= 10 ? nac.slice(0, 2) : "";
  return [nac !== d ? "+55" : "", ddd, "····", `··${d.slice(-2)}`].filter(Boolean).join(" ");
}
