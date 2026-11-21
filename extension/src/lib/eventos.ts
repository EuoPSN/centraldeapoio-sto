// Eventos de uso para o Admin: só o TIPO e a hora. Nunca conteúdo, nome nem número.
import { supabase } from "./supabase";

export type TipoEvento = "ticket_criado" | "ticket_atualizado" | "conversa_ignorada" | "pausou" | "despausou" | "leitura";

/** Falha em silêncio: um evento que não gravou nunca atrapalha o atendente. */
export async function registrarEvento(usuarioId: string, tipo: TipoEvento): Promise<void> {
  try {
    await supabase.from("extensao_eventos").insert({ user_id: usuarioId, tipo });
  } catch {
    /* ignora */
  }
}
