// Chaves e helpers do chrome.storage.local (usado pelo painel, pelo service worker e pelo content script).

export const CHAVES = {
  pausada: "omnia_pausada",
  aceite: "omnia_aceite_versao",
  sessao: "omnia_sessao",
} as const;

export async function lerLocal<T>(chave: string, padrao: T): Promise<T> {
  try {
    const r = await chrome.storage.local.get(chave);
    return (r[chave] as T | undefined) ?? padrao;
  } catch {
    return padrao;
  }
}

export async function gravarLocal(chave: string, valor: unknown): Promise<void> {
  await chrome.storage.local.set({ [chave]: valor });
}

export async function estaPausada(): Promise<boolean> {
  return (await lerLocal<boolean>(CHAVES.pausada, false)) === true;
}

/** Estado do cálculo de tempo de resposta e a lista local de quem espera (nomes/prévias nunca saem do navegador). */
export const CHAVES_TEMPO = {
  estado: (usuarioId: string) => `omnia_tempo_estado:${usuarioId}`,
  espera: (usuarioId: string) => `omnia_tempo_espera:${usuarioId}`,
} as const;
