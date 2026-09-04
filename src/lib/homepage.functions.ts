import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listHomepageMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("homepage_messages")
      .select("*")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

const MessageInput = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(1).max(200),
  subtitulo: z.string().nullable().optional(),
  cor_fundo: z.string().min(1).max(20).default("#F1F5F9"),
  cor_fundo_2: z.string().max(20).nullable().optional(),
  fonte: z.enum(["padrao", "arredondada", "elegante", "festiva"]).default("padrao"),
  tipo: z.enum(["padrao", "data_especial", "aniversario"]).default("padrao"),
  data_inicio: z.string().nullable().optional(),
  data_fim: z.string().nullable().optional(),
  ativo: z.boolean().default(true),
  position: z.number().int().default(0),
});

export const upsertHomepageMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MessageInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("homepage_messages").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("homepage_messages").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteHomepageMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("homepage_messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
