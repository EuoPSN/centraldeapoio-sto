import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { removerDadosPessoais } from "@/lib/cliente-disse";
import {
  calcularUso, limparTrecho, linhaUltimaMensagem, mensagemLimite,
  type RaioxResposta, type UsoStatus,
} from "@/lib/cerebro";
import { PONTO_LABEL, type Ponto } from "@/lib/retomada";
import type { CopilotoResultado } from "@/lib/cerebro.server";

// Copiloto e Raio-X — funções de servidor das páginas /copiloto e /raiox.
//
// Privacidade: a conversa e os prints NÃO são guardados. O texto já chega limpo do
// navegador (telefone, CPF, e-mail removidos) e é limpo de novo aqui. Os prints
// sobem para o Storage só durante a análise e são apagados logo depois (mesmo se
// a IA falhar). Do Raio-X guarda-se apenas o resultado, sem nome nem telefone.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;

const BUCKET = "chat-images";
const FerramentaIA = z.enum(["copiloto", "raiox"]);

const EntradaConversa = z.object({
  texto: z.string().max(100000).default(""),
  /** Quem falou por último e quando (o servidor calcula "há quanto tempo"). */
  ultima_mensagem: z.object({ de: z.enum(["cliente", "atendente", "pessoa"]), em: z.string().max(40) }).nullable().default(null),
  /** Caminhos dos prints no Storage (bucket chat-images, pasta do próprio usuário). */
  caminhos: z.array(z.string().max(300)).max(4).default([]),
  primeiro_nome_cliente: z.string().trim().max(60).nullable().default(null),
});

/** Texto limpo + linha "última mensagem: de quem e há quanto tempo". */
function textoParaIA(data: z.infer<typeof EntradaConversa>): string {
  const limpo = removerDadosPessoais(data.texto);
  if (!limpo.trim()) return limpo;
  const ultima = linhaUltimaMensagem(data.ultima_mensagem);
  return ultima ? `${limpo}\n\n${ultima}` : limpo;
}

async function adminStorage() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Gera URLs temporárias dos prints e devolve também a função que apaga tudo. */
async function prepararImagens(ctx: Ctx, caminhos: string[]) {
  const validos = caminhos.filter((c) => c.startsWith(`${ctx.userId}/`) && !c.includes(".."));
  if (!validos.length) return { urls: [] as string[], apagar: async () => {} };
  const a = await adminStorage();
  const urls: string[] = [];
  for (const c of validos) {
    const { data, error } = await a.storage.from(BUCKET).createSignedUrl(c, 600);
    if (error || !data) throw new Error("Não consegui ler o print.");
    urls.push(data.signedUrl);
  }
  return { urls, apagar: async () => { await a.storage.from(BUCKET).remove(validos).catch(() => undefined); } };
}

async function nomeDoAtendente(ctx: Ctx): Promise<string> {
  const { data } = await db(ctx).from("profiles").select("display_name, email").eq("id", ctx.userId).maybeSingle();
  return (data?.display_name as string | null)?.trim() || String(data?.email ?? "").split("@")[0] || "";
}

/** Nome do atendente (para a leitura do .txt) e uso do dia da ferramenta. */
export const getCopiloto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ferramenta: FerramentaIA }).parse(d))
  .handler(async ({ data, context }): Promise<{ atendente: string; uso: UsoStatus }> => {
    const { statusUso } = await import("@/lib/cerebro.server");
    if (data.ferramenta === "raiox") await db(context).rpc("limpar_raiox").then(() => undefined, () => undefined);
    const [atendente, uso] = await Promise.all([nomeDoAtendente(context), statusUso(context, data.ferramenta)]);
    return { atendente, uso };
  });

type Bloqueado = { ok: false; motivo: "limite"; mensagem: string; uso: UsoStatus };

export const analisarConversaCopiloto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EntradaConversa.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; resultado: CopilotoResultado; uso: UsoStatus } | Bloqueado> => {
    const { statusUso, registrarUso, analisarCopiloto } = await import("@/lib/cerebro.server");
    const antes = await statusUso(context, "copiloto");
    if (antes.bloqueado) return { ok: false, motivo: "limite", mensagem: mensagemLimite("copiloto"), uso: antes };
    if (!data.texto.trim() && !data.caminhos.length) throw new Error("Conversa vazia.");

    const img = await prepararImagens(context, data.caminhos);
    try {
      const resultado = await analisarCopiloto({ texto: textoParaIA(data), imagens: img.urls });
      await registrarUso(context, "copiloto");
      return { ok: true, resultado, uso: calcularUso("copiloto", antes.usado + 1, antes.limite) };
    } finally {
      await img.apagar();
    }
  });

// ---------------------------------------------------------------------------
// Raio-X
// ---------------------------------------------------------------------------

const EntradaRaiox = EntradaConversa.extend({
  tempo_resposta: z.object({ mediaMin: z.number().min(0).max(100000), maiorMin: z.number().min(0).max(100000) }).nullable().default(null),
  retomada_id: z.string().uuid().nullable().default(null),
});

export const fazerRaiox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EntradaRaiox.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; resultado: RaioxResposta; uso: UsoStatus } | Bloqueado> => {
    const { statusUso, registrarUso, analisarRaiox } = await import("@/lib/cerebro.server");
    const antes = await statusUso(context, "raiox");
    if (antes.bloqueado) return { ok: false, motivo: "limite", mensagem: mensagemLimite("raiox"), uso: antes };
    if (!data.texto.trim() && !data.caminhos.length) throw new Error("Conversa vazia.");

    const img = await prepararImagens(context, data.caminhos);
    try {
      const resultado = await analisarRaiox({
        texto: textoParaIA(data),
        imagens: img.urls,
        tempoResposta: data.tempo_resposta,
        primeiroNomeCliente: data.primeiro_nome_cliente,
      });
      // Guarda só o resultado (trechos já sem nome/telefone do cliente).
      const l = (t: string) => limparTrecho(t, data.primeiro_nome_cliente);
      const { error } = await db(context).from("raiox_resultados").insert({
        user_id: context.userId,
        retomada_id: data.retomada_id,
        etapa: resultado.etapa,
        onde_perdeu: { descricao: l(resultado.onde_perdeu.descricao), fala_cliente: l(resultado.onde_perdeu.fala_cliente), fala_atendente: l(resultado.onde_perdeu.fala_atendente) },
        faltou: resultado.faltou,
        reescrita: resultado.reescrita,
        escrita: resultado.escrita,
        habito: { titulo: resultado.habito.titulo, descricao: resultado.habito.descricao, perfil_id: resultado.perfil_id },
      });
      if (error) console.error("Não consegui guardar o Raio-X:", error.message);
      await registrarUso(context, "raiox");
      return { ok: true, resultado, uso: calcularUso("raiox", antes.usado + 1, antes.limite) };
    } finally {
      await img.apagar();
    }
  });

/** Cabeçalho do Raio-X aberto a partir de um ticket perdido da retomada
 * (só o dono do ticket enxerga; o RLS de `retomadas` garante). */
export const getRetomadaParaRaiox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r } = await db(context)
      .from("retomadas")
      .select("id, primeiro_nome, ponto_parada, status, updated_at")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!r) return null;
    return {
      id: r.id as string,
      primeiro_nome: r.primeiro_nome as string,
      ponto_label: PONTO_LABEL[r.ponto_parada as Ponto] ?? "",
      status: r.status as string,
      data: r.updated_at as string,
    };
  });

