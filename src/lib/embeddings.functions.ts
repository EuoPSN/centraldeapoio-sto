import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateEmbedding } from "./ai-gateway.server";

interface SourceRow {
  source_type: string;
  source_id: string;
  title: string;
  body: string;
  category?: string | null;
  metadata?: Record<string, unknown>;
}

interface Chunk {
  source_type: string;
  source_id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

function chunkContent(row: SourceRow): Chunk[] {
  const header = row.category ? `[${row.category}] ${row.title}` : row.title;
  const text = `${header}\n\n${row.body}`.trim();
  const max = 1500;
  const baseMeta = row.metadata ?? {};
  if (text.length <= max) {
    return [{
      source_type: row.source_type,
      source_id: row.source_id,
      title: row.title,
      content: text,
      metadata: baseMeta,
    }];
  }
  const out: Chunk[] = [];
  let i = 0;
  let part = 0;
  while (i < text.length) {
    out.push({
      source_type: row.source_type,
      source_id: row.source_id,
      title: row.title,
      content: text.slice(i, i + max),
      metadata: { ...baseMeta, part },
    });
    i += max;
    part += 1;
  }
  return out;
}

async function ensureAdmin(supabase: { rpc: (n: string, p: unknown) => Promise<{ data: unknown }> }, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Apenas administradores podem reindexar a base.");
}

export const reindexAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [contentRes, scriptsRes, pricingRes] = await Promise.all([
      supabaseAdmin.from("content_items").select("*"),
      supabaseAdmin.from("scripts").select("*"),
      supabaseAdmin.from("pricing_items").select("*"),
    ]);
    if (contentRes.error) throw new Error(contentRes.error.message);
    if (scriptsRes.error) throw new Error(scriptsRes.error.message);
    if (pricingRes.error) throw new Error(pricingRes.error.message);

    const all: Chunk[] = [];
    for (const item of contentRes.data ?? []) {
      all.push(...chunkContent({
        source_type: `content:${item.section}`,
        source_id: item.id,
        title: item.title,
        category: item.category,
        body: item.content,
        metadata: { section: item.section, category: item.category, tags: item.tags },
      }));
    }
    for (const s of scriptsRes.data ?? []) {
      const body = s.usage_note ? `${s.body}\n\nOnde usar: ${s.usage_note}` : s.body;
      all.push(...chunkContent({
        source_type: "script",
        source_id: s.id,
        title: s.title,
        category: s.category,
        body,
        metadata: { category: s.category, subcategory: s.subcategory },
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
        source_type: "pricing",
        source_id: p.id,
        title: p.specialty,
        content: `[Tabela de Preços — ${p.category}] ${p.specialty}\n\n${lines}`,
        metadata: { category: p.category },
      });
    }

    // gera embeddings
    const withEmb: Array<Chunk & { embedding: number[] }> = [];
    for (const c of all) {
      const emb = await generateEmbedding(c.content);
      withEmb.push({ ...c, embedding: emb });
    }

    // limpa e insere
    const { error: delErr } = await supabaseAdmin
      .from("knowledge_chunks")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(delErr.message);

    if (withEmb.length > 0) {
      for (let i = 0; i < withEmb.length; i += 50) {
        const batch = withEmb.slice(i, i + 50).map((c) => ({
          source_type: c.source_type,
          source_id: c.source_id,
          title: c.title,
          content: c.content,
          embedding: JSON.stringify(c.embedding),
          metadata: c.metadata as never,
        }));
        const { error } = await supabaseAdmin.from("knowledge_chunks").insert(batch);
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true, indexed: withEmb.length };
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
