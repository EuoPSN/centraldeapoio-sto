
import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
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

type RagMatch = {
  id: string;
  source_type: string;
  source_id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity?: number | null;
  lexicalScore?: number;
};

const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos", "e", "em", "eu", "me", "na", "nas", "no", "nos",
  "o", "os", "ou", "para", "por", "que", "quais", "qual", "quando", "quanto", "sao", "são", "se", "um", "uma", "uns", "umas",
  "preciso", "necessario", "necessarios", "necessária", "necessárias", "necessário", "necessários", "precisa", "precisam",
]);

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getSearchTerms(question: string) {
  const normalized = normalizeSearchText(question);
  const terms = normalized
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));

  const expanded = new Set(terms);
  const add = (...items: string[]) => items.forEach((item) => expanded.add(item));

  if (terms.some((term) => ["documento", "documentos", "doc"].includes(term))) {
    add("documento", "documentos", "cadastro", "cpf", "nascimento", "endereco", "email");
  }
  if (terms.some((term) => ["cadastro", "cadastrar", "adesao", "filiacao", "filiação"].includes(term))) {
    add("cadastro", "cadastrar", "adesao", "filiacao", "documentos", "cpf", "email", "cep");
  }

  return Array.from(expanded).slice(0, 10);
}

function scoreLexicalMatch(match: RagMatch, terms: string[]) {
  const title = normalizeSearchText(match.title ?? "");
  const content = normalizeSearchText(match.content ?? "");
  return terms.reduce((score, term) => {
    const singular = term.endsWith("s") ? term.slice(0, -1) : term;
    const variants = Array.from(new Set([term, singular].filter((v) => v.length >= 3)));
    const termScore = variants.reduce((subtotal, variant) => {
      let next = subtotal;
      if (title.includes(variant)) next += 4;
      if (content.includes(variant)) next += 1;
      return next;
    }, 0);
    return score + Math.min(termScore, 5);
  }, 0);
}

async function fetchLexicalMatches(supabaseAdmin: { from: (table: string) => any }, question: string): Promise<RagMatch[]> {
  const terms = getSearchTerms(question);
  if (terms.length === 0) return [];

  const escapedTerms = terms
    .map((term) => term.replace(/[,%]/g, ""))
    .filter((term) => term.length >= 3);
  if (escapedTerms.length === 0) return [];

  const orFilter = escapedTerms
    .flatMap((term) => [`title.ilike.%${term}%`, `content.ilike.%${term}%`])
    .join(",");

  const { data, error } = await supabaseAdmin
    .from("knowledge_chunks")
    .select("id,source_type,source_id,title,content,metadata")
    .or(orFilter)
    .limit(20);

  if (error) {
    console.error("Busca lexical na base falhou:", error);
    return [];
  }

  return ((data ?? []) as RagMatch[])
    .map((match) => ({ ...match, lexicalScore: scoreLexicalMatch(match, terms) }))
    .filter((match) => (match.lexicalScore ?? 0) >= 2)
    .sort((a, b) => (b.lexicalScore ?? 0) - (a.lexicalScore ?? 0))
    .slice(0, 8);
}

function combineRagMatches(vectorMatches: RagMatch[], lexicalMatches: RagMatch[]) {
  const byId = new Map<string, RagMatch>();
  for (const match of [...lexicalMatches, ...vectorMatches]) {
    const current = byId.get(match.id);
    if (!current) {
      byId.set(match.id, match);
      continue;
    }
    byId.set(match.id, {
      ...current,
      ...match,
      similarity: Math.max(current.similarity ?? 0, match.similarity ?? 0),
      lexicalScore: Math.max(current.lexicalScore ?? 0, match.lexicalScore ?? 0),
    });
  }

  return Array.from(byId.values())
    .sort((a, b) => ((b.lexicalScore ?? 0) + (b.similarity ?? 0) * 10) - ((a.lexicalScore ?? 0) + (a.similarity ?? 0) * 10))
    .slice(0, 8);
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

    // 4) Carrega prompt-base (admin-only table; uso de service role no servidor)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("ai_settings")
      .select("system_prompt,model")
      .eq("id", 1)
      .single();
    const systemPrompt = settings?.system_prompt ?? "Você é um assistente do Cartão de Todos.";
    const model = settings?.model ?? "google/gemini-3-flash-preview";

    // 5) RAG híbrido: busca textual primeiro (não consome IA) + embedding semântico como complemento.
    let ragContext = "";
    let sources: Array<{ title: string; source_type: string }> = [];
    let foundAny = false;
    let topSimilarity = 0;
    let retrievalMode = "sem resultados";
    const lexicalMatches = await fetchLexicalMatches(supabaseAdmin, data.message);
    let vectorMatches: RagMatch[] = [];

    try {
      const queryEmb = await generateEmbedding(data.message);
      const { data: matches } = await supabaseAdmin.rpc("match_knowledge", {
        query_embedding: queryEmb as unknown as string,
        match_count: 8,
      });
      if (matches && matches.length > 0) {
        topSimilarity = matches[0]?.similarity ?? 0;
        vectorMatches = (matches as RagMatch[]).filter((m) => (m.similarity ?? 0) >= 0.2);
      }
    } catch (e) {
      console.error("Busca semântica por embedding falhou; usando fallback textual:", e);
    }

    const relevant = combineRagMatches(vectorMatches, lexicalMatches);
    foundAny = relevant.length > 0;
    if (foundAny) {
      retrievalMode = lexicalMatches.length > 0 && vectorMatches.length > 0
        ? "busca textual + semântica"
        : lexicalMatches.length > 0
          ? "busca textual"
          : "busca semântica";
      ragContext = relevant
        .map((m, i) => {
          const signals = [
            m.similarity != null ? `similaridade ${(m.similarity ?? 0).toFixed(2)}` : null,
            m.lexicalScore != null ? `texto ${m.lexicalScore}` : null,
          ].filter(Boolean).join("; ");
          return `### Fonte ${i + 1}${signals ? ` (${signals})` : ""} — [${m.source_type}] ${m.title}\n${m.content}`;
        })
        .join("\n\n---\n\n");
      const seen = new Set<string>();
      sources = relevant
        .filter((m) => { if (seen.has(m.title)) return false; seen.add(m.title); return true; })
        .slice(0, 5)
        .map((m) => ({ title: m.title, source_type: m.source_type }));
    }

    let reply: string;
    if (!foundAny && data.images.length === 0) {
      reply = "Não encontrei essa informação na base de conhecimento. Peça para um administrador cadastrar esse conteúdo em **Conhecimento → Base de Conhecimento IA** e tente novamente.";
    } else {
      const augmentedSystem = `${systemPrompt}

REGRAS:
- Use as fontes abaixo (Base de Conhecimento da empresa) como sua fonte primária quando houver.
- Se o usuário enviar uma imagem, analise-a e responda com base no que for solicitado, combinando com as fontes quando fizer sentido.
- Se as fontes responderem parcialmente, responda com o que houver e indique de forma breve o que faltou.
- Se NENHUMA fonte tiver relação com a pergunta e não houver imagem anexada, diga exatamente: "Não encontrei essa informação na base de conhecimento."
- Não invente fatos, valores ou políticas que não estejam nas fontes.
- Cite naturalmente o tipo de fonte (mensagem, script, procedimento…) quando útil.

=== FONTES DA BASE DE CONHECIMENTO (top ${sources.length}, modo: ${retrievalMode}, melhor similaridade ${topSimilarity.toFixed(2)}) ===
${ragContext || "(nenhuma fonte relevante encontrada — responda com base na imagem enviada, se houver)"}
=== FIM DAS FONTES ===`;

      reply = await chatCompletion({
        model,
        temperature: 0.2,
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
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Apenas administradores podem ver as configurações da IA.");
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
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Apenas administradores podem editar as configurações da IA.");
    const { error } = await context.supabase
      .from("ai_settings")
      .update({ system_prompt: data.system_prompt, model: data.model })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });