// Normalização de números de telefone (BR) e hash para a lista de ignorados.
// As funções de comparação vêm da cópia da sanitização (iguais às do servidor).
import { chaveNumero, semDdi, soDigitos } from "./sanitizar";
export { chaveNumero, mesmoNumero, numeroValido, semDdi, soDigitos } from "./sanitizar";
import { numeroValido } from "./sanitizar";

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
