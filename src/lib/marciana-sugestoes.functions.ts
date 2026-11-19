import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Sugestões de pergunta da tela inicial da MarcIAna (pílulas clicáveis).
export const listMarcianaSugestoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("marciana_sugestoes")
      .select("*")
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function requireAdmin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

const SugestaoInput = z.object({
  id: z.string().uuid().optional(),
  texto: z.string().min(1).max(300),
  ordem: z.number().int().default(0),
  ativo: z.boolean().default(true),
});

export const upsertMarcianaSugestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SugestaoInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: r, error } = data.id
      ? await context.supabase
          .from("marciana_sugestoes")
          .update(data)
          .eq("id", data.id)
          .select()
          .single()
      : await context.supabase.from("marciana_sugestoes").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteMarcianaSugestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("marciana_sugestoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
