import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listProspeccao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { dataInicio?: string; dataFim?: string; vendedor?: string })
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("prospeccao_diaria")
      .select("*")
      .order("data", { ascending: false });
    if (data.dataInicio) query = query.gte("data", data.dataInicio);
    if (data.dataFim) query = query.lte("data", data.dataFim);
    if (data.vendedor) query = query.eq("vendedor", data.vendedor);
    const { data: rows, error } = await query;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertProspeccao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as {
    id?: string; data: string; vendedor: string; canal: string;
    tentativas: number; oportunidades: number; vendas: number;
  })
  .handler(async ({ data, context }) => {
    const row = {
      data: data.data, vendedor: data.vendedor, canal: data.canal,
      tentativas: data.tentativas, oportunidades: data.oportunidades,
      vendas: data.vendas, created_by: context.userId,
    };
    const { data: result, error } = data.id
      ? await context.supabase.from("prospeccao_diaria").update(row).eq("id", data.id).select().single()
      : await context.supabase.from("prospeccao_diaria").insert(row).select().single();
    if (error) throw error;
    return result;
  });

export const deleteProspeccao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("prospeccao_diaria").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getProspeccaoStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { dataInicio?: string; dataFim?: string })
  .handler(async ({ data, context }) => {
    let query = context.supabase.from("prospeccao_diaria").select("*");
    if (data.dataInicio) query = query.gte("data", data.dataInicio);
    if (data.dataFim) query = query.lte("data", data.dataFim);
    const { data: rows, error } = await query;
    if (error) throw error;
    const all = rows ?? [];

    const vendedores: Record<string, { tentativas: number; oportunidades: number; vendas: number }> = {};
    const canais: Record<string, { tentativas: number; oportunidades: number; vendas: number }> = {};

    let totalTentativas = 0, totalOportunidades = 0, totalVendas = 0;

    for (const r of all) {
      totalTentativas += r.tentativas;
      totalOportunidades += r.oportunidades;
      totalVendas += r.vendas;

      if (!vendedores[r.vendedor]) vendedores[r.vendedor] = { tentativas: 0, oportunidades: 0, vendas: 0 };
      vendedores[r.vendedor].tentativas += r.tentativas;
      vendedores[r.vendedor].oportunidades += r.oportunidades;
      vendedores[r.vendedor].vendas += r.vendas;

      if (!canais[r.canal]) canais[r.canal] = { tentativas: 0, oportunidades: 0, vendas: 0 };
      canais[r.canal].tentativas += r.tentativas;
      canais[r.canal].oportunidades += r.oportunidades;
      canais[r.canal].vendas += r.vendas;
    }

    return {
      total: {
        tentativas: totalTentativas,
        oportunidades: totalOportunidades,
        vendas: totalVendas,
        conversao: totalTentativas > 0 ? ((totalVendas / totalTentativas) * 100).toFixed(1) : "0.0"
      },
      vendedores: Object.entries(vendedores).map(([nome, s]) => ({
        nome,
        ...s,
        conversao: s.tentativas > 0 ? ((s.vendas / s.tentativas) * 100).toFixed(1) : "0.0"
      })).sort((a, b) => b.vendas - a.vendas),
      canais: Object.entries(canais).map(([nome, s]) => ({ nome, ...s }))
    };
  });
