import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import {
  CONFIG_EXTENSAO_PADRAO, HORARIO_PADRAO, horaValida, intervaloDoPeriodo, resumoEquipe,
  type ConfigExtensao, type ExtensaoAdminDados, type Horario, type LinhaExtensao,
} from "@/lib/extensao-admin";

// Admin > Extensão do WhatsApp. Só contagens e minutos por atendente: nunca conteúdo, nome nem
// telefone de cliente. As leituras passam por funções SQL que só o admin pode chamar.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdminUser(ctx.supabase, ctx.userId))) throw new Error("Apenas administradores.");
}

function horarioSeguro(h: unknown): Horario {
  if (!h || typeof h !== "object") return HORARIO_PADRAO;
  const out: Horario = {};
  for (let d = 0; d < 7; d++) {
    const faixas = (h as Record<string, unknown>)[String(d)];
    out[String(d)] = Array.isArray(faixas)
      ? faixas.filter((f: any) => f && horaValida(String(f.de)) && horaValida(String(f.ate)) && String(f.ate) > String(f.de)).map((f: any) => ({ de: String(f.de), ate: String(f.ate) }))
      : [];
  }
  return out;
}

export async function lerConfigExtensao(ctx: Ctx): Promise<ConfigExtensao> {
  const { data } = await db(ctx).from("extensao_config").select("meta_minutos, nova_conversa_horas, horario").eq("id", 1).maybeSingle();
  if (!data) return CONFIG_EXTENSAO_PADRAO;
  return {
    meta_minutos: Number(data.meta_minutos) || CONFIG_EXTENSAO_PADRAO.meta_minutos,
    nova_conversa_horas: Number(data.nova_conversa_horas) || CONFIG_EXTENSAO_PADRAO.nova_conversa_horas,
    horario: horarioSeguro(data.horario),
  };
}

export async function linhasExtensao(ctx: Ctx, ini: string, fim: string): Promise<LinhaExtensao[]> {
  const rows = (check(await db(ctx).rpc("extensao_admin_resumo", { _ini: ini, _fim: fim })) ?? []) as Record<string, unknown>[];
  return rows.map((r) => ({
    user_id: String(r.user_id), nome: String(r.nome ?? "Sem nome"),
    tickets_criados: Number(r.tickets_criados ?? 0), atualizados: Number(r.atualizados ?? 0),
    resposta_media: r.resposta_media == null ? null : Number(r.resposta_media),
    conversas_novas: Number(r.conversas_novas ?? 0), dentro_da_meta: Number(r.dentro_da_meta ?? 0),
    ignorados: Number(r.ignorados ?? 0), pausas: Number(r.pausas ?? 0),
    instalou: r.instalou === true, primeiro_evento: (r.primeiro_evento as string | null) ?? null,
  }));
}

export const getExtensaoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ periodo: z.enum(["semana", "mes", "pessoas"]) }).parse(d))
  .handler(async ({ data, context }): Promise<ExtensaoAdminDados> => {
    await requireAdmin(context);
    const { ini, fim, de, ate } = intervaloDoPeriodo(data.periodo);
    const [linhas, config] = await Promise.all([linhasExtensao(context, ini, fim), lerConfigExtensao(context)]);
    return { periodo: data.periodo, de, ate, linhas, config, equipe: resumoEquipe(linhas) };
  });

export const salvarExtensaoConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    meta_minutos: z.number().int().min(1).max(240),
    nova_conversa_horas: z.number().int().min(1).max(168),
    horario: z.record(z.string().regex(/^[0-6]$/), z.array(z.object({ de: z.string(), ate: z.string() })).max(3)),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const horario = horarioSeguro(data.horario);
    for (const d of Object.keys(data.horario)) {
      for (const f of data.horario[d]) {
        if (!horaValida(f.de) || !horaValida(f.ate) || f.ate <= f.de) throw new Error("Confira o horário de atendimento: o fim precisa vir depois do início.");
      }
    }
    check(await db(context).from("extensao_config").upsert({
      id: 1, meta_minutos: data.meta_minutos, nova_conversa_horas: data.nova_conversa_horas, horario, updated_at: new Date().toISOString(),
    }, { onConflict: "id" }));
    return { ok: true };
  });

/** Pendências do Admin: atendentes sem a extensão (só contagem) e tempo médio da semana acima da meta. */
export async function contarPendenciasExtensao(ctx: Ctx): Promise<{ semExtensao: number; acimaDaMeta: number; meta: number }> {
  const { ini, fim } = intervaloDoPeriodo("semana");
  const { ini: iniTudo } = intervaloDoPeriodo("pessoas");
  const [semana, tudo, config] = await Promise.all([linhasExtensao(ctx, ini, fim), linhasExtensao(ctx, iniTudo, fim), lerConfigExtensao(ctx)]);
  return {
    semExtensao: tudo.filter((l) => !l.instalou).length,
    acimaDaMeta: semana.filter((l) => l.resposta_media != null && l.resposta_media > config.meta_minutos).length,
    meta: config.meta_minutos,
  };
}
