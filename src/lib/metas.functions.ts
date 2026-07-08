import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const ok = await isAdminUser(ctx.supabase, ctx.userId);
  if (!ok) throw new Error("Acesso restrito a administradores.");
}

export const listMetas = createServerFn()
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("funcionarios_metas").select("*")
      .order("nome", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const upsertMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as {
    id?: string; nome: string; mes_referencia: string;
    meta_mensal: number; dias_uteis: number;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const row = {
      nome: data.nome, mes_referencia: data.mes_referencia,
      meta_mensal: data.meta_mensal, dias_uteis: data.dias_uteis,
    };
    const { data: result, error } = data.id
      ? await db.from("funcionarios_metas").update(row).eq("id", data.id).select().single()
      : await db.from("funcionarios_metas").insert(row).select().single();
    if (error) throw error;
    return result;
  });

export const deleteMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("funcionarios_metas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
