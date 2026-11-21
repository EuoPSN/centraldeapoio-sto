// Fala com o content script (via service worker). Só pedidos de leitura.
import { MOTIVO_SEM_CONTENT_SCRIPT } from "./textos";
import type { DadosContato, PedidoContent, ResultadoIdentificar, ResultadoLer } from "./mensagens";

async function pedir<T>(pedido: PedidoContent): Promise<T> {
  try {
    const r = await chrome.runtime.sendMessage({ para: "content", pedido });
    if (r) return r as T;
  } catch {
    /* cai no erro abaixo */
  }
  return { ok: false, motivo: MOTIVO_SEM_CONTENT_SCRIPT, naoLe: false, codigo: "sem_content_script" } as T;
}

export const identificarConversa = () => pedir<ResultadoIdentificar>({ tipo: "omnia:identificar" });
export const lerConversaAberta = (usuarioId: string, hashesIgnorados: string[]) =>
  pedir<ResultadoLer>({ tipo: "omnia:ler", usuarioId, hashesIgnorados });

/** Número mostrado na aba "Dados do contato", se o atendente a abriu. Falha em silêncio (sem número). */
export async function lerDadosDoContato(): Promise<DadosContato | null> {
  try {
    const r = await chrome.runtime.sendMessage({ para: "content", pedido: { tipo: "omnia:contato" } satisfies PedidoContent });
    return r && typeof r.detectada === "boolean" ? (r as DadosContato) : null;
  } catch {
    return null;
  }
}
