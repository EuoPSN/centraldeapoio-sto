import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { data: string })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("relatorio_prospeccao")
      .select("*")
      .eq("user_id", context.userId)
      .eq("data", data.data);
    if (error) throw error;
    return rows ?? [];
  });

export const upsertMyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as {
    data: string; area: string;
    ligacoes: number; mensagens: number; ztalk: number;
    tentativas: number; oportunidades: number; vendas: number;
  })
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      data: data.data,
      area: data.area,
      ligacoes: data.ligacoes,
      mensagens: data.mensagens,
      ztalk: data.ztalk,
      tentativas: data.tentativas,
      oportunidades: data.oportunidades,
      vendas: data.vendas,
      updated_at: new Date().toISOString(),
    };
    const { data: result, error } = await context.supabase
      .from("relatorio_prospeccao")
      .upsert(row, { onConflict: "user_id,data,area" })
      .select().single();
    if (error) throw error;
    return result;
  });

export const getAllReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { dataInicio?: string; dataFim?: string; userId?: string })
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("relatorio_prospeccao")
      .select("*, profiles!relatorio_prospeccao_user_id_fkey(display_name, email)")
      .order("data", { ascending: false })
      .order("area", { ascending: true });
    if (data.dataInicio) query = query.gte("data", data.dataInicio);
    if (data.dataFim) query = query.lte("data", data.dataFim);
    if (data.userId) query = query.eq("user_id", data.userId);
    const { data: rows, error } = await query;
    if (error) throw error;
    return rows ?? [];
  });

export const getAllUsers = createServerFn()
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("profiles")
      .select("id, display_name, email, cargo")
      .order("display_name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const updateUserCargo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { userId: string; cargo: string | null })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("profiles")
      .update({ cargo: data.cargo })
      .eq("id", data.userId);
    if (error) throw error;
    return { ok: true };
  });
