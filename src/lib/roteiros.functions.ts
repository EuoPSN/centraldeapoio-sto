import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { tabela } from "@/lib/db-novas-tabelas";

async function admin(ctx: { supabase: unknown; userId: string }) {
  const ok = await isAdminUser(ctx.supabase as never, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

const vazio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const Duracao = z.preprocess(
  vazio,
  z.string().trim().regex(/^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/, "Duração no formato 0:38.").nullable().optional(),
);
const Dicas = z.array(z.string().trim().min(1).max(300)).max(12).default([]);

// ---------------------------------------------------------------------------
// Roteiros de áudio
// ---------------------------------------------------------------------------

/**
 * Roteiros (a política do banco entrega só as publicadas ao atendente) + os áudios publicados da
 * cadência de retomada, somente leitura. Os áudios da cadência não são copiados: vêm direto da
 * tabela cadencia_mensagens.
 */
export const listRoteirosAudio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [r, c] = await Promise.all([
      tabela(context.supabase, "roteiros_audio").select("*").order("position", { ascending: true }).order("created_at", { ascending: true }),
      tabela(context.supabase, "cadencia_mensagens")
        .select("id, ponto_parada, etapa, texto, por_que, audio_exemplo_url, status, canal")
        .eq("canal", "audio").eq("status", "publicada"),
    ]);
    if (r.error) throw new Error(r.error.message);
    return {
      roteiros: (r.data ?? []) as any[],
      cadencia: (c.error ? [] : (c.data ?? [])) as any[],
    };
  });

const AudioInput = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(1, "Informe o título.").max(150),
  categoria: z.string().trim().min(1, "Informe a categoria.").max(60),
  situacao: z.string().trim().max(400).default(""),
  texto: z.string().trim().max(4000).default(""),
  dicas: Dicas,
  audio_url: z.preprocess(vazio, z.string().trim().max(300).nullable().optional()),
  duracao: Duracao,
  status: z.enum(["rascunho", "publicada"]).default("rascunho"),
  position: z.number().int().default(0),
}).refine((d) => d.status === "rascunho" || d.texto.length > 0, { message: "Escreva o texto antes de publicar.", path: ["texto"] });

export const upsertRoteiroAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AudioInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const q = tabela(context.supabase, "roteiros_audio");
    const { data: r, error } = data.id
      ? await q.update(data).eq("id", data.id).select().single()
      : await q.insert(data).select().single();
    if (error) throw new Error(error.message);
    return r as any;
  });

export const deleteRoteiroAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: antes } = await tabela(context.supabase, "roteiros_audio").select("audio_url").eq("id", data.id).maybeSingle();
    const { error } = await tabela(context.supabase, "roteiros_audio").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    // Apaga o arquivo do Storage também (sem travar a exclusão se falhar).
    if (antes?.audio_url) {
      await (context.supabase as any).storage.from("roteiros-audio").remove([antes.audio_url]).catch(() => undefined);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Chave de liberação (recursos_config) e roteiros de ligação
// ---------------------------------------------------------------------------
export const CHAVE_LIGACAO = "scripts_ligacao_liberado";

export const getRecursos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await tabela(context.supabase, "recursos_config").select("chave, valor");
    // Tabela ainda não criada = recurso desligado.
    if (error) return { scripts_ligacao_liberado: false };
    const m = new Map<string, boolean>((data ?? []).map((r: { chave: string; valor: boolean }) => [r.chave, !!r.valor]));
    return { scripts_ligacao_liberado: m.get(CHAVE_LIGACAO) ?? false };
  });

export const setRecursoLigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ liberado: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await tabela(context.supabase, "recursos_config")
      .upsert({ chave: CHAVE_LIGACAO, valor: data.liberado, atualizado_por: context.userId }, { onConflict: "chave" });
    if (error) throw new Error(error.message);
    return { ok: true, liberado: data.liberado };
  });

/** O banco já devolve só publicados e só com a chave ligada para o atendente; admin recebe tudo. */
export const listRoteirosLigacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await tabela(context.supabase, "roteiros_ligacao")
      .select("*").order("position", { ascending: true }).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

const LigacaoInput = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(1, "Informe o título.").max(150),
  etapa: z.enum(["Abertura", "Sondagem", "Apresentação", "Objeções", "Fechamento"]),
  situacao: z.string().trim().max(400).default(""),
  texto: z.string().trim().max(4000).default(""),
  dicas: Dicas,
  status: z.enum(["rascunho", "publicada"]).default("rascunho"),
  position: z.number().int().default(0),
}).refine((d) => d.status === "rascunho" || d.texto.length > 0, { message: "Escreva o texto antes de publicar.", path: ["texto"] });

export const upsertRoteiroLigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LigacaoInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const q = tabela(context.supabase, "roteiros_ligacao");
    const { data: r, error } = data.id
      ? await q.update(data).eq("id", data.id).select().single()
      : await q.insert(data).select().single();
    if (error) throw new Error(error.message);
    return r as any;
  });

export const deleteRoteiroLigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await tabela(context.supabase, "roteiros_ligacao").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
