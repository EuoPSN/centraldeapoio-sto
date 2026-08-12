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
      .select("*, category:categories(id,name,color)")
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
      .select(`id, name, personality, difficulty, objectives, objections, behaviors,
        cliente_nome, cliente_cpf, cliente_regiao, cliente_genero, cliente_telefone,
        endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
        dependentes, category_id, category:categories(id,name,slug), created_at`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const DependenteInput = z.object({
  nome: z.string().default(""),
  cpf: z.string().optional().nullable(),
  nascimento: z.string().optional().nullable(),
  situacao: z.string().optional().nullable(),
});

const ClientProfileInput = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  personality: TextOrList,
  difficulty: z.string().min(1).max(50),
  objectives: TextOrList,
  objections: TextOrList,
  behaviors: TextOrList,
  cliente_nome: z.string().optional().nullable(),
  cliente_cpf: z.string().optional().nullable(),
  cliente_regiao: z.string().optional().nullable(),
  cliente_genero: z.string().optional().nullable(),
  cliente_telefone: z.string().optional().nullable(),
  endereco_rua: z.string().optional().nullable(),
  endereco_numero: z.string().optional().nullable(),
  endereco_complemento: z.string().optional().nullable(),
  endereco_bairro: z.string().optional().nullable(),
  endereco_cidade: z.string().optional().nullable(),
  endereco_estado: z.string().optional().nullable(),
  endereco_cep: z.string().optional().nullable(),
  dependentes: z.array(DependenteInput).default([]),
});

export const upsertClientProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ClientProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
const row = {
      category_id: data.category_id ?? null,
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
      cliente_telefone: data.cliente_telefone ?? null,
      endereco_rua: data.endereco_rua ?? null,
      endereco_numero: data.endereco_numero ?? null,
      endereco_complemento: data.endereco_complemento ?? null,
      endereco_bairro: data.endereco_bairro ?? null,
      endereco_cidade: data.endereco_cidade ?? null,
      endereco_estado: data.endereco_estado ?? null,
      endereco_cep: data.endereco_cep ?? null,
      dependentes: data.dependentes ?? [],
    };
    const { data: result, error } = data.id
      ? await db.from("client_profiles").update(row).eq("id", data.id).select().single()
      : await db.from("client_profiles").insert(row).select().single();
    if (error) throw new Error(error.message);
    return result;
  });

export const moveClientProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), category_id: z.string().uuid().nullable() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("client_profiles")
      .update({ category_id: data.category_id })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
