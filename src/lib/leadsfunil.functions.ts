import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const ok = await isAdminUser(ctx.supabase, ctx.userId);
  if (!ok) throw new Error("Acesso restrito a administradores.");
}

export const listLeadsFunil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { dataInicio?: string; dataFim?: string; origem?: string })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = (supabaseAdmin as any)
      .from("leads_funil").select("*").order("data", { ascending: false });
    if (data.dataInicio) query = query.gte("data", data.dataInicio);
    if (data.dataFim) query = query.lte("data", data.dataFim);
    if (data.origem) query = query.eq("origem", data.origem);
    const { data: rows, error } = await query;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertLeadsFunil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as {
    id?: string; data: string; origem: string;
    leads_entrados: number; qualificados: number; apresentacao: number;
    negociacao: number; vendas_fechadas: number; sem_interesse: number;
    nao_responde: number; desqualificados: number;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const row = {
      data: data.data, origem: data.origem,
      leads_entrados: data.leads_entrados, qualificados: data.qualificados,
      apresentacao: data.apresentacao, negociacao: data.negociacao,
      vendas_fechadas: data.vendas_fechadas, sem_interesse: data.sem_interesse,
      nao_responde: data.nao_responde, desqualificados: data.desqualificados,
      created_by: context.userId,
    };
    const { data: result, error } = data.id
      ? await db.from("leads_funil").update(row).eq("id", data.id).select().single()
      : await db.from("leads_funil").insert(row).select().single();
    if (error) throw error;
    return result;
  });

export const deleteLeadsFunil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("leads_funil").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getLeadsFunilStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { dataInicio?: string; dataFim?: string; origem?: string })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = (supabaseAdmin as any).from("leads_funil").select("*");
    if (data.dataInicio) query = query.gte("data", data.dataInicio);
    if (data.dataFim) query = query.lte("data", data.dataFim);
    if (data.origem) query = query.eq("origem", data.origem);
    const { data: rows, error } = await query;
    if (error) throw error;
    const all = rows ?? [];

    const totals = all.reduce((acc: any, r: any) => ({
      leads_entrados: acc.leads_entrados + r.leads_entrados,
      qualificados: acc.qualificados + r.qualificados,
      apresentacao: acc.apresentacao + r.apresentacao,
      negociacao: acc.negociacao + r.negociacao,
      vendas_fechadas: acc.vendas_fechadas + r.vendas_fechadas,
      sem_interesse: acc.sem_interesse + r.sem_interesse,
      nao_responde: acc.nao_responde + r.nao_responde,
      desqualificados: acc.desqualificados + r.desqualificados,
    }), { leads_entrados: 0, qualificados: 0, apresentacao: 0, negociacao: 0,
         vendas_fechadas: 0, sem_interesse: 0, nao_responde: 0, desqualificados: 0 });

    return {
      ...totals,
      conv_lead_venda: totals.leads_entrados > 0 ? ((totals.vendas_fechadas / totals.leads_entrados) * 100).toFixed(1) : "0.0",
      conv_qualif_venda: totals.qualificados > 0 ? ((totals.vendas_fechadas / totals.qualificados) * 100).toFixed(1) : "0.0",
      taxa_perdidos: totals.leads_entrados > 0 ? (((totals.sem_interesse + totals.nao_responde + totals.desqualificados) / totals.leads_entrados) * 100).toFixed(1) : "0.0",
      por_dia: all,
    };
  });
