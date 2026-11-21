import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { diaBR } from "@/lib/retomada";
import {
  ehImportante, emVigor, LinkInternoSchema, PerguntaChecagemSchema, TIPOS_MUDANCA, type PerguntaChecagem, type TipoMudanca,
} from "@/lib/mudancas";

// Central de Novidades (changelog) — painel flutuante + gestão em Admin → Novidades.

export const listChangelog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("changelog_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    if (await isAdminUser(context.supabase, context.userId)) return rows;
    // Atendente: só o publicado e nunca a pergunta com a resposta certa.
    return rows.filter((r) => r.published).map(({ pergunta_checagem: _p, ...resto }) => resto) as any[];
  });

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

const EntryInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1),
  published: z.boolean().default(true),
  tipo: z.enum(TIPOS_MUDANCA).default("informativa"),
  vale_a_partir: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  link: LinkInternoSchema.nullish(),
  pergunta_checagem: PerguntaChecagemSchema.nullish(),
  usar_na_ia: z.boolean().optional(),
});

type Db = { from: (t: string) => any };

/** Pergunta de checagem vira exercício aprovado do aquecimento (múltipla escolha, no tema escolhido).
 * Sem pergunta, ou com a mudança fora do ar, o exercício é arquivado. Devolve o id ligado. */
async function sincronizarExercicio(
  s: Db, userId: string,
  e: { id: string; title: string; published: boolean; tipo: string; pergunta: PerguntaChecagem | null; exercicio_id: string | null },
): Promise<string | null> {
  const deveExistir = e.published && ehImportante(e.tipo) && !!e.pergunta;
  if (!deveExistir) {
    if (e.exercicio_id) await s.from("aquecimento_exercicios").update({ status: "arquivado" }).eq("id", e.exercicio_id);
    // Mantém a ligação só enquanto a pergunta existe (rascunho reaproveita o exercício ao voltar).
    return e.pergunta ? e.exercicio_id : null;
  }
  const p = e.pergunta!;
  const campos = {
    tema_id: p.tema_id, tipo: "multipla_escolha", titulo: e.title.slice(0, 120), pergunta: p.pergunta,
    alternativas: p.alternativas, explicacao: p.explicacao, fonte: `Mudança: ${e.title}`.slice(0, 200),
    status: "aprovado", criado_por: "admin", aprovado_por: userId,
  };
  if (e.exercicio_id) {
    const { error } = await s.from("aquecimento_exercicios").update(campos).eq("id", e.exercicio_id);
    if (!error) return e.exercicio_id;
  }
  const { data, error } = await s.from("aquecimento_exercicios").insert(campos).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export const upsertChangelogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EntryInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const s = context.supabase as unknown as Db;
    const importante = ehImportante(data.tipo);
    const patch: Record<string, unknown> = {
      title: data.title, summary: data.summary, published: data.published, tipo: data.tipo,
      vale_a_partir: data.vale_a_partir || null,
      validade: data.validade || null,
      link: data.link ? data.link : null,
      pergunta_checagem: importante ? (data.pergunta_checagem ?? null) : null,
    };
    if (data.usar_na_ia !== undefined) patch.usar_na_ia = importante && data.usar_na_ia;
    else if (!importante) patch.usar_na_ia = false;

    let atual: { exercicio_id: string | null } | null = null;
    if (data.id) {
      const { data: r } = await s.from("changelog_entries").select("exercicio_id").eq("id", data.id).maybeSingle();
      atual = r;
    }
    const { data: row, error } = data.id
      ? await s.from("changelog_entries").update(patch).eq("id", data.id).select().single()
      : await s.from("changelog_entries").insert({ ...patch, origem: "manual", criada_por: context.userId, ...(patch.usar_na_ia === undefined ? { usar_na_ia: importante } : {}) }).select().single();
    if (error) throw new Error(error.message);

    const exercicioId = await sincronizarExercicio(s, context.userId, {
      id: row.id, title: row.title, published: row.published, tipo: row.tipo,
      pergunta: patch.pergunta_checagem as PerguntaChecagem | null,
      exercicio_id: atual?.exercicio_id ?? row.exercicio_id ?? null,
    });
    if (exercicioId !== (row.exercicio_id ?? null)) {
      await s.from("changelog_entries").update({ exercicio_id: exercicioId }).eq("id", row.id);
      row.exercicio_id = exercicioId;
    }
    return row;
  });

export const deleteChangelogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const s = context.supabase as unknown as Db;
    const { data: atual } = await s.from("changelog_entries").select("exercicio_id").eq("id", data.id).maybeSingle();
    if (atual?.exercicio_id) await s.from("aquecimento_exercicios").update({ status: "arquivado" }).eq("id", atual.exercicio_id);
    const { error } = await context.supabase.from("changelog_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Admin > Mudanças
// ---------------------------------------------------------------------------

export interface MudancaAdmin {
  id: string; title: string; summary: string; published: boolean; tipo: TipoMudanca; origem: "manual" | "auto";
  vale_a_partir: string | null; validade: string | null; link: string | null;
  pergunta_checagem: PerguntaChecagem | null; usar_na_ia: boolean; incorporada: boolean;
  lembrete_em: string | null; publicada_em: string | null; created_at: string; exercicio_id: string | null;
  /** Só para importante e urgente. */
  total: number; confirmadas: number; acertos: number; com_checagem: number;
  faltam: string[];
}

export interface MudancasAdminDados {
  mudancas: MudancaAdmin[];
  temas: { id: string; nome: string }[];
}

const nomeDe = (p: { display_name: string | null; email: string | null }) =>
  p.display_name?.trim() || String(p.email ?? "").split("@")[0] || "Sem nome";

export const getMudancasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MudancasAdminDados> => {
    await admin(context);
    const s = context.supabase as any;
    const [e, t, r, p] = await Promise.all([
      s.from("changelog_entries").select("*").order("created_at", { ascending: false }),
      s.from("dominio_temas").select("id, nome").eq("ativo", true).order("ordem"),
      s.rpc("changelog_resumo_confirmacoes"),
      s.from("profiles").select("id, display_name, email"),
    ]);
    if (e.error) throw new Error(e.error.message);
    // Migração pendente (sem tabela de temas ou função): a lista segue sem os números.
    const resumo = new Map<string, { total: number; confirmadas: number; acertos: number; com_checagem: number; faltam_ids: string[] }>(
      (r.error ? [] : (r.data ?? []) as { entry_id: string; total: number; confirmadas: number; acertos: number; com_checagem: number; faltam_ids: string[] }[])
        .map((x) => [x.entry_id, x]),
    );
    const nomes = new Map(((p.data ?? []) as { id: string; display_name: string | null; email: string | null }[]).map((x) => [x.id, nomeDe(x)]));
    const mudancas = ((e.data ?? []) as Record<string, unknown>[]).map((x) => {
      const rs = resumo.get(x.id as string);
      const pc = PerguntaChecagemSchema.safeParse(x.pergunta_checagem);
      return {
        ...(x as object),
        pergunta_checagem: pc.success ? pc.data : null,
        total: rs?.total ?? 0, confirmadas: rs?.confirmadas ?? 0, acertos: rs?.acertos ?? 0, com_checagem: rs?.com_checagem ?? 0,
        faltam: (rs?.faltam_ids ?? []).map((id) => nomes.get(id) ?? "Sem nome").sort((a, b) => a.localeCompare(b, "pt-BR")),
      } as MudancaAdmin;
    });
    return { mudancas, temas: ((t.data ?? []) as { id: string; nome: string }[]) };
  });

/** "Lembrar quem falta": grava lembrete_em. A faixa e a notificação do Chrome saem de novo (uma vez
 * por valor) para quem ainda não confirmou. Não envia mensagem para ninguém. */
export const lembrarQuemFalta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await (context.supabase as any).from("changelog_entries").update({ lembrete_em: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** "Incorporada ao Playbook": a mudança sai do bloco "Mudanças recentes" do Cérebro. */
export const marcarMudancaIncorporada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), incorporada: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await (context.supabase as any).from("changelog_entries").update({ incorporada: data.incorporada }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pendência do Admin: importantes ou urgentes em vigor (data de início chegou) com confirmações faltando. */
export async function contarMudancasSemConfirmar(db: any): Promise<{ total: number; primeira: string | null }> {
  const hoje = diaBR(new Date());
  const { data, error } = await db.from("changelog_entries").select("id, title, vale_a_partir, validade, publicada_em")
    .eq("published", true).in("tipo", ["importante", "urgente"]).order("publicada_em", { ascending: true });
  if (error) throw new Error(error.message);
  const emVigorAgora = ((data ?? []) as { id: string; title: string; vale_a_partir: string | null }[])
    .filter((e) => emVigor(e.vale_a_partir, hoje));
  if (!emVigorAgora.length) return { total: 0, primeira: null };
  const r = await db.rpc("changelog_resumo_confirmacoes");
  if (r.error) throw new Error(r.error.message);
  const faltam = new Map(((r.data ?? []) as { entry_id: string; total: number; confirmadas: number }[]).map((x) => [x.entry_id, x.total - x.confirmadas]));
  const pend = emVigorAgora.filter((e) => (faltam.get(e.id) ?? 0) > 0);
  return { total: pend.length, primeira: pend[0]?.title ?? null };
}
