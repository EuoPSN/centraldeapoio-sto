import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";

// Fechamentos do CRM (Admin). A planilha é lida no navegador: aqui só chegam HASHES de telefone
// (nunca o número, nunca o nome do cliente) e nomes de vendedores (atendentes). Nada é guardado da planilha.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdminUser(ctx.supabase, ctx.userId))) throw new Error("Apenas administradores.");
}
const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nomeDe = (p: { display_name: string | null; email: string | null }) =>
  p.display_name?.trim() || String(p.email ?? "").split("@")[0] || "Sem nome";

export interface CrmEstado {
  mapa: Record<string, string>;
  atendentes: { id: string; nome: string }[];
  ultimo: { ini: string; fim: string; vendas: number; tickets_fechados: number; sem_ticket: number; enviado_em: string } | null;
}

export const getCrmEstado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrmEstado> => {
    await requireAdmin(context);
    const s = db(context);
    const [mapa, perfis, admins, fech] = await Promise.all([
      s.from("crm_vendedor_map").select("vendedor_nome_planilha, user_id"),
      s.from("profiles").select("id, display_name, email, is_active"),
      s.from("user_roles").select("user_id").eq("role", "admin"),
      s.from("crm_fechamentos").select("periodo_ini, periodo_fim, vendas, tickets_fechados, sem_ticket, enviado_em").order("enviado_em", { ascending: false }).limit(2000),
    ]);
    const ehAdmin = new Set(((check(admins) ?? []) as { user_id: string }[]).map((r) => r.user_id));
    const atendentes = ((check(perfis) ?? []) as { id: string; display_name: string | null; email: string | null; is_active: boolean | null }[])
      .filter((p) => p.is_active !== false && !ehAdmin.has(p.id))
      .map((p) => ({ id: p.id, nome: nomeDe(p) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const linhas = (fech.error ? [] : (fech.data ?? [])) as { periodo_ini: string; periodo_fim: string; vendas: number; tickets_fechados: number; sem_ticket: number; enviado_em: string }[];
    let ultimo: CrmEstado["ultimo"] = null;
    if (linhas.length) {
      const em = linhas[0].enviado_em;
      const lote = linhas.filter((l) => l.enviado_em === em);
      ultimo = {
        ini: lote.map((l) => l.periodo_ini).sort()[0], fim: lote.map((l) => l.periodo_fim).sort().slice(-1)[0],
        vendas: lote.reduce((a, l) => a + l.vendas, 0), tickets_fechados: lote.reduce((a, l) => a + l.tickets_fechados, 0),
        sem_ticket: lote.reduce((a, l) => a + l.sem_ticket, 0), enviado_em: em,
      };
    }
    return {
      mapa: Object.fromEntries(((mapa.error ? [] : mapa.data ?? []) as { vendedor_nome_planilha: string; user_id: string }[]).map((m) => [m.vendedor_nome_planilha, m.user_id])),
      atendentes, ultimo,
    };
  });

/** Liga (ou desliga, com user_id nulo) um vendedor da planilha a um usuário da Omnia. */
export const salvarVendedorMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vendedor: z.string().trim().min(1).max(120), user_id: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = db(context);
    if (!data.user_id) check(await s.from("crm_vendedor_map").delete().eq("vendedor_nome_planilha", data.vendedor));
    else check(await s.from("crm_vendedor_map").upsert({ vendedor_nome_planilha: data.vendedor, user_id: data.user_id, updated_at: new Date().toISOString() }, { onConflict: "vendedor_nome_planilha" }));
    return { ok: true };
  });

/** Fecha os tickets abertos do atendente que casam com os hashes. Devolve só hashes. */
export const fecharTicketsCrm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(), hashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(5000), ini: DIA, fim: DIA,
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ fechados: string[]; ja_fechados: string[] }> => {
    await requireAdmin(context);
    const r = check(await db(context).rpc("fechar_tickets_por_crm", { _user_id: data.user_id, _hashes: data.hashes, _ini: data.ini, _fim: data.fim })) as { fechados?: string[]; ja_fechados?: string[] } | null;
    return { fechados: r?.fechados ?? [], ja_fechados: r?.ja_fechados ?? [] };
  });

/** Substitui os dias do período pelas linhas novas (uma transação). */
export const gravarFechamentosCrm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ini: DIA, fim: DIA,
    linhas: z.array(z.object({ user_id: z.string().uuid(), dia: DIA, vendas: z.number().int().min(0).max(100000), tickets_fechados: z.number().int().min(0).max(100000), sem_ticket: z.number().int().min(0).max(100000) })).max(20000),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ gravadas: number }> => {
    await requireAdmin(context);
    if (data.fim < data.ini) throw new Error("O período da planilha está invertido.");
    const n = check(await db(context).rpc("crm_gravar_fechamentos", { _ini: data.ini, _fim: data.fim, _linhas: data.linhas }));
    return { gravadas: Number(n ?? 0) };
  });
