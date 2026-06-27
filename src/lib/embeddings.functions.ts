import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateEmbedding } from "./ai-gateway.server";

interface Chunk {
  source_type: string;
  source_id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
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
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Apenas administradores podem reindexar a base.");
}

export const reindexAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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

    const withEmb: Array<Chunk & { embedding: number[] }> = [];
    for (const c of all) {
      const emb = await generateEmbedding(c.content);
      withEmb.push({ ...c, embedding: emb });
    }

    const { error: delErr } = await supabaseAdmin
      .from("knowledge_chunks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(delErr.message);

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
