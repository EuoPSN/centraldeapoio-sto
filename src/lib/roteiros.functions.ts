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
