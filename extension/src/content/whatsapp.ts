// Content script (roda só em https://web.whatsapp.com/*).
// Só LÊ, e só quando o painel pede (clique em "Ler esta conversa"). Não clica em nada,
// não rola o histórico, não abre conversas, não escreve na caixa de texto, não envia.
import { identificar, lerConversa, MOTIVO_FALHA } from "./ler";
import { lerDadosDoContato } from "./contato";
import { montarDiagnostico } from "./diagnostico";
import { CHAVES } from "../lib/armazenamento";
import { hashContato } from "../lib/numeros";
import { chaveDoContato, type PedidoContent } from "../lib/mensagens";

async function pausada(): Promise<boolean> {
  try {
    const r = await chrome.storage.local.get(CHAVES.pausada);
    return r[CHAVES.pausada] === true;
  } catch {
    return true; // na dúvida, não lê
  }
}

async function tratar(p: PedidoContent) {
  if (p.tipo === "omnia:diagnostico") {
    // Só estrutura, nunca conteúdo. Pausada: não varre a página, só informa.
    const base = { versao: p.versao, dominio: location.hostname };
    if (await pausada()) return { ...montarDiagnostico(document.implementation.createHTMLDocument(""), base), pausada: true };
    return montarDiagnostico(document, base);
  }
  if (await pausada()) return { ok: false, motivo: "A extensão está pausada.", naoLe: true };
  if (p.tipo === "omnia:contato") return lerDadosDoContato(document);
  if (p.tipo === "omnia:identificar") return identificar(document);
  if (p.tipo === "omnia:ler") {
    return lerConversa(document, async (id) => {
      const h = await hashContato(p.usuarioId, chaveDoContato(id));
      return p.hashesIgnorados.includes(h) ? "Este contato está ignorado." : null;
    });
  }
  return { ok: false, motivo: MOTIVO_FALHA, naoLe: false };
}

chrome.runtime.onMessage.addListener((msg: PedidoContent, _sender, responder) => {
  if (!msg || (msg.tipo !== "omnia:identificar" && msg.tipo !== "omnia:ler" && msg.tipo !== "omnia:diagnostico" && msg.tipo !== "omnia:contato")) return false;
  tratar(msg).then(responder, () => responder({ ok: false, motivo: MOTIVO_FALHA, naoLe: false }));
  return true;
});
