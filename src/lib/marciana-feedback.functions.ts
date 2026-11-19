import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============================================================
// Feedback (útil / não útil) por resposta da MarcIAna
// ============================================================
const FeedbackInput = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  tipo: z.enum(["util", "nao_util"]),
  motivos: z.array(z.string()).default([]),
  comentario: z.string().max(1000).optional().nullable(),
});

export const submitMarcianaFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FeedbackInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("marciana_feedback").upsert(
      {
        message_id: data.messageId,
        conversation_id: data.conversationId,
        user_id: context.userId,
        tipo: data.tipo,
        motivos: data.motivos,
        comentario: data.comentario ?? null,
      },
      { onConflict: "message_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Todo o feedback que o próprio usuário já deu nessa conversa, pra marcar
// 👍/👎 já enviados sem uma consulta por mensagem.
export const listMyFeedbackForConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: fb, error } = await context.supabase
      .from("marciana_feedback")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return fb ?? [];
  });

// ============================================================
// Admin: "Perguntas sem boa resposta" (👎) + contador de 👍/👎
// ============================================================
async function requireAdmin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

export const adminListNegativeFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("marciana_feedback")
      .select(
        `
        id, tipo, motivos, comentario, created_at, resolvido_em, user_id,
        message:chat_messages!marciana_feedback_message_id_fkey(id,content),
        conversation:chat_conversations!marciana_feedback_conversation_id_fkey(id,title)
      `,
      )
      .eq("tipo", "nao_util")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((data ?? []).map((f: any) => f.user_id)));
    const { data: profiles } =
      userIds.length > 0
        ? await supabaseAdmin.from("profiles").select("id,display_name,email").in("id", userIds)
        : { data: [] as any[] };
    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // Também busca a última pergunta do atendente na mesma conversa, antes da resposta marcada.
    const convIds = Array.from(
      new Set((data ?? []).map((f: any) => f.conversation?.id).filter(Boolean)),
    );
    const { data: userMsgs } =
      convIds.length > 0
        ? await supabaseAdmin
            .from("chat_messages")
            .select("id,conversation_id,role,content,created_at")
            .in("conversation_id", convIds)
            .eq("role", "user")
            .order("created_at", { ascending: true })
        : { data: [] as any[] };

    return (data ?? []).map((f: any) => {
      const profile = profileById.get(f.user_id);
      // Última pergunta do atendente na conversa antes desta resposta (aproximação simples).
      const pergunta =
        (userMsgs ?? []).filter((m: any) => m.conversation_id === f.conversation?.id).slice(-1)[0]
          ?.content ?? null;
      return {
        id: f.id,
        tipo: f.tipo,
        motivos: f.motivos,
        comentario: f.comentario,
        created_at: f.created_at,
        resolvido_em: f.resolvido_em,
        quem: profile?.display_name ?? profile?.email ?? "—",
        pergunta,
        resposta: f.message?.content ?? "",
        conversation_id: f.conversation?.id ?? null,
      };
    });
  });

export const adminMarkFeedbackResolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), resolvido: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("marciana_feedback")
      .update({ resolvido_em: data.resolvido ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminFeedbackCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await context.supabase
      .from("marciana_feedback")
      .select("tipo")
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    const util = (data ?? []).filter((f: any) => f.tipo === "util").length;
    const naoUtil = (data ?? []).filter((f: any) => f.tipo === "nao_util").length;
    return { util, naoUtil };
  });
