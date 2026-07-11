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
      .select("id,role,content,attachments,created_at")
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
  message: z.string().max(4000).default(""),
  images: z.array(z.string().url()).max(4).default([]),
}).refine((d) => d.message.trim().length > 0 || d.images.length > 0, {
  message: "Envie um texto ou pelo menos uma imagem.",
});




function buildMessageContent(m: { content: string; attachments?: unknown }): string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }> {
  const atts = Array.isArray(m.attachments) ? (m.attachments as string[]) : [];
  if (atts.length === 0) return m.content;
  const parts: Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }> = [];
  if (m.content && m.content.trim().length > 0) parts.push({ type: "text", text: m.content });
  for (const url of atts) parts.push({ type: "image_url", image_url: { url } });
  return parts;
}

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
      attachments: data.images,
    });
    if (insErr) throw new Error(insErr.message);

    // 3) Carrega histórico recente (últimas 12 msgs)
    const { data: history } = await context.supabase
      .from("chat_messages")
      .select("role,content,attachments")
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
    let sources: Array<{ title: string; source_type: string }> = [];
    let foundAny = false;
    let topSimilarity = 0;
    let retrievalMode = "vector";
    try {
      const queryEmb = await generateEmbedding(data.message);
      const { data: matches } = await context.supabase.rpc("match_knowledge", {
        query_embedding: queryEmb as unknown as string,
        match_count: 8,
      });
      if (matches && matches.length > 0) {
        topSimilarity = matches[0].similarity ?? 0;
        // Limiar de similaridade: 0.5
        const relevant = matches.filter((m) => (m.similarity ?? 0) >= 0.5);
        foundAny = relevant.length > 0;
        if (foundAny) {
          ragContext = relevant
            .map((m, i) => `### Fonte ${i + 1} — [${m.source_type}] ${m.title}\n${m.content}`)
            .join("\n\n---\n\n");
          // Dedupe fontes pelo título
          const seen = new Set<string>();
          sources = relevant
            .filter((m) => { if (seen.has(m.title)) return false; seen.add(m.title); return true; })
            .slice(0, 5)
            .map((m) => ({ title: m.title, source_type: m.source_type }));
        }
      }
    } catch (e) {
      console.error("RAG falhou, seguindo sem contexto:", e);
    }

    let reply: string;
    if (!foundAny && data.images.length === 0) {
      reply = "Não encontrei essa informação na base de conhecimento. Peça para um administrador cadastrar esse conteúdo em **Conhecimento → Base de Conhecimento IA** e tente novamente.";
    } else {
      const augmentedSystem = `${systemPrompt}

REGRAS:\r\n- Use as fontes abaixo (Base de Conhecimento da empresa) como sua fonte primária quando houver.\r\n- Se o usuário enviar uma imagem, analise-a e responda com base no que for solicitado, combinando com as fontes quando fizer sentido.\r\n- Se as fontes responderem parcialmente, responda com o que houver e indique de forma breve o que faltou.\r\n- Se NENHUMA fonte tiver relação com a pergunta e não houver imagem anexada, diga exatamente: "Não encontrei essa informação na base de conhecimento."\r\n- Não invente fatos, valores ou políticas que não estejam nas fontes — isso vale mesmo respondendo de forma mais natural.\r\n- Cite a fonte apenas quando isso ajudar o atendente a confiar na informação, de forma natural dentro da frase — não como uma bibliografia formal.\r\n- Responda como alguém experiente conversando com um colega de trabalho: direto, natural, sem soar como um FAQ robótico.\r\n- Varie a forma de apresentar a informação: um parágrafo curto muitas vezes resolve melhor que uma lista. Use listas numeradas ou com marcadores só quando o conteúdo for mesmo uma sequência de passos ou vários itens distintos.\r\n- Evite repetir a pergunta do usuário de volta antes de responder, e evite começar toda resposta com a mesma estrutura (ex: sempre "De acordo com...").\r\n- Não encha a resposta com ressalvas desnecessárias — vá direto ao que o atendente precisa saber.\r\n

=== FONTES DA BASE DE CONHECIMENTO (top ${sources.length}, modo: ${retrievalMode}, melhor similaridade ${topSimilarity.toFixed(2)}) ===
${ragContext || "(nenhuma fonte relevante encontrada — responda com base na imagem enviada, se houver)"}
=== FIM DAS FONTES ===`;

      reply = await chatCompletion({
        model,
        temperature: 0.35,
        messages: [
          { role: "system", content: augmentedSystem },
          ...ordered.map((m) => ({ role: m.role as "user" | "assistant", content: buildMessageContent(m) })),
        ],
      });
    }

    // Anexa fontes ao corpo da resposta (renderizadas pelo markdown)
    const finalContent = foundAny && sources.length > 0
      ? `${reply}\n\n---\n**Fontes consultadas:**\n${sources.map((s) => `- *${s.source_type}* — ${s.title}`).join("\n")}`
      : reply;

    // 7) Salva resposta
    const { data: assistantMsg, error: aErr } = await context.supabase
      .from("chat_messages")
      .insert({
        conversation_id: data.conversationId,
        role: "assistant",
        content: finalContent,
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
