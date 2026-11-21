import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { diaBR } from "@/lib/retomada";
import {
  ehImportante, expirou, PerguntaChecagemSchema,
  STATUS_MUDANCAS_VAZIO,
  type NovidadeView, type PerguntaChecagem, type StatusMudancas, type TipoMudanca,
} from "@/lib/mudancas";

// Novidades e mudanças — lado do atendente. O navegador nunca recebe a alternativa correta
// nem a explicação antes de a pessoa responder.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
const UUID = z.string().uuid();
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

interface EntryRow {
  id: string; title: string; summary: string; tipo: TipoMudanca; origem: "manual" | "auto";
  vale_a_partir: string | null; validade: string | null; link: string | null;
  pergunta_checagem: unknown; publicada_em: string | null; created_at: string; lembrete_em: string | null;
}

const COLUNAS = "id, title, summary, tipo, origem, vale_a_partir, validade, link, pergunta_checagem, publicada_em, created_at, lembrete_em";

function perguntaValida(v: unknown): PerguntaChecagem | null {
  const r = PerguntaChecagemSchema.safeParse(v);
  return r.success ? r.data : null;
}

async function lerPublicadas(ctx: Ctx): Promise<{ entries: EntryRow[]; confirmadas: Map<string, string> }> {
  const s = db(ctx);
  const [e, c] = await Promise.all([
    s.from("changelog_entries").select(COLUNAS).eq("published", true).order("publicada_em", { ascending: false }),
    s.from("changelog_confirmacoes").select("entry_id, confirmado_em").eq("user_id", ctx.userId),
  ]);
  const confirmadas = new Map(((check(c) ?? []) as { entry_id: string; confirmado_em: string }[]).map((x) => [x.entry_id, x.confirmado_em]));
  return { entries: (check(e) ?? []) as EntryRow[], confirmadas };
}

export const getNovidades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NovidadeView[]> => {
    const hoje = diaBR(new Date());
    const { entries, confirmadas } = await lerPublicadas(context);
    return entries.map((e) => {
      const p = ehImportante(e.tipo) ? perguntaValida(e.pergunta_checagem) : null;
      const confirmado = confirmadas.get(e.id) ?? null;
      return {
        id: e.id, title: e.title, summary: e.summary, tipo: e.tipo, origem: e.origem,
        vale_a_partir: e.vale_a_partir, validade: e.validade, link: e.link,
        publicada_em: e.publicada_em ?? e.created_at,
        pergunta: p ? { pergunta: p.pergunta, alternativas: p.alternativas.map((a) => ({ texto: a.texto })) } : null,
        confirmado_em: confirmado,
        pendente: ehImportante(e.tipo) && !confirmado && !expirou(e.validade, hoje),
      };
    });
  });

/** Contagem e título das pendentes (faixa do Início, bolinha do menu e notificação das urgentes). */
export const getStatusMudancas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatusMudancas> => {
    try {
      const hoje = diaBR(new Date());
      const { entries, confirmadas } = await lerPublicadas(context);
      const pend = entries
        .filter((e) => ehImportante(e.tipo) && !confirmadas.has(e.id) && !expirou(e.validade, hoje))
        .sort((a, b) => (a.publicada_em ?? a.created_at).localeCompare(b.publicada_em ?? b.created_at));
      return {
        pendentes: pend.length,
        mais_antiga: pend[0] ? { id: pend[0].id, title: pend[0].title } : null,
        avisos: pend.filter((e) => e.tipo === "urgente" || e.lembrete_em).map((e) => ({ id: e.id, title: e.title, tipo: e.tipo, lembrete_em: e.lembrete_em })),
      };
    } catch (err) {
      // Migração pendente: a Omnia segue sem a faixa.
      console.error("Mudanças indisponíveis (migração pendente?):", err);
      return STATUS_MUDANCAS_VAZIO;
    }
  });

async function lerParaChecar(ctx: Ctx, entryId: string) {
  const { data, error } = await db(ctx).from("changelog_entries")
    .select("id, tipo, published, pergunta_checagem").eq("id", entryId).eq("published", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Esta mudança não está mais disponível.");
  return { tipo: data.tipo as string, pergunta: perguntaValida(data.pergunta_checagem) };
}

/** Mostra a resposta certa e a explicação. Não grava nada: a confirmação grava o acerto. */
export const checarMudanca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ entry_id: UUID, indice: z.number().int().min(0).max(2) }).parse(d))
  .handler(async ({ data, context }) => {
    const e = await lerParaChecar(context, data.entry_id);
    if (!e.pergunta) throw new Error("Esta mudança não tem pergunta.");
    const correta_i = e.pergunta.alternativas.findIndex((a) => a.correta);
    return { acertou: data.indice === correta_i, correta_i, explicacao: e.pergunta.explicacao };
  });

export const confirmarMudanca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ entry_id: UUID, indice: z.number().int().min(0).max(2).nullish() }).parse(d))
  .handler(async ({ data, context }) => {
    const e = await lerParaChecar(context, data.entry_id);
    let acertou: boolean | null = null;
    if (e.pergunta) {
      if (data.indice == null) throw new Error("Responda a pergunta antes de confirmar.");
      acertou = e.pergunta.alternativas[data.indice]?.correta === true;
    }
    const { error } = await db(context).from("changelog_confirmacoes")
      .insert({ entry_id: data.entry_id, user_id: context.userId, acertou_checagem: acertou });
    // Já confirmada antes (índice único): trata como feito.
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true, acertou };
  });
