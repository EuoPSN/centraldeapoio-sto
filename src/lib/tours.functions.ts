import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============================================================
// TUTORIAIS DAS PÁGINAS — quais tours a pessoa já viu (tabela tour_vistos).
// ============================================================

export const listarToursVistos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data, error } = await db.from("tour_vistos").select("tour_id,versao").eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []) as { tour_id: string; versao: number }[];
  });

const MarcarInput = z.object({
  tour_id: z.string().min(1).max(60),
  versao: z.number().int().min(1),
});

export const marcarTourVisto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MarcarInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    // Guarda sempre a maior versão já vista.
    const { data: atual, error: readError } = await db
      .from("tour_vistos")
      .select("versao")
      .eq("user_id", context.userId)
      .eq("tour_id", data.tour_id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    const versao = Math.max(data.versao, (atual?.versao as number | undefined) ?? 1);
    const { error } = await db
      .from("tour_vistos")
      .upsert(
        { user_id: context.userId, tour_id: data.tour_id, versao, visto_em: new Date().toISOString() },
        { onConflict: "user_id,tour_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
