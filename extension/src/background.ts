// Service worker. Faz só quatro coisas:
//  1. abre o painel lateral ao clicar no ícone;
//  2. mostra no ícone se a extensão está pausada;
//  3. repassa pedidos do painel ao content script da aba ativa (que só existe no WhatsApp Web);
//  4. recebe a varredura da lista de conversas (dentro do navegador) e calcula o tempo de resposta.
import { CHAVES, estaPausada } from "./lib/armazenamento";
import type { PedidoViaBackground, VarreduraLista } from "./lib/mensagens";
import { MOTIVO_SEM_CONTENT_SCRIPT } from "./lib/textos";
import { tratarVarredura } from "./lib/tempo-servico";

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

chrome.runtime.onMessage.addListener((msg: PedidoViaBackground | VarreduraLista, sender, responder) => {
  // Varredura da lista (vem só do content script do WhatsApp Web; fica dentro do navegador).
  if ((msg as VarreduraLista)?.tipo === "varredura:lista") {
    if (sender.id !== chrome.runtime.id || !sender.tab) return false;
    void tratarVarredura((msg as VarreduraLista).itens).finally(() => responder({ ok: true }));
    return true;
  }
  if ((msg as PedidoViaBackground)?.para !== "content") return false;
  const pedido = (msg as PedidoViaBackground).pedido;
  (async () => {
    let dominio = "indisponível"; // sem a permissão "tabs", o Chrome só revela a URL se o content script responder
    try {
      if (await estaPausada()) {
        responder({ ok: false, motivo: "A extensão está pausada.", naoLe: true, codigo: "pausada" });
        return;
      }
      const [aba] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!aba?.id) {
        responder({ ok: false, motivo: MOTIVO_SEM_CONTENT_SCRIPT, naoLe: false, codigo: "sem_content_script", dominio: "indisponível" });
        return;
      }
      try { if (aba.url) dominio = new URL(aba.url).hostname; } catch { /* mantém indisponível */ }
      const r = await chrome.tabs.sendMessage(aba.id, pedido);
      if (!r) throw new Error("sem resposta");
      responder(r);
    } catch {
      responder({ ok: false, motivo: MOTIVO_SEM_CONTENT_SCRIPT, naoLe: false, codigo: "sem_content_script", dominio });
    }
  })();
  return true; // resposta assíncrona
});
