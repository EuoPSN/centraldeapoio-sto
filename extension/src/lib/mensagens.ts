// Contrato de mensagens entre painel, service worker e content script.
import { chaveNumero } from "./numeros";
import type { ResultadoIdentificar, ResultadoLer } from "../content/ler";

export type PedidoContent =
  | { tipo: "omnia:identificar" }
  | { tipo: "omnia:ler"; usuarioId: string; hashesIgnorados: string[] };

export type { ResultadoIdentificar, ResultadoLer };

/** O painel pede ao service worker, que repassa ao content script da aba ativa do WhatsApp Web. */
export interface PedidoViaBackground { para: "content"; pedido: PedidoContent }

/** Chave do contato para o hash de "ignorados": número normalizado; sem número, o nome. */
export function chaveDoContato(id: { nome: string; numero: string }): string {
  const k = id.numero ? chaveNumero(id.numero) : "";
  return k ? `n:${k}` : `nome:${id.nome.trim().toLowerCase()}`;
}
