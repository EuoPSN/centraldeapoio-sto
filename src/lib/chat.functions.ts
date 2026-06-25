import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion, generateEmbedding } from "./ai-gateway.server";
import { z } from "zod";

// ============================================================
// Listar / criar / deletar conversas
// ============================================================
export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_conversations")
      .select("id,title,created_at,updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_conversations")
      .insert({ user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chat_conversations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS já restringe ao dono (ou admin)
    const { data: msgs, error } = await context.supabase
      .from("chat_messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return msgs ?? [];
  });

// ============================================================
// Mensagem com RAG
// ============================================================
const SendInput = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(4000),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendInput.parse(d))
  .handler(async ({ data, context }) => {
    // 1) Verifica que a conversa pertence ao usuário
    const { data: conv, error: convErr } = await context.supabase
      .from("chat_conversations")
      .select("id,user_id,title")
      .eq("id", data.conversationId)
      .single();
    if (convErr || !conv) throw new Error("Conversa não encontrada");
    if (conv.user_id !== context.userId) throw new Error("Sem permissão");

    // 2) Salva mensagem do usuário
    const { error: insErr } = await context.supabase.from("chat_messages").insert({
      conversation_id: data.conversationId,
      role: "user",
      content: data.message,
    });
    if (insErr) throw new Error(insErr.message);

    // 3) Carrega histórico recente (últimas 12 msgs)
    const { data: history } = await context.supabase
      .from("chat_messages")
      .select("role,content")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false })
      .limit(12);
    const ordered = (history ?? []).slice().reverse();

    // 4) Carrega prompt-base
    const { data: settings } = await context.supabase
      .from("ai_settings")
      .select("system_prompt,model")
      .eq("id", 1)
      .single();
    const systemPrompt = settings?.system_prompt ?? "Você é um assistente do Cartão de Todos.";
    const model = settings?.model ?? "google/gemini-3-flash-preview";

    // 5) RAG: embedding da pergunta + match_knowledge
    let ragContext = "";
    try {
      const queryEmb = await generateEmbedding(data.message);
      const { data: matches } = await context.supabase.rpc("match_knowledge", {
        query_embedding: queryEmb as unknown as string,
        match_count: 8,
      });
      if (matches && matches.length > 0) {
        ragContext = matches
          .map((m, i) => `### Fonte ${i + 1} — [${m.source_type}] ${m.title}\n${m.content}`)
          .join("\n\n---\n\n");
      }
    } catch (e) {
      console.error("RAG falhou, seguindo sem contexto:", e);
    }

    const augmentedSystem = `${systemPrompt}\n\n=== CONTEXTO DO SITE (use SOMENTE essas informações para responder) ===\n${ragContext || "(Nenhum conteúdo cadastrado ainda no site.)"}\n=== FIM DO CONTEXTO ===`;

    // 6) Chama IA
    const reply = await chatCompletion({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: augmentedSystem },
        ...ordered.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });

    // 7) Salva resposta
    const { data: assistantMsg, error: aErr } = await context.supabase
      .from("chat_messages")
      .insert({
        conversation_id: data.conversationId,
        role: "assistant",
        content: reply,
      })
      .select()
      .single();
    if (aErr) throw new Error(aErr.message);

    // 8) Atualiza updated_at + auto-título
    const updates: { updated_at: string; title?: string } = {
      updated_at: new Date().toISOString(),
    };
    if (conv.title === "Nova conversa") {
      updates.title = data.message.slice(0, 60);
    }
    await context.supabase.from("chat_conversations").update(updates).eq("id", data.conversationId);

    return { assistantMessage: assistantMsg };
  });

// ============================================================
// AI Settings
// ============================================================
export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

const SettingsInput = z.object({
  system_prompt: z.string().min(10),
  model: z.string().min(1).default("google/gemini-3-flash-preview"),
});

export const updateAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SettingsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem editar as configurações da IA.");
    const { error } = await context.supabase
      .from("ai_settings")
      .update({ system_prompt: data.system_prompt, model: data.model })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
