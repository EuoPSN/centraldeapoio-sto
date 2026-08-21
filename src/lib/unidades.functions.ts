import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Unidades/Clínicas — usadas tanto pela Tabela de Preços quanto (depois) pelo Catálogo de Exames.

export const listUnidades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("unidades")
      .select("*")
      .order("position", { ascending: true })
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

const UnidadeInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(150),
  endereco: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  position: z.number().int().default(0),
});

export const upsertUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UnidadeInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("unidades").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("unidades").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("unidades").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
