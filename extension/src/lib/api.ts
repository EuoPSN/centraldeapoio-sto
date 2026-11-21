// Chamadas às funções da Omnia (/api/extensao/*). A extensão nunca chama a IA direto.
import { CONFIG } from "../config";
import { supabase, tokenAtual } from "./supabase";

export type RespostaApi<T> = { ok: true; dados: T } | { ok: false; erro: string; codigo: string | null };

export async function chamar<T>(rota: string, corpo: unknown, tentouRenovar = false): Promise<RespostaApi<T>> {
  const token = await tokenAtual();
  if (!token) return { ok: false, erro: "Entre de novo na extensão.", codigo: "sessao" };
  let res: Response;
  try {
    res = await fetch(`${CONFIG.OMNIA_URL}/api/extensao/${rota}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
    });
  } catch {
    return { ok: false, erro: "Sem conexão com a Omnia. Confira a internet e tente de novo.", codigo: "rede" };
  }
  if (res.status === 401 && !tentouRenovar) {
    await supabase.auth.refreshSession().catch(() => undefined);
    return chamar<T>(rota, corpo, true);
  }
  const json = (await res.json().catch(() => null)) as (T & { erro?: string; codigo?: string | null }) | null;
  if (!res.ok) return { ok: false, erro: json?.erro ?? "Não consegui agora. Tente de novo.", codigo: json?.codigo ?? null };
  return { ok: true, dados: json as T };
}
