// Cliente do backend (Lovable Cloud / Supabase). A sessão fica em chrome.storage.local e é
// renovada sozinha. Só a chave pública (anon) está aqui: as regras de acesso (RLS) é que
// garantem que cada atendente vê só os próprios dados.
import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { CONFIG } from "../config";

const armazenamento: SupportedStorage = {
  async getItem(chave) {
    const r = await chrome.storage.local.get(chave);
    return (r[chave] as string | undefined) ?? null;
  },
  async setItem(chave, valor) {
    await chrome.storage.local.set({ [chave]: valor });
  },
  async removeItem(chave) {
    await chrome.storage.local.remove(chave);
  },
};

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    storage: armazenamento,
    storageKey: "omnia-extensao-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** Token atual para chamar as funções da Omnia (/api/extensao/*). */
export async function tokenAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function usuarioAtualId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
