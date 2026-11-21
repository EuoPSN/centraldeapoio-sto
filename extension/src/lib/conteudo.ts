// Fala com o content script (via service worker). Só pedidos de leitura.
import type { PedidoContent, ResultadoIdentificar, ResultadoLer } from "./mensagens";

async function pedir<T>(pedido: PedidoContent): Promise<T> {
  try {
    const r = await chrome.runtime.sendMessage({ para: "content", pedido });
    if (r) return r as T;
  } catch {
    /* cai no erro abaixo */
  }
  return { ok: false, motivo: "Não consegui ler esta conversa. Abra o WhatsApp Web e tente de novo.", naoLe: false } as T;
}

export const identificarConversa = () => pedir<ResultadoIdentificar>({ tipo: "omnia:identificar" });
export const lerConversaAberta = (usuarioId: string, hashesIgnorados: string[]) =>
  pedir<ResultadoLer>({ tipo: "omnia:ler", usuarioId, hashesIgnorados });
