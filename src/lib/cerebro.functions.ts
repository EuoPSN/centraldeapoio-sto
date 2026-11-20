import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import { removerDadosPessoais } from "@/lib/cliente-disse";
import {
  ETAPAS_FUNIL, FERRAMENTAS, blocoVazio, contarPalavras, gerarEtapasFunil, gerarPadraoEscrita,
  type CerebroBloco, type FunilEtapa, type PadraoEscritaItem, type RegraFixa,
} from "@/lib/cerebro";
import { diaBR, inicioDiaBR, somarDias } from "@/lib/retomada";

// Cérebro da Omnia — funções de servidor do Painel Admin (só administradores).
// Leitura/escrita pelo cliente do usuário: o RLS das tabelas já é só do Admin
// e o gatilho de versões registra quem editou.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdminUser(ctx.supabase, ctx.userId))) throw new Error("Apenas administradores.");
}
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

const UUID = z.string().uuid();
const FerramentaZ = z.enum(FERRAMENTAS);

// ---------------------------------------------------------------------------
// Skills (blocos), regras, padrão de escrita, etapas do funil
// ---------------------------------------------------------------------------

export interface BlocoAdmin extends CerebroBloco {
  /** Texto que de fato vai para a IA (para blocos gerados, o que vem da tabela). */
  conteudo_efetivo: string;
  palavras: number;
}

export interface CerebroAdminDados {
  blocos: BlocoAdmin[];
  regras: RegraFixa[];
  padrao: PadraoEscritaItem[];
  etapas: FunilEtapa[];
}

export const getCerebroAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CerebroAdminDados> => {
    await requireAdmin(context);
    const s = db(context);
    const [b, r, p, e] = await Promise.all([
      s.from("cerebro_blocos").select("*").order("ordem"),
      s.from("cerebro_regras_fixas").select("*").order("ordem"),
      s.from("padrao_escrita").select("*").order("tipo", { ascending: false }).order("ordem"),
      s.from("funil_etapas").select("*").order("ordem"),
    ]);
    const padrao = (check(p) ?? []) as PadraoEscritaItem[];
    const etapas = (check(e) ?? []) as FunilEtapa[];
    const blocos = ((check(b) ?? []) as CerebroBloco[]).map((x) => {
      const efetivo = x.chave === "padrao_escrita" ? gerarPadraoEscrita(padrao) : x.chave === "etapas_funil" ? gerarEtapasFunil(etapas) : x.conteudo;
      return { ...x, conteudo_efetivo: efetivo, palavras: blocoVazio(efetivo) ? 0 : contarPalavras(efetivo) };
    });
    return { blocos, regras: (check(r) ?? []) as RegraFixa[], padrao, etapas };
  });

export const salvarCerebroBloco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: UUID,
    conteudo: z.string().max(60000).optional(),
    ferramentas: z.array(FerramentaZ).max(7),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const patch: Record<string, unknown> = { ferramentas: [...new Set(data.ferramentas)], ativo: data.ativo };
    if (data.conteudo !== undefined) patch.conteudo = data.conteudo;
    check(await db(context).from("cerebro_blocos").update(patch).eq("id", data.id));
    return { ok: true };
  });

export const salvarRegraFixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: UUID.nullable(),
    texto: z.string().trim().min(3).max(300),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = db(context);
    if (data.id) {
      check(await s.from("cerebro_regras_fixas").update({ texto: data.texto, ativo: data.ativo }).eq("id", data.id));
      return { id: data.id };
    }
    const { data: ult } = await s.from("cerebro_regras_fixas").select("ordem").order("ordem", { ascending: false }).limit(1);
    const ordem = ((ult?.[0]?.ordem as number | undefined) ?? 0) + 10;
    const novo = check(await s.from("cerebro_regras_fixas").insert({ texto: data.texto, ativo: data.ativo, ordem }).select("id").single()) as { id: string };
    return { id: novo.id };
  });

export const excluirRegraFixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("cerebro_regras_fixas").delete().eq("id", data.id));
    return { ok: true };
  });

export const salvarPadraoEscrita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: UUID.nullable(),
    tipo: z.enum(["pode", "nao_pode"]),
    item: z.string().trim().min(2).max(200),
    exemplo_errado: z.string().trim().max(300).default(""),
    exemplo_certo: z.string().trim().max(300).default(""),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = db(context);
    const { id, ...row } = data;
    if (id) {
      check(await s.from("padrao_escrita").update(row).eq("id", id));
      return { id };
    }
    const { data: ult } = await s.from("padrao_escrita").select("ordem").eq("tipo", row.tipo).order("ordem", { ascending: false }).limit(1);
    const ordem = ((ult?.[0]?.ordem as number | undefined) ?? (row.tipo === "pode" ? 0 : 100)) + 10;
    const novo = check(await s.from("padrao_escrita").insert({ ...row, ordem }).select("id").single()) as { id: string };
    return { id: novo.id };
  });

export const excluirPadraoEscrita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("padrao_escrita").delete().eq("id", data.id));
    return { ok: true };
  });

export const salvarFunilEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    etapa: z.enum(ETAPAS_FUNIL),
    nome: z.string().trim().min(2).max(60),
    definicao: z.string().trim().max(1500).default(""),
    sinais: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { etapa, ...rest } = data;
    check(await db(context).from("funil_etapas").update(rest).eq("etapa", etapa));
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Testar um bloco com uma conversa (sem salvar)
// ---------------------------------------------------------------------------

export const testarCerebro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    conversa: z.string().trim().min(1).max(8000),
    chave: z.string().min(1).max(60),
    conteudo: z.string().max(60000),
    ferramentas: z.array(FerramentaZ).max(7),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { analisarCopiloto } = await import("@/lib/cerebro.server");
    return analisarCopiloto({
      texto: removerDadosPessoais(data.conversa),
      imagens: [],
      override: { chave: data.chave, conteudo: data.conteudo, ferramentas: data.ferramentas },
    });
  });

// ---------------------------------------------------------------------------
// Limites de uso
// ---------------------------------------------------------------------------

export interface LimitesAdmin {
  limites: { ferramenta: string; limite_diario: number | null }[];
  extras: { id: string; user_id: string; nome: string; ferramenta: string; extra: number; valido_ate: string }[];
  /** Últimos 7 dias, em números, por ferramenta. */
  uso: Record<string, { hoje: number; semana: number; pessoas: number }>;
  usuarios: { id: string; nome: string }[];
}

export const getLimitesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LimitesAdmin> => {
    await requireAdmin(context);
    const s = db(context);
    const hoje = diaBR(new Date());
    const desde7 = inicioDiaBR(somarDias(hoje, -6)).toISOString();
    const desdeHoje = inicioDiaBR(hoje).getTime();
    const [lim, ext, uso, prof] = await Promise.all([
      s.from("ia_limites").select("ferramenta, limite_diario"),
      s.from("ia_limites_extra").select("*").gt("valido_ate", new Date().toISOString()).order("valido_ate"),
      s.from("ia_uso").select("user_id, ferramenta, created_at").gte("created_at", desde7).limit(50000),
      s.from("profiles").select("id, display_name, email").order("display_name"),
    ]);
    const usuarios = ((check(prof) ?? []) as { id: string; display_name: string | null; email: string | null }[])
      .map((p) => ({ id: p.id, nome: p.display_name?.trim() || String(p.email ?? "").split("@")[0] || "Sem nome" }));
    const nomeDe = new Map(usuarios.map((u) => [u.id, u.nome]));
    const pessoas: Record<string, Set<string>> = {};
    const usoPor: LimitesAdmin["uso"] = {};
    for (const f of FERRAMENTAS) { usoPor[f] = { hoje: 0, semana: 0, pessoas: 0 }; pessoas[f] = new Set(); }
    for (const u of (check(uso) ?? []) as { user_id: string; ferramenta: string; created_at: string }[]) {
      const x = usoPor[u.ferramenta];
      if (!x) continue;
      x.semana += 1;
      if (new Date(u.created_at).getTime() >= desdeHoje) x.hoje += 1;
      pessoas[u.ferramenta].add(u.user_id);
    }
    for (const f of FERRAMENTAS) usoPor[f].pessoas = pessoas[f].size;
    return {
      limites: (check(lim) ?? []) as LimitesAdmin["limites"],
      extras: ((check(ext) ?? []) as LimitesAdmin["extras"]).map((e) => ({ ...e, nome: nomeDe.get(e.user_id) ?? "Sem nome" })),
      uso: usoPor,
      usuarios,
    };
  });

export const salvarLimite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ferramenta: FerramentaZ,
    limite_diario: z.number().int().min(1).max(100000).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("ia_limites").upsert({ ferramenta: data.ferramenta, limite_diario: data.limite_diario }, { onConflict: "ferramenta" }));
    return { ok: true };
  });

export const criarLimiteExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: UUID,
    ferramenta: FerramentaZ,
    extra: z.number().int().min(1).max(1000),
    /** Quantos dias vale a liberação (a contar de agora). */
    dias: z.number().int().min(1).max(90).default(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    // Vale até o fim do último dia (00:00 de Brasília do dia seguinte).
    const fim = inicioDiaBR(somarDias(diaBR(new Date()), data.dias));
    check(await db(context).from("ia_limites_extra").insert({
      user_id: data.user_id, ferramenta: data.ferramenta, extra: data.extra,
      valido_ate: fim.toISOString(), created_by: context.userId,
    }));
    return { ok: true };
  });

export const excluirLimiteExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("ia_limites_extra").delete().eq("id", data.id));
    return { ok: true };
  });
