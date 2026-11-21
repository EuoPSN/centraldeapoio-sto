// Contatos ignorados: guarda só o hash do número normalizado (nunca o número em claro).
import { supabase } from "./supabase";
import { chaveDoContato } from "./mensagens";
import { hashContato } from "./numeros";

export interface ContatoId { nome: string; numero: string }

export async function carregarHashesIgnorados(): Promise<string[]> {
  const r = await supabase.from("extensao_ignorados").select("numero_hash").limit(2000);
  if (r.error) return []; // sem a lista, o content script ainda barra grupos; o painel avisa nos eventos
  return (r.data ?? []).map((x: { numero_hash: string }) => x.numero_hash);
}

export async function ignorarContato(usuarioId: string, id: ContatoId): Promise<boolean> {
  const hash = await hashContato(usuarioId, chaveDoContato(id));
  const r = await supabase.from("extensao_ignorados").upsert({ user_id: usuarioId, numero_hash: hash }, { onConflict: "user_id,numero_hash", ignoreDuplicates: true });
  return !r.error;
}

export async function voltarALer(usuarioId: string, id: ContatoId): Promise<boolean> {
  const hash = await hashContato(usuarioId, chaveDoContato(id));
  const r = await supabase.from("extensao_ignorados").delete().eq("user_id", usuarioId).eq("numero_hash", hash);
  return !r.error;
}
