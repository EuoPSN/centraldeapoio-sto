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
    data: string; canal: string;
    tentativas: number; oportunidades: number; vendas: number;
  })
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      data: data.data,
      area: data.canal,
      ligacoes: data.canal === "Ligações" ? data.tentativas : 0,
      mensagens: data.canal === "Mensagens" ? data.tentativas : 0,
      ztalk: data.canal === "Ztalk" ? data.tentativas : 0,
      tentativas: data.tentativas,
      oportunidades: data.oportunidades,
      vendas: data.vendas,
      updated_at: new Date().toISOString(),
    };
    const { data: result, error } = await (context.supabase as any)
      .from("relatorio_prospeccao")
      .upsert(row, { onConflict: "user_id,data,area" })
      .select().single();
    if (error) throw error;
    return result;
  });

export const getAllReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as {
    dataInicio?: string; dataFim?: string;
    userId?: string; cargo?: string;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    let query = db
      .from("relatorio_prospeccao")
      .select("*")
      .order("data", { ascending: false })
      .order("area", { ascending: true });
    if (data.dataInicio) query = query.gte("data", data.dataInicio);
    if (data.dataFim) query = query.lte("data", data.dataFim);
    if (data.userId) query = query.eq("user_id", data.userId);
    const { data: rows, error } = await query;
    if (error) throw error;
    const list = rows ?? [];
    const userIds = [...new Set(list.map((r: any) => r.user_id).filter(Boolean))];
    const profilesById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await db
        .from("profiles")
        .select("id, display_name, email, cargo")
        .in("id", userIds);
      if (profilesError) throw profilesError;
      for (const profile of profiles ?? []) profilesById[profile.id] = profile;
    }
    let reports = list.map((report: any) => ({
      ...report,
      profiles: profilesById[report.user_id] ?? null,
    }));
    if (data.cargo) {
      reports = reports.filter((r: any) => r.profiles?.cargo === data.cargo);
    }
    return reports;
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

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Forbidden");
}

export const adminUpsertReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as {
    userId: string; data: string; canal: string;
    tentativas: number; oportunidades: number; vendas: number;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      user_id: data.userId,
      data: data.data,
      area: data.canal,
      ligacoes: data.canal === "Ligações" ? data.tentativas : 0,
      mensagens: data.canal === "Mensagens" ? data.tentativas : 0,
      ztalk: data.canal === "Ztalk" ? data.tentativas : 0,
      tentativas: data.tentativas,
      oportunidades: data.oportunidades,
      vendas: data.vendas,
      updated_at: new Date().toISOString(),
    };
    const { data: result, error } = await (context.supabase as any)
      .from("relatorio_prospeccao")
      .upsert(row, { onConflict: "user_id,data,area" })
      .select().single();
    if (error) throw error;
    return result;
  });

export const adminDeleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("relatorio_prospeccao")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });