import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "@/lib/supabase.server";

export const listClientProfiles = createServerFn().handler(async () => {
  const context = await createSupabaseServerClient();
  const { data, error } = await context.supabase
    .from("client_profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
});

export const upsertClientProfile = createServerFn()
  .validator((d: {
    id?: string; name: string; personality: string;
    difficulty: string; objectives: string; objections: string; behaviors: string; cliente_nome?: string; cliente_cpf?: string; cliente_regiao?: string; cliente_genero?: string;
  }) => d)
  .handler(async ({ data }) => {
    const context = await createSupabaseServerClient();
    const row = { name: data.name, personality: data.personality,
  difficulty: data.difficulty, objectives: data.objectives,
  objections: data.objections, behaviors: data.behaviors,
  cliente_nome: data.cliente_nome ?? null,
  cliente_cpf: data.cliente_cpf ?? null,
  cliente_regiao: data.cliente_regiao ?? null,
  cliente_genero: data.cliente_genero ?? "masculino" };
    const { data: result, error } = data.id
      ? await context.supabase.from("client_profiles").update(row).eq("id", data.id).select().single()
      : await context.supabase.from("client_profiles").insert(row).select().single();
    if (error) throw error;
    return result;
  });

export const deleteClientProfile = createServerFn()
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const context = await createSupabaseServerClient();
    const { error } = await context.supabase.from("client_profiles").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
