import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateEmbeddings, isEmbeddingRateLimitError } from "./ai-gateway.server";

interface Chunk {
  source_type: string;
  source_id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

interface ReindexInput {
  reset?: boolean;
}

function chunkText(base: Chunk, max = 1200): Chunk[] {
  if (base.content.length <= max) return [base];
  const out: Chunk[] = [];
  let i = 0, part = 0;
  while (i < base.content.length) {
    const slice = base.content.slice(i, i + max);
    out.push({ ...base, content: slice, metadata: { ...base.metadata, part } });
    i += max - 150; // overlap
    part += 1;
  }
  return out;
}

async function ensureAdmin(supabase: { rpc: (n: string, p: unknown) => Promise<{ data: unknown }> }, userId: string) {
  const isAdmin = await isAdminUser(supabase, userId);
  if (!isAdmin) throw new Error("Apenas administradores podem reindexar a base.");
}

function chunkKey(chunk: Pick<Chunk, "source_type" | "source_id" | "title" | "content">) {
  return `${chunk.source_type}::${chunk.source_id}::${chunk.title}::${chunk.content}`;
}

export const reindexAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): ReindexInput => {
    const data = (input ?? {}) as ReindexInput;
    return { reset: data.reset !== false };
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [keRes, msgRes, nodesRes, contentRes, scriptsRes, pricingRes] = await Promise.all([
      supabaseAdmin.from("knowledge_entries").select("*"),
      supabaseAdmin.from("messages").select("*"),
      supabaseAdmin.from("flow_nodes").select("*, flow:flows(title)"),
      supabaseAdmin.from("content_items").select("*"),
      supabaseAdmin.from("scripts").select("*"),
      supabaseAdmin.from("pricing_items").select("*"),
    ]);

    const all: Chunk[] = [];

    for (const k of keRes.data ?? []) {
      const header = `[${k.kind.toUpperCase()}] ${k.title}`;
      const body = [k.summary, k.content, k.external_url ? `Link: ${k.external_url}` : null]
        .filter(Boolean).join("\n\n");
      all.push(...chunkText({
        source_type: `knowledge:${k.kind}`,
        source_id: k.id,
        title: k.title,
        content: `${header}\n\n${body}`,
        metadata: { kind: k.kind, tags: k.tags },
      }));
    }
    for (const m of msgRes.data ?? []) {
      all.push(...chunkText({
        source_type: "message",
        source_id: m.id,
        title: m.title,
        content: `[MENSAGEM] ${m.title}\n\n${m.content}${m.internal_note ? `\n\nObs: ${m.internal_note}` : ""}`,
        metadata: {},
      }));
    }
    for (const n of nodesRes.data ?? []) {
      const flowTitle = (n as { flow?: { title?: string } | null }).flow?.title ?? "";
      const body = [n.title, n.message, n.note].filter(Boolean).join("\n\n");
      if (!body.trim()) continue;
      all.push(...chunkText({
        source_type: `flow:${n.node_type}`,
        source_id: n.id,
        title: `${flowTitle} → ${n.title}`,
        content: `[FLUXO ${flowTitle}] ${n.title}\n\n${body}`,
        metadata: { flow_id: n.flow_id, node_type: n.node_type },
      }));
    }
    for (const item of contentRes.data ?? []) {
      all.push(...chunkText({
        source_type: `content:${item.section}`,
        source_id: item.id,
        title: item.title,
        content: `[${item.section.toUpperCase()}] ${item.title}\n\n${item.content}`,
        metadata: { section: item.section, category: item.category },
      }));
    }
    for (const s of scriptsRes.data ?? []) {
      const body = s.usage_note ? `${s.body}\n\nOnde usar: ${s.usage_note}` : s.body;
      all.push(...chunkText({
        source_type: "script",
        source_id: s.id,
        title: s.title,
        content: `[SCRIPT - ${s.category}] ${s.title}\n\n${body}`,
        metadata: { category: s.category },
      }));
    }
    for (const p of pricingRes.data ?? []) {
      const lines = [
        `Especialidade: ${p.specialty}`,
        p.cartao_price != null ? `Valor Cartão de Todos: R$ ${Number(p.cartao_price).toFixed(2)}` : null,
        p.particular_price != null ? `Valor Particular: R$ ${Number(p.particular_price).toFixed(2)}` : null,
        p.notes ? `Obs: ${p.notes}` : null,
      ].filter(Boolean).join("\n");
      all.push({
        source_type: "pricing", source_id: p.id, title: p.specialty,
        content: `[PREÇOS — ${p.category}] ${p.specialty}\n\n${lines}`,
        metadata: { category: p.category },
      });
    }

    if (data.reset) {
      const { error: delErr } = await supabaseAdmin
        .from("knowledge_chunks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) throw new Error(delErr.message);
    }

    const { data: existingRows, error: existingErr } = await supabaseAdmin
      .from("knowledge_chunks")
      .select("source_type,source_id,title,content");
    if (existingErr) throw new Error(existingErr.message);

    const existing = new Set((existingRows ?? []).map((row) => chunkKey(row)));
    const pending = all.filter((chunk) => !existing.has(chunkKey(chunk)));
    const batchSize = 8;
    let indexed = 0;

    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      try {
        const embeddings = await generateEmbeddings(batch.map((chunk) => chunk.content));
        const rows = batch.map((chunk, index) => ({
          source_type: chunk.source_type,
          source_id: chunk.source_id,
          title: chunk.title,
          content: chunk.content,
          embedding: JSON.stringify(embeddings[index]),
          metadata: chunk.metadata as never,
        }));
        const { error } = await supabaseAdmin.from("knowledge_chunks").insert(rows);
        if (error) throw new Error(error.message);
        indexed += rows.length;
        await new Promise((resolve) => setTimeout(resolve, 2500));
      } catch (error) {
        if (isEmbeddingRateLimitError(error)) {
          return {
            ok: false,
            indexed,
            skipped: pending.length - indexed,
            total: all.length,
            reason: "rate_limited" as const,
            message: error.message,
          };
        }
        throw error;
      }
    }

    return { ok: true, indexed, skipped: all.length - pending.length, total: all.length };
  });

export const getIndexStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("knowledge_chunks")
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { totalChunks: count ?? 0 };
  });
