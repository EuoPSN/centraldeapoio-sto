// Estado local do painel: Pausar e aceite do aviso "O que a extensão faz".
import { useEffect, useState } from "react";
import { CONFIG } from "../config";
import { CHAVES, estaPausada, gravarLocal, lerLocal } from "./armazenamento";
import { registrarEvento } from "./eventos";
import { supabase } from "./supabase";

/** Pausada? Lembra entre sessões (chrome.storage.local) e acompanha mudanças feitas em outra janela. */
export function usePausada(): boolean {
  const [pausada, setPausada] = useState(false);
  useEffect(() => {
    void estaPausada().then(setPausada);
    const ouvir = (m: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && CHAVES.pausada in m) setPausada(m[CHAVES.pausada].newValue === true);
    };
    chrome.storage.onChanged.addListener(ouvir);
    return () => chrome.storage.onChanged.removeListener(ouvir);
  }, []);
  return pausada;
}

/** Liga/desliga a pausa e registra o evento (só o tipo). Pausar desliga leitura e chamadas. */
export async function alternarPausa(usuarioId: string): Promise<boolean> {
  const nova = !(await estaPausada());
  await gravarLocal(CHAVES.pausada, nova);
  // Ao pausar, o evento sai logo antes de qualquer chamada ser bloqueada; ao despausar, logo depois.
  await registrarEvento(usuarioId, nova ? "pausou" : "despausou");
  return nova;
}

const chaveAceite = (u: string) => `${CHAVES.aceite}:${u}`;

/** O atendente já confirmou o aviso desta versão? Confere o local e, se não achar, a tabela. */
export async function aceiteConfirmado(usuarioId: string): Promise<boolean> {
  if ((await lerLocal<string>(chaveAceite(usuarioId), "")) === CONFIG.VERSAO_ACEITE) return true;
  try {
    const r = await supabase.from("extensao_aceites").select("versao").eq("versao", CONFIG.VERSAO_ACEITE).limit(1);
    if (!r.error && (r.data?.length ?? 0) > 0) {
      await gravarLocal(chaveAceite(usuarioId), CONFIG.VERSAO_ACEITE);
      return true;
    }
  } catch {
    /* sem rede: pede de novo */
  }
  return false;
}

export async function confirmarAceite(usuarioId: string): Promise<void> {
  await gravarLocal(chaveAceite(usuarioId), CONFIG.VERSAO_ACEITE);
  try {
    await supabase.from("extensao_aceites").upsert({ user_id: usuarioId, versao: CONFIG.VERSAO_ACEITE }, { onConflict: "user_id,versao", ignoreDuplicates: true });
  } catch {
    /* o aceite local já vale; a tabela é o registro */
  }
}
