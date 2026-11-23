import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { rpc, tabela } from "@/lib/db-novas-tabelas";
import { maisPerguntadas } from "@/lib/duvidas";

async function admin(ctx: { supabase: unknown; userId: string }) {
  const ok = await isAdminUser(ctx.supabase as never, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

/** Atendente recebe só as publicadas (a política do banco já filtra); admin recebe tudo. */
export const listDuvidas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await tabela(context.supabase, "duvidas_frequentes")
      .select("*").order("position", { ascending: true }).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

/** Pendências para "O que precisa de você". */
export async function contarDuvidasRascunho(db: unknown): Promise<number> {
  const r = await tabela(db, "duvidas_frequentes").select("id", { count: "exact", head: true }).eq("status", "rascunho");
  if (r.error) throw new Error(r.error.message);
  return r.count ?? 0;
}

const DuvidaInput = z.object({
  id: z.string().uuid().optional(),
  tema: z.string().trim().min(1, "Informe o tema.").max(60),
  pergunta: z.string().trim().min(1, "Escreva a pergunta.").max(300),
  resposta: z.string().trim().max(4000).default(""),
  status: z.enum(["rascunho", "publicada"]).default("rascunho"),
  origem: z.enum(["manual", "marciana"]).default("manual"),
  position: z.number().int().default(0),
}).refine((d) => d.status === "rascunho" || d.resposta.length > 0, { message: "Escreva a resposta antes de publicar.", path: ["resposta"] });

export const upsertDuvida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DuvidaInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const q = tabela(context.supabase, "duvidas_frequentes");
    const { data: r, error } = data.id
      ? await q.update(data).eq("id", data.id).select().single()
      : await q.insert(data).select().single();
    if (error) throw new Error(error.code === "23505" ? "Já existe uma dúvida com essa pergunta." : error.message);
    return r as any;
  });

export const deleteDuvida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await tabela(context.supabase, "duvidas_frequentes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registerDuvidaCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await rpc(context.supabase, "increment_duvida_copias", { p_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** "Virar dúvida frequente": cria um rascunho só com a pergunta (a resposta o Paulo escreve). */
export const criarDuvidaDaPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pergunta: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const q = tabela(context.supabase, "duvidas_frequentes");
    const { data: ja } = await q.select("*").ilike("pergunta", data.pergunta.replace(/[%_\\]/g, "\\$&")).limit(1);
    if (ja?.length) return { ...(ja[0] as any), jaExistia: true };
    const { data: r, error } = await q
      .insert({ tema: "Planos", pergunta: data.pergunta, resposta: "", status: "rascunho", origem: "marciana", position: 1000 })
      .select().single();
    if (error) throw new Error(error.message);
    return { ...(r as any), jaExistia: false };
  });

// ---------------------------------------------------------------------------
// "Mais perguntadas à MarcIAna" (Admin). Últimos 30 dias.
// Só agrupa perguntas IGUAIS (ver src/lib/duvidas.ts) e só mostra as que mais de uma pessoa fez
// e que não carregam dado de cliente. Depois, as sugestões ativas da tela da MarcIAna e os
// motivos mais citados nos feedbacks 👎. Nenhum texto livre de feedback é mostrado.
// ---------------------------------------------------------------------------
export const getMaisPerguntadas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const db = supabaseAdmin as any;

    const { data: msgs, error: e1 } = await db
      .from("chat_messages")
      .select("content, conversation:chat_conversations(user_id)")
      .eq("role", "user")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (e1) throw new Error(e1.message);
    const perguntas = maisPerguntadas(
      (msgs ?? []).map((m: { content: string; conversation: { user_id: string } | null }) => ({
        texto: m.content, usuario: m.conversation?.user_id ?? "?",
      })),
    );

    const { data: sug } = await db.from("marciana_sugestoes").select("id,texto").eq("ativo", true).order("ordem", { ascending: true });
    const { data: fb } = await db.from("marciana_feedback").select("motivos").eq("tipo", "nao_util").gte("created_at", desde);
    const tally = new Map<string, number>();
    for (const r of fb ?? []) for (const m of (r.motivos ?? []) as string[]) tally.set(m, (tally.get(m) ?? 0) + 1);
    const motivos = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([motivo, vezes]) => ({ motivo, vezes }));

    return {
      perguntas,
      sugestoes: ((sug ?? []) as { id: string; texto: string }[]),
      naoUteis: (fb ?? []).length,
      motivos,
      agrupamento: "iguais" as const,
    };
  });
