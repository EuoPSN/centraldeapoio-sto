// Contrato de mensagens entre painel, service worker e content script.
import type { Conversa, Identificacao } from "../content/ler";

export type PedidoContent =
  | { tipo: "omnia:identificar" }
  | { tipo: "omnia:ler"; hashesIgnorados: string[]; chaveIgnorado?: string };

export type RespostaIdentificar = { ok: true; id: Identificacao } | { ok: false; motivo: string; naoLe?: boolean };
export type RespostaLer = { ok: true; conversa: Conversa } | { ok: false; motivo: string; naoLe?: boolean };

/** O painel pede ao service worker, que repassa ao content script da aba ativa do WhatsApp Web. */
export interface PedidoViaBackground { para: "content"; pedido: PedidoContent }
