import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const isAdmin = await isAdminUser(ctx.supabase, ctx.userId);
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");
}

export const listClientProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("client_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Training-scoped read: available to any authenticated user, but excludes
// sensitive PII (CPF) so simulation scenarios don't leak tax IDs.
export const listClientProfilesForTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("client_profiles")
      .select("id, name, personality, difficulty, objectives, objections, behaviors, cliente_nome, cliente_regiao, cliente_genero, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ClientProfileInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  personality: z.string().default(""),
  difficulty: z.string().min(1).max(50),
  objectives: z.string().default(""),
  objections: z.string().default(""),
  behaviors: z.string().default(""),
  cliente_nome: z.string().optional().nullable(),
  cliente_cpf: z.string().optional().nullable(),
  cliente_regiao: z.string().optional().nullable(),
  cliente_genero: z.string().optional().nullable(),
});

export const upsertClientProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ClientProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const row = {
      name: data.name,
      personality: data.personality,
      difficulty: data.difficulty,
      objectives: data.objectives,
      objections: data.objections,
      behaviors: data.behaviors,
      cliente_nome: data.cliente_nome ?? null,
      cliente_cpf: data.cliente_cpf ?? null,
      cliente_regiao: data.cliente_regiao ?? null,
      cliente_genero: data.cliente_genero ?? "masculino",
    };
    const { data: result, error } = data.id
      ? await db.from("client_profiles").update(row).eq("id", data.id).select().single()
      : await db.from("client_profiles").insert(row).select().single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteClientProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("client_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });