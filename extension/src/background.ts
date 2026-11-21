// Service worker. Faz só três coisas:
//  1. abre o painel lateral ao clicar no ícone;
//  2. mostra no ícone se a extensão está pausada;
//  3. repassa pedidos do painel ao content script da aba ativa (que só existe no WhatsApp Web).
import { CHAVES, estaPausada } from "./lib/armazenamento";
import type { PedidoViaBackground } from "./lib/mensagens";

async function atualizarIcone() {
  const pausada = await estaPausada();
  await chrome.action.setBadgeText({ text: pausada ? "II" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#B58A35" });
  await chrome.action.setBadgeTextColor?.({ color: "#0B0B0B" });
  await chrome.action.setTitle({ title: pausada ? "OMNIA Apoio · pausada" : "OMNIA Apoio" });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  void atualizarIcone();
});
chrome.runtime.onStartup.addListener(() => void atualizarIcone());
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "local" && CHAVES.pausada in mudancas) void atualizarIcone();
});

chrome.runtime.onMessage.addListener((msg: PedidoViaBackground, _sender, responder) => {
  if (msg?.para !== "content") return false;
  (async () => {
    try {
      if (await estaPausada()) {
        responder({ ok: false, motivo: "A extensão está pausada." });
        return;
      }
      const [aba] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!aba?.id) {
        responder({ ok: false, motivo: "Abra o WhatsApp Web nesta janela." });
        return;
      }
      const r = await chrome.tabs.sendMessage(aba.id, msg.pedido);
      responder(r);
    } catch {
      responder({ ok: false, motivo: "Abra o WhatsApp Web (web.whatsapp.com) nesta aba e tente de novo." });
    }
  })();
  return true; // resposta assíncrona
});
