// Contrato de mensagens entre painel, service worker e content script.
import { chaveNumero } from "./numeros";
import type { ResultadoIdentificar, ResultadoLer } from "../content/ler";
import type { Relatorio } from "../content/diagnostico";
import type { DadosDoContato } from "../content/contato";
import type { ItemLista } from "../content/lista";

export type PedidoContent =
  | { tipo: "omnia:identificar" }
  | { tipo: "omnia:ler"; usuarioId: string; hashesIgnorados: string[] }
  | { tipo: "omnia:diagnostico"; versao: string }
  | { tipo: "omnia:contato" };

export type { ResultadoIdentificar, ResultadoLer, Relatorio, DadosDoContato };

/** O painel pede ao service worker, que repassa ao content script da aba ativa do WhatsApp Web. */
export interface PedidoViaBackground { para: "content"; pedido: PedidoContent }

/** Chave do contato para o hash de "ignorados": número normalizado; sem número, o nome. */
export function chaveDoContato(id: { nome: string; numero: string }): string {
  const k = id.numero ? chaveNumero(id.numero) : "";
  return k ? `n:${k}` : `nome:${id.nome.trim().toLowerCase()}`;
}

/** Varredura da lista (content script → service worker, sempre dentro do navegador). Nome e prévia
 * não saem do navegador: o service worker só envia ao servidor a chave em hash, o horário e a direção. */
export interface VarreduraLista { tipo: "varredura:lista"; itens: ItemLista[] }
